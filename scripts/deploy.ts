import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ASSET_ID, BOUNDS, TOKEN, explorerFor } from "./config";

/**
 * Deploys the full DEXless RWA stack and writes an address book to
 * `deployments/<network>.json`, which every other script reads.
 *
 *   npx hardhat run scripts/deploy.ts --network bscTestnet
 *   npx hardhat run scripts/deploy.ts --network bsc
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`network   : ${network.name} (chainId ${chainId})`);
  console.log(`deployer  : ${deployer.address}`);
  console.log(`balance   : ${ethers.formatEther(balance)} BNB\n`);

  if (balance === 0n) throw new Error("deployer has no BNB — fund it before deploying");

  // Role separation:
  //   admin    — holds DEFAULT_ADMIN_ROLE. A multisig on mainnet. Can grant and
  //              revoke everything, but is never used for day-to-day calls.
  //   operator — holds the operational roles the scripts and keeper need
  //              (registrar, attester, feed admin, minter, ...). A hot key.
  //
  // Contracts are deployed with the *deployer* as initial admin so it can wire
  // the operator up, then admin rights are handed to `admin`. Without this, a
  // multisig admin would leave every operational script unable to transact.
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const operator = process.env.OPERATOR_ADDRESS || deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  console.log(`admin     : ${admin}${admin === deployer.address ? " (= deployer)" : ""}`);
  console.log(`operator  : ${operator}${operator === deployer.address ? " (= deployer)" : ""}`);
  console.log(`treasury  : ${treasury}\n`);

  // Guard rails for the one deployment that matters.
  if (chainId === 56) {
    if (process.env.SEASONING_PERIOD || process.env.REQUIRED_VALIDATIONS) {
      throw new Error(
        "SEASONING_PERIOD / REQUIRED_VALIDATIONS must not be set on mainnet — " +
          "shortened seasoning defeats the permissionless listing safety property"
      );
    }
    if (admin === deployer.address) {
      console.warn(
        "!! ADMIN_ADDRESS is the deployer EOA. Set it to a multisig before this\n" +
          "   deployment holds real value — a single key holding DEFAULT_ADMIN_ROLE\n" +
          "   is the first finding any auditor will raise.\n"
      );
    }
  }

  const compliance = await ethers.deployContract("ComplianceRegistry", [deployer.address]);
  await compliance.waitForDeployment();
  console.log(`ComplianceRegistry   ${await compliance.getAddress()}`);

  const assets = await ethers.deployContract("RWAAssetRegistry", [deployer.address]);
  await assets.waitForDeployment();
  console.log(`RWAAssetRegistry     ${await assets.getAddress()}`);

  const engine = await ethers.deployContract("PriceValidationEngine", [deployer.address]);
  await engine.waitForDeployment();
  console.log(`PriceValidationEngine ${await engine.getAddress()}`);

  const factory = await ethers.deployContract("MarketFactory", [
    deployer.address,
    await engine.getAddress(),
    await assets.getAddress(),
    treasury,
    BOUNDS,
  ]);
  await factory.waitForDeployment();
  console.log(`MarketFactory        ${await factory.getAddress()}`);

  const token = await ethers.deployContract("RWAToken", [
    TOKEN.name,
    TOKEN.symbol,
    ASSET_ID,
    await assets.getAddress(),
    await compliance.getAddress(),
    TOKEN.minTier,
    deployer.address,
  ]);
  await token.waitForDeployment();
  console.log(`RWAToken             ${await token.getAddress()}`);

  const distributor = await ethers.deployContract("FeeDistributor", [deployer.address, treasury]);
  await distributor.waitForDeployment();
  console.log(`FeeDistributor       ${await distributor.getAddress()}`);

  // ---------------------------------------------------------------------
  // Role wiring
  // ---------------------------------------------------------------------
  const DEFAULT_ADMIN = ethers.ZeroHash;
  const roleGrants: { contract: any; name: string; role: string; label: string }[] = [
    { contract: compliance, name: "ComplianceRegistry", role: await compliance.ATTESTER_ROLE(), label: "ATTESTER" },
    { contract: assets, name: "RWAAssetRegistry", role: await assets.REGISTRAR_ROLE(), label: "REGISTRAR" },
    { contract: engine, name: "PriceValidationEngine", role: await engine.FEED_ADMIN_ROLE(), label: "FEED_ADMIN" },
    { contract: factory, name: "MarketFactory", role: await factory.MARKET_ADMIN_ROLE(), label: "MARKET_ADMIN" },
    { contract: token, name: "RWAToken", role: await token.MINTER_ROLE(), label: "MINTER" },
    { contract: token, name: "RWAToken", role: await token.PAUSER_ROLE(), label: "PAUSER" },
    { contract: distributor, name: "FeeDistributor", role: await distributor.DISTRIBUTOR_ROLE(), label: "DISTRIBUTOR" },
  ];

  if (operator !== deployer.address) {
    console.log(`\ngranting operational roles to operator ${operator}`);
    for (const g of roleGrants) {
      await (await g.contract.grantRole(g.role, operator)).wait();
      console.log(`  ${g.name}.${g.label}`);
    }
  }

  const handingOver = admin.toLowerCase() !== deployer.address.toLowerCase();
  if (handingOver) {
    console.log(`\nhanding DEFAULT_ADMIN_ROLE to ${admin}`);
    const all = [
      { c: compliance, n: "ComplianceRegistry" },
      { c: assets, n: "RWAAssetRegistry" },
      { c: engine, n: "PriceValidationEngine" },
      { c: factory, n: "MarketFactory" },
      { c: token, n: "RWAToken" },
      { c: distributor, n: "FeeDistributor" },
    ];
    for (const { c, n } of all) {
      await (await c.grantRole(DEFAULT_ADMIN, admin)).wait();
      console.log(`  ${n}`);
    }

    // Renouncing is deliberately opt-in and separate: do it only after the new
    // admin has proven it can actually transact. Renouncing against a wrong or
    // unusable address locks the system permanently.
    if (process.env.RENOUNCE_DEPLOYER_ADMIN === "true") {
      console.log(`\nrenouncing deployer's DEFAULT_ADMIN_ROLE`);
      for (const { c, n } of all) {
        await (await c.renounceRole(DEFAULT_ADMIN, deployer.address)).wait();
        console.log(`  ${n}`);
      }
    } else {
      console.log(
        `\n!! Deployer still holds DEFAULT_ADMIN_ROLE alongside ${admin}.\n` +
          `   Confirm the new admin can transact, then re-run with\n` +
          `   RENOUNCE_DEPLOYER_ADMIN=true to drop the deployer's rights.`
      );
    }
  }

  const book = {
    network: network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    deployBlock: await ethers.provider.getBlockNumber(),
    deployer: deployer.address,
    admin,
    operator,
    treasury,
    deployerRetainsAdmin: admin.toLowerCase() === deployer.address.toLowerCase()
      || process.env.RENOUNCE_DEPLOYER_ADMIN !== "true",
    explorer: explorerFor(chainId),
    contracts: {
      ComplianceRegistry: await compliance.getAddress(),
      RWAAssetRegistry: await assets.getAddress(),
      PriceValidationEngine: await engine.getAddress(),
      MarketFactory: await factory.getAddress(),
      RWAToken: await token.getAddress(),
      FeeDistributor: await distributor.getAddress(),
    },
    constructorArgs: {
      ComplianceRegistry: [deployer.address],
      RWAAssetRegistry: [deployer.address],
      PriceValidationEngine: [deployer.address],
      MarketFactory: [
        deployer.address,
        await engine.getAddress(),
        await assets.getAddress(),
        treasury,
        {
          maxLeverageCap: Number(BOUNDS.maxLeverageCap),
          minInitialMarginBps: Number(BOUNDS.minInitialMarginBps),
          minMaintenanceMarginBps: Number(BOUNDS.minMaintenanceMarginBps),
          seasoningPeriod: BOUNDS.seasoningPeriod.toString(),
          requiredValidations: BOUNDS.requiredValidations.toString(),
          proposalTTL: BOUNDS.proposalTTL.toString(),
          bondAmount: BOUNDS.bondAmount.toString(),
        },
      ],
      RWAToken: [
        TOKEN.name,
        TOKEN.symbol,
        ASSET_ID,
        await assets.getAddress(),
        await compliance.getAddress(),
        TOKEN.minTier,
        deployer.address,
      ],
      FeeDistributor: [deployer.address, treasury],
    },
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(book, null, 2));

  console.log(`\naddress book written to ${file}`);
  console.log(`next: npx hardhat run scripts/verify.ts --network ${network.name}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
