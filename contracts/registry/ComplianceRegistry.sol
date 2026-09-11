// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ComplianceRegistry
 * @notice On-chain identity / KYC attestation registry for DEXless RWA markets.
 *
 * Off-chain KYC is performed by a licensed provider. The provider (or an
 * operator acting on its behalf) writes a *hash* of the verification record
 * on-chain — never the PII itself. Every RWA token transfer and every market
 * proposal consults this registry.
 *
 * This contract is the "compliance / KYC / identity module" required by the
 * BNB Chain RWA Infra track, and it doubles as the canonical source of the
 * project's verifiable real-user count: `verifiedCount()` can only be
 * incremented by a real attestation from an authorised attester.
 */
contract ComplianceRegistry is AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    /// @notice Investor classification, drives which assets an account may hold.
    enum Tier {
        NONE, // 0 - not verified
        RETAIL, // 1 - basic KYC
        ACCREDITED, // 2 - accredited / professional investor
        INSTITUTIONAL // 3 - institutional entity
    }

    struct Attestation {
        bytes32 recordHash; // keccak256 of the off-chain KYC record (PII stays off-chain)
        string evidenceURI; // IPFS CID of the encrypted evidence bundle
        uint16 jurisdiction; // ISO-3166-1 numeric country code
        Tier tier;
        uint64 issuedAt;
        uint64 expiresAt;
        address attester;
        bool revoked;
    }

    mapping(address account => Attestation) private _attestations;

    /// @notice Jurisdictions that may not hold any DEXless RWA token.
    mapping(uint16 jurisdiction => bool) public jurisdictionBlocked;

    /// @notice Number of accounts that have ever been successfully attested.
    uint256 public totalAttested;
    /// @notice Number of accounts currently holding a live (non-revoked, non-expired) attestation.
    uint256 public activeAttested;

    event Attested(
        address indexed account,
        address indexed attester,
        Tier tier,
        uint16 jurisdiction,
        uint64 expiresAt,
        bytes32 recordHash
    );
    event AttestationRevoked(address indexed account, address indexed attester, string reason);
    event JurisdictionBlocked(uint16 indexed jurisdiction, bool blocked);

    error AlreadyActive(address account);
    error NotAttested(address account);
    error BlockedJurisdiction(uint16 jurisdiction);
    error InvalidExpiry();
    error InvalidTier();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ATTESTER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Attestation lifecycle
    // ---------------------------------------------------------------------

    /**
     * @notice Record a KYC attestation for `account`.
     * @param account     Wallet being verified.
     * @param recordHash  keccak256 of the off-chain KYC record.
     * @param evidenceURI IPFS URI of the encrypted evidence bundle.
     * @param jurisdiction ISO-3166-1 numeric country code of the holder.
     * @param tier        Investor classification.
     * @param expiresAt   Unix timestamp after which the attestation lapses.
     */
    function attest(
        address account,
        bytes32 recordHash,
        string calldata evidenceURI,
        uint16 jurisdiction,
        Tier tier,
        uint64 expiresAt
    ) external onlyRole(ATTESTER_ROLE) {
        if (tier == Tier.NONE) revert InvalidTier();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        if (jurisdictionBlocked[jurisdiction]) revert BlockedJurisdiction(jurisdiction);

        bool wasActive = isVerified(account);
        bool everAttested = _attestations[account].issuedAt != 0;

        _attestations[account] = Attestation({
            recordHash: recordHash,
            evidenceURI: evidenceURI,
            jurisdiction: jurisdiction,
            tier: tier,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            attester: msg.sender,
            revoked: false
        });

        if (!wasActive) activeAttested += 1;
        // `totalAttested` counts unique wallets ever verified — the figure we
        // report as "verifiable real users". Re-attesting never double-counts.
        if (!everAttested) totalAttested += 1;

        emit Attested(account, msg.sender, tier, jurisdiction, expiresAt, recordHash);
    }

    /// @notice Revoke an existing attestation (e.g. sanctions hit, expired documents).
    function revoke(address account, string calldata reason) external onlyRole(ATTESTER_ROLE) {
        Attestation storage a = _attestations[account];
        if (a.issuedAt == 0) revert NotAttested(account);

        bool wasActive = isVerified(account);
        a.revoked = true;
        if (wasActive && activeAttested > 0) activeAttested -= 1;

        emit AttestationRevoked(account, msg.sender, reason);
    }

    /// @notice Block or unblock an entire jurisdiction.
    function setJurisdictionBlocked(uint16 jurisdiction, bool blocked) external onlyRole(DEFAULT_ADMIN_ROLE) {
        jurisdictionBlocked[jurisdiction] = blocked;
        emit JurisdictionBlocked(jurisdiction, blocked);
    }

    // ---------------------------------------------------------------------
    // Views — consumed by RWAToken and MarketFactory
    // ---------------------------------------------------------------------

    /// @notice True when `account` holds a live attestation from a permitted jurisdiction.
    function isVerified(address account) public view returns (bool) {
        Attestation storage a = _attestations[account];
        return a.issuedAt != 0 && !a.revoked && a.expiresAt > block.timestamp
            && !jurisdictionBlocked[a.jurisdiction];
    }

    /// @notice True when `account` is verified at or above `minTier`.
    function isVerifiedAtLeast(address account, Tier minTier) external view returns (bool) {
        return isVerified(account) && _attestations[account].tier >= minTier;
    }

    function attestationOf(address account) external view returns (Attestation memory) {
        return _attestations[account];
    }

    function tierOf(address account) external view returns (Tier) {
        return isVerified(account) ? _attestations[account].tier : Tier.NONE;
    }
}
