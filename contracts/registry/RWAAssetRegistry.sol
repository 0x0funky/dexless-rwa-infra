// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RWAAssetRegistry
 * @notice Canonical on-chain record of every real-world asset admitted to DEXless.
 *
 * Three things live here, and nothing else:
 *   1. WHAT the asset is         — class, issuer, jurisdiction, legal doc hash
 *   2. WHO custodies it          — custodian address + periodic reserve attestations
 *   3. WHETHER it may be used    — lifecycle status gating mint and market creation
 *
 * The custody attestation is the backbone of the 1:1 mapping guarantee:
 * `RWAToken` refuses to mint beyond the most recently attested off-chain unit
 * count, so on-chain supply can never exceed custodied reserves.
 *
 * Legal documents (prospectus, custody agreement, audit report) are pinned to
 * IPFS; only the CID and a keccak256 digest are stored on-chain, so any party
 * can prove the document they hold is the one that was registered.
 */
contract RWAAssetRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum AssetClass {
        UNSPECIFIED,
        FUND_SHARE, // e.g. money-market or mutual fund unit (NAV-priced)
        PRECIOUS_METAL, // e.g. allocated gold in a vault
        RECEIVABLE, // e.g. invoice / trade receivable
        EQUITY,
        BOND,
        COMMODITY,
        REAL_ESTATE,
        OTHER
    }

    enum Status {
        NONE,
        PENDING, // registered, awaiting first custody attestation
        ACTIVE, // tradable + mintable
        SUSPENDED, // temporarily halted (stale attestation, price anomaly, legal event)
        RETIRED // permanently wound down
    }

    struct Asset {
        AssetClass class;
        Status status;
        uint16 jurisdiction; // ISO-3166-1 numeric
        uint8 decimals; // decimals of the off-chain unit count
        string symbol;
        string name;
        address issuer;
        address custodian;
        string legalDocURI; // ipfs://... prospectus / custody agreement
        bytes32 legalDocHash; // keccak256 of that document
        uint64 registeredAt;
    }

    /// @notice Calldata bundle for {registerAsset}, kept as a struct so the
    ///         function stays within the EVM stack limit.
    struct AssetInput {
        AssetClass class;
        string symbol;
        string name;
        address issuer;
        address custodian;
        uint16 jurisdiction;
        uint8 decimals;
        string legalDocURI;
        bytes32 legalDocHash;
    }

    /// @notice Latest reserve attestation signed off by the custodian.
    struct CustodyAttestation {
        // Off-chain units held in custody, ALWAYS expressed in 18-decimal fixed
        // point regardless of Asset.decimals, so that RWAToken (18 decimals) can
        // compare its supply against this figure directly.
        uint256 units;
        bytes32 proofHash; // keccak256 of the custodian's signed statement
        string proofURI; // ipfs://... of that statement
        uint64 attestedAt;
        address attestedBy;
    }

    mapping(bytes32 assetId => Asset) private _assets;
    mapping(bytes32 assetId => CustodyAttestation) private _custody;
    bytes32[] private _assetIds;

    /// @notice Max age of a custody attestation before the asset is considered unbacked.
    uint64 public custodyStaleAfter = 35 days;

    event AssetRegistered(
        bytes32 indexed assetId,
        AssetClass indexed class,
        address indexed issuer,
        address custodian,
        string symbol,
        uint16 jurisdiction,
        bytes32 legalDocHash
    );
    event CustodyAttested(
        bytes32 indexed assetId,
        address indexed custodian,
        uint256 units,
        bytes32 proofHash,
        uint64 attestedAt
    );
    event AssetStatusChanged(bytes32 indexed assetId, Status indexed from, Status indexed to, string reason);
    event CustodyStaleAfterUpdated(uint64 previous, uint64 current);

    error AssetExists(bytes32 assetId);
    error UnknownAsset(bytes32 assetId);
    error NotCustodian(bytes32 assetId, address caller);
    error InvalidTransition(Status from, Status to);
    error ZeroAddress();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    /**
     * @notice Admit a real-world asset to the registry. Starts in PENDING and
     *         only becomes ACTIVE once the custodian has attested reserves.
     * @param assetId Deterministic id, conventionally keccak256(abi.encodePacked(symbol, issuer)).
     */
    function registerAsset(bytes32 assetId, AssetInput calldata input) external onlyRole(REGISTRAR_ROLE) {
        if (_assets[assetId].status != Status.NONE) revert AssetExists(assetId);
        if (input.issuer == address(0) || input.custodian == address(0)) revert ZeroAddress();

        _assets[assetId] = Asset({
            class: input.class,
            status: Status.PENDING,
            jurisdiction: input.jurisdiction,
            decimals: input.decimals,
            symbol: input.symbol,
            name: input.name,
            issuer: input.issuer,
            custodian: input.custodian,
            legalDocURI: input.legalDocURI,
            legalDocHash: input.legalDocHash,
            registeredAt: uint64(block.timestamp)
        });
        _assetIds.push(assetId);

        emit AssetRegistered(
            assetId, input.class, input.issuer, input.custodian, input.symbol, input.jurisdiction, input.legalDocHash
        );
    }

    // ---------------------------------------------------------------------
    // Custody attestation — the 1:1 backing proof
    // ---------------------------------------------------------------------

    /**
     * @notice Custodian publishes the current off-chain reserve balance.
     * @dev First successful attestation promotes a PENDING asset to ACTIVE.
     *      This is the call the custodian (or JEPUN's NAV pipeline) makes on a
     *      recurring schedule; every invocation is a real on-chain business event.
     */
    function attestCustody(
        bytes32 assetId,
        uint256 units,
        bytes32 proofHash,
        string calldata proofURI
    ) external {
        Asset storage a = _assets[assetId];
        if (a.status == Status.NONE) revert UnknownAsset(assetId);
        if (msg.sender != a.custodian && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert NotCustodian(assetId, msg.sender);
        }

        _custody[assetId] = CustodyAttestation({
            units: units,
            proofHash: proofHash,
            proofURI: proofURI,
            attestedAt: uint64(block.timestamp),
            attestedBy: msg.sender
        });

        emit CustodyAttested(assetId, msg.sender, units, proofHash, uint64(block.timestamp));

        if (a.status == Status.PENDING && units > 0) {
            a.status = Status.ACTIVE;
            emit AssetStatusChanged(assetId, Status.PENDING, Status.ACTIVE, "first custody attestation");
        }
    }

    /// @notice Admin lifecycle control (suspend on legal event, retire on wind-down).
    function setStatus(bytes32 assetId, Status to, string calldata reason) external onlyRole(REGISTRAR_ROLE) {
        Asset storage a = _assets[assetId];
        if (a.status == Status.NONE) revert UnknownAsset(assetId);
        if (to == Status.NONE || to == a.status) revert InvalidTransition(a.status, to);
        if (a.status == Status.RETIRED) revert InvalidTransition(a.status, to);

        Status from = a.status;
        a.status = to;
        emit AssetStatusChanged(assetId, from, to, reason);
    }

    function setCustodyStaleAfter(uint64 newWindow) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit CustodyStaleAfterUpdated(custodyStaleAfter, newWindow);
        custodyStaleAfter = newWindow;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice True when the asset is ACTIVE *and* its custody attestation is fresh.
    function isMintable(bytes32 assetId) external view returns (bool) {
        Asset storage a = _assets[assetId];
        CustodyAttestation storage c = _custody[assetId];
        return a.status == Status.ACTIVE && c.attestedAt != 0
            && block.timestamp - c.attestedAt <= custodyStaleAfter;
    }

    /// @notice Upper bound on token supply implied by the latest reserve attestation.
    function attestedUnits(bytes32 assetId) external view returns (uint256) {
        return _custody[assetId].units;
    }

    function getAsset(bytes32 assetId) external view returns (Asset memory) {
        if (_assets[assetId].status == Status.NONE) revert UnknownAsset(assetId);
        return _assets[assetId];
    }

    function getCustody(bytes32 assetId) external view returns (CustodyAttestation memory) {
        return _custody[assetId];
    }

    function statusOf(bytes32 assetId) external view returns (Status) {
        return _assets[assetId].status;
    }

    function assetCount() external view returns (uint256) {
        return _assetIds.length;
    }

    function assetIdAt(uint256 index) external view returns (bytes32) {
        return _assetIds[index];
    }
}
