// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceValidationEngine} from "../interfaces/IPriceValidationEngine.sol";
import {IRWAAssetRegistry} from "../interfaces/IRWAAssetRegistry.sol";

/**
 * @title MarketFactory
 * @notice Permissionless creation of RWA perpetual markets.
 *
 * Anyone may propose a market. Nobody approves it. Instead the market must
 * *earn* activation: after a proposal is posted, its price feed has to survive
 * `requiredValidations` successful validation rounds spanning at least
 * `seasoningPeriod` seconds. Only then can the market be activated — and the
 * activation call itself is permissionless.
 *
 * This replaces the centralised listing committee that gates every other venue
 * with a mechanical, auditable, on-chain test.
 *
 * A refundable BNB bond makes proposal spam expensive without letting anyone
 * confiscate an honest proposer's funds: the bond is returned in full on both
 * activation and rejection.
 */
contract MarketFactory is AccessControl, ReentrancyGuard {
    bytes32 public constant MARKET_ADMIN_ROLE = keccak256("MARKET_ADMIN_ROLE");

    uint256 internal constant BPS = 10_000;

    enum Status {
        NONE,
        PROPOSED,
        ACTIVE,
        REJECTED,
        PAUSED,
        RETIRED
    }

    struct MarketConfig {
        uint16 maxLeverage; // e.g. 20 => 20x
        uint16 initialMarginBps; // e.g. 500 => 5%
        uint16 maintenanceMarginBps; // e.g. 250 => 2.5%
        uint256 tickSize; // 18 decimals
        uint256 minOrderSize; // 18 decimals
        string orderlySymbol; // symbol on the Orderly execution layer
    }

    struct Market {
        Status status;
        bytes32 assetId;
        bytes32 feedId;
        address proposer;
        uint256 bond;
        uint64 proposedAt;
        uint64 activatedAt;
        uint64 validationsAtProposal;
        MarketConfig config;
    }

    /// @notice Global bounds every proposal must fall within.
    struct Bounds {
        uint16 maxLeverageCap;
        uint16 minInitialMarginBps;
        uint16 minMaintenanceMarginBps;
        uint64 seasoningPeriod; // seconds a proposal must age
        uint64 requiredValidations; // successful feed validations during seasoning
        uint64 proposalTTL; // proposal expires if not activated within this window
        uint256 bondAmount; // refundable BNB bond
    }

    IPriceValidationEngine public immutable engine;
    IRWAAssetRegistry public immutable assetRegistry;

    Bounds public bounds;
    address public treasury;

    mapping(bytes32 marketId => Market) private _markets;
    bytes32[] private _marketIds;
    uint256 public activeMarkets;

    event MarketProposed(
        bytes32 indexed marketId,
        bytes32 indexed assetId,
        bytes32 indexed feedId,
        address proposer,
        MarketConfig config,
        uint256 bond
    );
    event MarketActivated(
        bytes32 indexed marketId, address indexed activatedBy, uint64 validationsObserved, string orderlySymbol
    );
    event MarketRejected(bytes32 indexed marketId, string reason);
    event MarketPaused(bytes32 indexed marketId, address indexed by, string reason);
    event MarketResumed(bytes32 indexed marketId, address indexed by);
    event BondRefunded(bytes32 indexed marketId, address indexed to, uint256 amount);
    event BoundsUpdated(Bounds bounds);
    event TreasuryUpdated(address indexed previous, address indexed current);

    error MarketExists(bytes32 marketId);
    error UnknownMarket(bytes32 marketId);
    error AssetNotActive(bytes32 assetId);
    error FeedNotTradable(bytes32 feedId);
    error ConfigOutOfBounds();
    error IncorrectBond(uint256 sent, uint256 required);
    error WrongStatus(Status actual, Status expected);
    error SeasoningIncomplete(uint64 elapsed, uint64 required);
    error InsufficientValidations(uint64 observed, uint64 required);
    error ProposalExpired(bytes32 marketId);
    error MarketStillHealthy(bytes32 marketId);
    error NotProposer(address caller);
    error TransferFailed();
    error ZeroAddress();

    constructor(address admin, address engine_, address assetRegistry_, address treasury_, Bounds memory bounds_) {
        if (engine_ == address(0) || assetRegistry_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        engine = IPriceValidationEngine(engine_);
        assetRegistry = IRWAAssetRegistry(assetRegistry_);
        treasury = treasury_;
        bounds = bounds_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MARKET_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Proposal → seasoning → activation
    // ---------------------------------------------------------------------

    /**
     * @notice Propose a new RWA perp market. Permissionless; requires a bond.
     * @dev The market is not tradable yet — it must season first. See {activateMarket}.
     */
    function proposeMarket(bytes32 assetId, bytes32 feedId, MarketConfig calldata config)
        external
        payable
        nonReentrant
        returns (bytes32 marketId)
    {
        marketId = computeMarketId(assetId, feedId);
        if (_markets[marketId].status != Status.NONE) revert MarketExists(marketId);

        // Asset must be live and backed by a fresh custody attestation.
        if (!assetRegistry.isMintable(assetId)) revert AssetNotActive(assetId);
        // Feed must already be producing validated prices.
        if (!engine.isTradable(feedId)) revert FeedNotTradable(feedId);

        _checkConfig(config);
        if (msg.value != bounds.bondAmount) revert IncorrectBond(msg.value, bounds.bondAmount);

        _markets[marketId] = Market({
            status: Status.PROPOSED,
            assetId: assetId,
            feedId: feedId,
            proposer: msg.sender,
            bond: msg.value,
            proposedAt: uint64(block.timestamp),
            activatedAt: 0,
            validationsAtProposal: engine.validationCount(feedId),
            config: config
        });
        _marketIds.push(marketId);

        emit MarketProposed(marketId, assetId, feedId, msg.sender, config, msg.value);
    }

    /**
     * @notice Activate a seasoned proposal. Permissionless — the contract, not a
     *         committee, decides whether the market qualifies.
     */
    function activateMarket(bytes32 marketId) external nonReentrant {
        Market storage m = _requireMarket(marketId);
        if (m.status != Status.PROPOSED) revert WrongStatus(m.status, Status.PROPOSED);

        uint64 elapsed = uint64(block.timestamp) - m.proposedAt;
        if (elapsed > bounds.proposalTTL) revert ProposalExpired(marketId);
        if (elapsed < bounds.seasoningPeriod) {
            revert SeasoningIncomplete(elapsed, bounds.seasoningPeriod);
        }

        uint64 observed = engine.validationCount(m.feedId) - m.validationsAtProposal;
        if (observed < bounds.requiredValidations) {
            revert InsufficientValidations(observed, bounds.requiredValidations);
        }

        // The feed must still be healthy right now, and the asset still backed.
        if (!engine.isTradable(m.feedId)) revert FeedNotTradable(m.feedId);
        if (!assetRegistry.isMintable(m.assetId)) revert AssetNotActive(m.assetId);

        m.status = Status.ACTIVE;
        m.activatedAt = uint64(block.timestamp);
        activeMarkets += 1;

        emit MarketActivated(marketId, msg.sender, observed, m.config.orderlySymbol);
        _refundBond(marketId, m);
    }

    /**
     * @notice Close out a proposal that failed to season within its TTL, or whose
     *         underlying feed/asset has since gone bad. Permissionless.
     */
    function rejectStaleProposal(bytes32 marketId) external nonReentrant {
        Market storage m = _requireMarket(marketId);
        if (m.status != Status.PROPOSED) revert WrongStatus(m.status, Status.PROPOSED);

        bool expired = uint64(block.timestamp) - m.proposedAt > bounds.proposalTTL;
        bool feedDead = !engine.isTradable(m.feedId);
        bool assetDead = !assetRegistry.isMintable(m.assetId);
        if (!expired && !feedDead && !assetDead) revert MarketStillHealthy(marketId);

        m.status = Status.REJECTED;
        emit MarketRejected(marketId, expired ? "proposal expired" : (feedDead ? "feed unhealthy" : "asset unbacked"));
        _refundBond(marketId, m);
    }

    // ---------------------------------------------------------------------
    // Monitoring & safety
    // ---------------------------------------------------------------------

    /**
     * @notice Halt an active market whose price feed has stopped validating.
     * @dev Permissionless by design: anyone who observes the anomaly can protect
     *      the market without waiting for the team. This is the on-chain half of
     *      the "Monitoring & Safety" layer.
     */
    function pauseUnhealthyMarket(bytes32 marketId) external {
        Market storage m = _requireMarket(marketId);
        if (m.status != Status.ACTIVE) revert WrongStatus(m.status, Status.ACTIVE);
        if (engine.isTradable(m.feedId) && assetRegistry.isMintable(m.assetId)) {
            revert MarketStillHealthy(marketId);
        }

        m.status = Status.PAUSED;
        activeMarkets -= 1;
        emit MarketPaused(marketId, msg.sender, "feed or asset unhealthy");
    }

    /// @notice Operator halt for reasons the contract cannot observe (legal, ops).
    function pauseMarket(bytes32 marketId, string calldata reason) external onlyRole(MARKET_ADMIN_ROLE) {
        Market storage m = _requireMarket(marketId);
        if (m.status != Status.ACTIVE) revert WrongStatus(m.status, Status.ACTIVE);
        m.status = Status.PAUSED;
        activeMarkets -= 1;
        emit MarketPaused(marketId, msg.sender, reason);
    }

    /// @notice Resume a paused market once its feed is healthy again.
    function resumeMarket(bytes32 marketId) external onlyRole(MARKET_ADMIN_ROLE) {
        Market storage m = _requireMarket(marketId);
        if (m.status != Status.PAUSED) revert WrongStatus(m.status, Status.PAUSED);
        if (!engine.isTradable(m.feedId)) revert FeedNotTradable(m.feedId);

        m.status = Status.ACTIVE;
        activeMarkets += 1;
        emit MarketResumed(marketId, msg.sender);
    }

    function retireMarket(bytes32 marketId, string calldata reason) external onlyRole(MARKET_ADMIN_ROLE) {
        Market storage m = _requireMarket(marketId);
        if (m.status == Status.ACTIVE) activeMarkets -= 1;
        m.status = Status.RETIRED;
        emit MarketRejected(marketId, reason);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setBounds(Bounds calldata newBounds) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bounds = newBounds;
        emit BoundsUpdated(newBounds);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _refundBond(bytes32 marketId, Market storage m) private {
        uint256 amount = m.bond;
        if (amount == 0) return;
        m.bond = 0;

        (bool sent,) = payable(m.proposer).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit BondRefunded(marketId, m.proposer, amount);
    }

    function _checkConfig(MarketConfig calldata c) private view {
        if (c.maxLeverage == 0 || c.maxLeverage > bounds.maxLeverageCap) revert ConfigOutOfBounds();
        if (c.initialMarginBps < bounds.minInitialMarginBps) revert ConfigOutOfBounds();
        if (c.maintenanceMarginBps < bounds.minMaintenanceMarginBps) revert ConfigOutOfBounds();
        if (c.maintenanceMarginBps >= c.initialMarginBps) revert ConfigOutOfBounds();
        if (c.initialMarginBps > BPS) revert ConfigOutOfBounds();
        if (c.tickSize == 0 || c.minOrderSize == 0) revert ConfigOutOfBounds();
        if (bytes(c.orderlySymbol).length == 0) revert ConfigOutOfBounds();
    }

    function _requireMarket(bytes32 marketId) private view returns (Market storage m) {
        m = _markets[marketId];
        if (m.status == Status.NONE) revert UnknownMarket(marketId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function computeMarketId(bytes32 assetId, bytes32 feedId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(assetId, feedId));
    }

    function getMarket(bytes32 marketId) external view returns (Market memory) {
        return _requireMarket(marketId);
    }

    /// @notice Seasoning progress for a pending proposal, for UI countdowns.
    function activationProgress(bytes32 marketId)
        external
        view
        returns (uint64 elapsed, uint64 seasoningRequired, uint64 validationsObserved, uint64 validationsRequired, bool ready)
    {
        Market storage m = _requireMarket(marketId);
        elapsed = uint64(block.timestamp) - m.proposedAt;
        seasoningRequired = bounds.seasoningPeriod;
        validationsObserved = engine.validationCount(m.feedId) - m.validationsAtProposal;
        validationsRequired = bounds.requiredValidations;
        ready = m.status == Status.PROPOSED && elapsed >= seasoningRequired
            && validationsObserved >= validationsRequired && elapsed <= bounds.proposalTTL
            && engine.isTradable(m.feedId) && assetRegistry.isMintable(m.assetId);
    }

    function marketCount() external view returns (uint256) {
        return _marketIds.length;
    }

    function marketIdAt(uint256 index) external view returns (bytes32) {
        return _marketIds[index];
    }

    function statusOf(bytes32 marketId) external view returns (Status) {
        return _markets[marketId].status;
    }
}
