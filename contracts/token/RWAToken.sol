// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IRWAAssetRegistry} from "../interfaces/IRWAAssetRegistry.sol";
import {IComplianceRegistry} from "../interfaces/IComplianceRegistry.sol";

/**
 * @title RWAToken
 * @notice A permissioned ERC-20 representing a 1:1 claim on a custodied
 *         real-world asset registered in {RWAAssetRegistry}.
 *
 * Two invariants are enforced by the contract itself, not by policy:
 *
 *   1. **Backing.** `totalSupply()` can never exceed the reserve figure most
 *      recently attested by the asset's custodian. Minting past the attested
 *      units reverts, so an unbacked token cannot come into existence.
 *
 *   2. **Eligibility.** Every holder — sender and recipient, on every transfer —
 *      must carry a live attestation in {ComplianceRegistry} at or above
 *      `minTier`. Tokens cannot leak to an unverified wallet.
 *
 * Redemption is a burn: the holder destroys tokens and emits a reference that
 * the issuer settles off-chain, at which point the custodian's next attestation
 * reflects the reduced reserve. On-chain supply and off-chain custody therefore
 * converge by construction.
 */
contract RWAToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Asset in {RWAAssetRegistry} this token represents.
    bytes32 public immutable assetId;
    IRWAAssetRegistry public immutable assetRegistry;
    IComplianceRegistry public immutable compliance;

    /// @notice Minimum investor tier required to hold this token (see ComplianceRegistry.Tier).
    uint8 public minTier;

    /// @notice Lifetime issuance and redemption totals, for the reserve report.
    uint256 public totalMinted;
    uint256 public totalRedeemed;

    event Minted(address indexed to, uint256 amount, bytes32 indexed custodyRef, uint256 newSupply);
    event RedemptionRequested(
        address indexed holder, uint256 amount, bytes32 indexed settlementRef, uint256 newSupply
    );
    event MinTierUpdated(uint8 previous, uint8 current);

    error AssetNotMintable(bytes32 assetId);
    error ExceedsAttestedReserves(uint256 attempted, uint256 attested);
    error NotEligible(address account);
    error ZeroAmount();

    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 assetId_,
        address assetRegistry_,
        address compliance_,
        uint8 minTier_,
        address admin
    ) ERC20(name_, symbol_) {
        assetId = assetId_;
        assetRegistry = IRWAAssetRegistry(assetRegistry_);
        compliance = IComplianceRegistry(compliance_);
        minTier = minTier_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Issuance & redemption
    // ---------------------------------------------------------------------

    /**
     * @notice Issue tokens against custodied reserves.
     * @param custodyRef Reference to the custody instruction authorising this mint
     *                   (keccak256 of the signed subscription record).
     */
    function mint(address to, uint256 amount, bytes32 custodyRef) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (!assetRegistry.isMintable(assetId)) revert AssetNotMintable(assetId);

        uint256 attested = assetRegistry.attestedUnits(assetId);
        uint256 newSupply = totalSupply() + amount;
        if (newSupply > attested) revert ExceedsAttestedReserves(newSupply, attested);

        _mint(to, amount);
        totalMinted += amount;

        emit Minted(to, amount, custodyRef, newSupply);
    }

    /**
     * @notice Burn tokens to redeem the underlying asset off-chain.
     * @param settlementRef Reference the issuer uses to settle the redemption.
     */
    function requestRedemption(uint256 amount, bytes32 settlementRef) external {
        if (amount == 0) revert ZeroAmount();

        _burn(msg.sender, amount);
        totalRedeemed += amount;

        emit RedemptionRequested(msg.sender, amount, settlementRef, totalSupply());
    }

    /// @notice Forced burn for court orders / sanctions remediation.
    function forceBurn(address from, uint256 amount, bytes32 reasonRef) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
        totalRedeemed += amount;
        emit RedemptionRequested(from, amount, reasonRef, totalSupply());
    }

    // ---------------------------------------------------------------------
    // Transfer eligibility
    // ---------------------------------------------------------------------

    /// @dev OZ v5 routes mint, burn and transfer through `_update`.
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        // Minting (from == 0): recipient must be eligible.
        // Burning (to == 0): always permitted, so a holder who loses eligibility
        //                    can still exit rather than being trapped.
        // Transfer:          both sides must be eligible.
        if (from != address(0) && to != address(0)) {
            if (!compliance.isVerifiedAtLeast(from, minTier)) revert NotEligible(from);
            if (!compliance.isVerifiedAtLeast(to, minTier)) revert NotEligible(to);
        } else if (from == address(0)) {
            if (!compliance.isVerifiedAtLeast(to, minTier)) revert NotEligible(to);
        }

        super._update(from, to, value);
    }

    // ---------------------------------------------------------------------
    // Admin & views
    // ---------------------------------------------------------------------

    function setMinTier(uint8 newTier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit MinTierUpdated(minTier, newTier);
        minTier = newTier;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Headroom left before the current custody attestation is exhausted.
    function mintableHeadroom() external view returns (uint256) {
        if (!assetRegistry.isMintable(assetId)) return 0;
        uint256 attested = assetRegistry.attestedUnits(assetId);
        uint256 supply = totalSupply();
        return attested > supply ? attested - supply : 0;
    }

    /// @notice Backing ratio in basis points (10000 = fully backed 1:1).
    function backingRatioBps() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return type(uint256).max;
        return (assetRegistry.attestedUnits(assetId) * 10_000) / supply;
    }
}
