// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PriceValidationEngine
 * @notice DEXless's core thesis, implemented on-chain: *we do not trust prices,
 *         we validate markets*.
 *
 * Exotic and real-world assets have no single reliable price. Instead of
 * consuming one oracle and hoping, this engine ingests quotes from several
 * independent classes of source (market-maker desks, CEX books, DEX pools,
 * third-party oracles) and admits a price only when the whole set agrees.
 *
 * Five checks run on every validation, mirroring the architecture slide:
 *   1. Freshness           — quote age <= maxStaleness
 *   2. Spread control      — (ask - bid) / mid <= maxSpreadBps
 *   3. Depth verification  — quoted depth >= minDepth
 *   4. Deviation check     — |price - median| / median <= maxDeviationBps
 *   5. Cross-source consistency — at least `minSources` survivors, spanning
 *                                 at least `minDistinctKinds` source classes
 *
 * A feed that fails `failuresToPause` times in a row pauses itself and stops
 * serving prices to downstream markets. Resuming is a deliberate admin action.
 *
 * Every `submitQuote` is a real business transaction: it is the off-chain
 * pricing pipeline writing state that markets depend on.
 */
contract PriceValidationEngine is AccessControl {
    bytes32 public constant FEED_ADMIN_ROLE = keccak256("FEED_ADMIN_ROLE");

    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_SOURCES = 12;

    /// @notice Independent classes of price origin. Diversity across kinds is enforced.
    enum SourceKind {
        MM_QUOTE, // market maker / trading desk RFQ
        CEX, // centralised exchange order book
        DEX, // on-chain AMM or order book
        ORACLE, // third-party oracle network
        NAV // fund administrator NAV (e.g. JEPUN)
    }

    /// @notice Why a source was dropped from a validation round.
    enum RejectReason {
        NONE,
        NO_QUOTE,
        STALE,
        SPREAD_TOO_WIDE,
        INSUFFICIENT_DEPTH,
        DEVIATION_EXCEEDED
    }

    /// @notice Why a whole validation round failed.
    enum FailureReason {
        NONE,
        TOO_FEW_SOURCES,
        TOO_FEW_SOURCE_KINDS
    }

    struct Source {
        SourceKind kind;
        bool active;
        address reporter;
        string name;
    }

    struct Quote {
        uint256 price; // mid price, 18 decimals
        uint256 bid; // 18 decimals, 0 if not applicable (e.g. NAV)
        uint256 ask; // 18 decimals, 0 if not applicable
        uint256 depth; // quotable notional at this price, 18 decimals
        uint64 observedAt; // when the source produced the quote
        uint64 receivedAt; // when it landed on-chain
    }

    struct RiskConfig {
        uint32 maxDeviationBps; // e.g. 200 = 2% from median
        uint32 maxSpreadBps; // e.g. 50 = 0.5%
        uint32 maxStaleness; // seconds
        uint256 minDepth; // 18 decimals
        uint8 minSources; // survivors required
        uint8 minDistinctKinds; // source classes required among survivors
        uint8 failuresToPause;
    }

    struct ValidatedPrice {
        uint256 price;
        uint64 validatedAt;
        uint8 sourceCount;
    }

    struct Feed {
        bool exists;
        bool paused;
        uint8 consecutiveFailures;
        uint64 validationCount; // successful rounds, used to season new markets
        string description; // e.g. "XAU/USD" or "JEPUN-MMF/USD"
        RiskConfig risk;
        ValidatedPrice last;
    }

    mapping(bytes32 feedId => Feed) private _feeds;
    mapping(bytes32 feedId => Source[]) private _sources;
    mapping(bytes32 feedId => mapping(address reporter => uint256 indexPlusOne)) private _sourceIndex;
    mapping(bytes32 feedId => mapping(uint256 sourceIndex => Quote)) private _quotes;
    bytes32[] private _feedIds;

    /// @notice Lifetime count of accepted quote submissions across all feeds.
    uint256 public totalQuotesSubmitted;
    /// @notice Lifetime count of successful validation rounds across all feeds.
    uint256 public totalValidations;

    event FeedCreated(bytes32 indexed feedId, string description, RiskConfig risk);
    event RiskConfigUpdated(bytes32 indexed feedId, RiskConfig risk);
    event SourceAdded(bytes32 indexed feedId, address indexed reporter, SourceKind indexed kind, string name);
    event SourceStatusChanged(bytes32 indexed feedId, address indexed reporter, bool active);
    event QuoteSubmitted(
        bytes32 indexed feedId,
        address indexed reporter,
        SourceKind indexed kind,
        uint256 price,
        uint256 bid,
        uint256 ask,
        uint256 depth,
        uint64 observedAt
    );
    event SourceRejected(bytes32 indexed feedId, address indexed reporter, RejectReason indexed reason);
    event PriceValidated(
        bytes32 indexed feedId, uint256 price, uint8 sourceCount, uint8 distinctKinds, uint64 validatedAt
    );
    event ValidationFailed(bytes32 indexed feedId, FailureReason indexed reason, uint8 survivors);
    event FeedPaused(bytes32 indexed feedId, string reason);
    event FeedResumed(bytes32 indexed feedId, address indexed by);

    error FeedExists(bytes32 feedId);
    error UnknownFeed(bytes32 feedId);
    error NotASource(bytes32 feedId, address reporter);
    error SourceExists(bytes32 feedId, address reporter);
    error TooManySources();
    error InvalidRiskConfig();
    error InvalidQuote();
    error FeedIsPaused(bytes32 feedId);
    error NoValidPrice(bytes32 feedId);
    error StalePrice(bytes32 feedId, uint64 validatedAt);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEED_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Feed & source administration
    // ---------------------------------------------------------------------

    function createFeed(bytes32 feedId, string calldata description, RiskConfig calldata risk)
        external
        onlyRole(FEED_ADMIN_ROLE)
    {
        if (_feeds[feedId].exists) revert FeedExists(feedId);
        _validateRiskConfig(risk);

        Feed storage f = _feeds[feedId];
        f.exists = true;
        f.description = description;
        f.risk = risk;
        _feedIds.push(feedId);

        emit FeedCreated(feedId, description, risk);
    }

    function setRiskConfig(bytes32 feedId, RiskConfig calldata risk) external onlyRole(FEED_ADMIN_ROLE) {
        _requireFeed(feedId);
        _validateRiskConfig(risk);
        _feeds[feedId].risk = risk;
        emit RiskConfigUpdated(feedId, risk);
    }

    function addSource(bytes32 feedId, address reporter, SourceKind kind, string calldata name)
        external
        onlyRole(FEED_ADMIN_ROLE)
    {
        _requireFeed(feedId);
        if (_sourceIndex[feedId][reporter] != 0) revert SourceExists(feedId, reporter);
        if (_sources[feedId].length >= MAX_SOURCES) revert TooManySources();

        _sources[feedId].push(Source({kind: kind, active: true, reporter: reporter, name: name}));
        _sourceIndex[feedId][reporter] = _sources[feedId].length; // 1-based

        emit SourceAdded(feedId, reporter, kind, name);
    }

    function setSourceActive(bytes32 feedId, address reporter, bool active) external onlyRole(FEED_ADMIN_ROLE) {
        uint256 idx = _sourceIndex[feedId][reporter];
        if (idx == 0) revert NotASource(feedId, reporter);
        _sources[feedId][idx - 1].active = active;
        emit SourceStatusChanged(feedId, reporter, active);
    }

    /// @notice Clear the paused flag after an operator has investigated.
    function resumeFeed(bytes32 feedId) external onlyRole(FEED_ADMIN_ROLE) {
        _requireFeed(feedId);
        _feeds[feedId].paused = false;
        _feeds[feedId].consecutiveFailures = 0;
        emit FeedResumed(feedId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Quote ingestion
    // ---------------------------------------------------------------------

    /**
     * @notice A registered source publishes its latest observation.
     * @dev Called continuously by the off-chain pricing pipeline. Quotes are
     *      stored regardless of quality; the filters run at validation time so
     *      that rejections are observable on-chain rather than silently dropped.
     */
    function submitQuote(
        bytes32 feedId,
        uint256 price,
        uint256 bid,
        uint256 ask,
        uint256 depth,
        uint64 observedAt
    ) public {
        uint256 idx = _sourceIndex[feedId][msg.sender];
        if (idx == 0) revert NotASource(feedId, msg.sender);
        if (price == 0 || observedAt == 0 || observedAt > block.timestamp + 60) revert InvalidQuote();
        if (bid != 0 && ask != 0 && ask < bid) revert InvalidQuote();

        _quotes[feedId][idx - 1] = Quote({
            price: price,
            bid: bid,
            ask: ask,
            depth: depth,
            observedAt: observedAt,
            receivedAt: uint64(block.timestamp)
        });
        totalQuotesSubmitted += 1;

        emit QuoteSubmitted(
            feedId, msg.sender, _sources[feedId][idx - 1].kind, price, bid, ask, depth, observedAt
        );
    }

    /// @notice Submit and immediately run a validation round — one transaction per update.
    function submitQuoteAndValidate(
        bytes32 feedId,
        uint256 price,
        uint256 bid,
        uint256 ask,
        uint256 depth,
        uint64 observedAt
    ) external returns (bool validated) {
        submitQuote(feedId, price, bid, ask, depth, observedAt);
        return validate(feedId);
    }

    // ---------------------------------------------------------------------
    // Validation — the core engine
    // ---------------------------------------------------------------------

    /**
     * @notice Run a validation round for `feedId`. Permissionless: anyone may
     *         trigger it, the outcome depends only on stored quotes.
     * @return ok True when a new validated price was written.
     */
    function validate(bytes32 feedId) public returns (bool ok) {
        Feed storage f = _feeds[feedId];
        if (!f.exists) revert UnknownFeed(feedId);

        Source[] storage srcs = _sources[feedId];
        RiskConfig memory risk = f.risk;

        uint256[] memory prices = new uint256[](srcs.length);
        uint256[] memory idxs = new uint256[](srcs.length);
        uint256 n;

        // --- Pass 1: per-source quality filters -------------------------------
        for (uint256 i; i < srcs.length; ++i) {
            if (!srcs[i].active) continue;

            Quote storage q = _quotes[feedId][i];
            RejectReason reason = _screenQuote(q, risk);
            if (reason != RejectReason.NONE) {
                emit SourceRejected(feedId, srcs[i].reporter, reason);
                continue;
            }

            prices[n] = q.price;
            idxs[n] = i;
            unchecked {
                ++n;
            }
        }

        if (n < risk.minSources) return _recordFailure(feedId, f, FailureReason.TOO_FEW_SOURCES, uint8(n));

        // --- Pass 2: deviation against the provisional median ------------------
        uint256 provisional = _median(prices, n);
        uint256 kept;
        for (uint256 i; i < n; ++i) {
            if (_deviationBps(prices[i], provisional) > risk.maxDeviationBps) {
                emit SourceRejected(feedId, srcs[idxs[i]].reporter, RejectReason.DEVIATION_EXCEEDED);
                continue;
            }
            prices[kept] = prices[i];
            idxs[kept] = idxs[i];
            unchecked {
                ++kept;
            }
        }

        if (kept < risk.minSources) return _recordFailure(feedId, f, FailureReason.TOO_FEW_SOURCES, uint8(kept));

        // --- Pass 3: cross-source consistency (diversity of origin) ------------
        uint8 distinctKinds = _countDistinctKinds(srcs, idxs, kept);
        if (distinctKinds < risk.minDistinctKinds) {
            return _recordFailure(feedId, f, FailureReason.TOO_FEW_SOURCE_KINDS, uint8(kept));
        }

        // --- Accept ------------------------------------------------------------
        uint256 finalPrice = _median(prices, kept);
        f.last = ValidatedPrice({
            price: finalPrice,
            validatedAt: uint64(block.timestamp),
            sourceCount: uint8(kept)
        });
        f.consecutiveFailures = 0;
        f.validationCount += 1;
        totalValidations += 1;

        emit PriceValidated(feedId, finalPrice, uint8(kept), distinctKinds, uint64(block.timestamp));
        return true;
    }

    function _screenQuote(Quote storage q, RiskConfig memory risk) private view returns (RejectReason) {
        if (q.observedAt == 0) return RejectReason.NO_QUOTE;
        if (block.timestamp > q.observedAt && block.timestamp - q.observedAt > risk.maxStaleness) {
            return RejectReason.STALE;
        }
        if (q.depth < risk.minDepth) return RejectReason.INSUFFICIENT_DEPTH;
        // A zero bid/ask means the source does not quote two-sided (e.g. a NAV
        // print); the spread check simply does not apply to it.
        if (q.bid != 0 && q.ask != 0) {
            uint256 mid = (q.bid + q.ask) / 2;
            if (mid == 0) return RejectReason.SPREAD_TOO_WIDE;
            if (((q.ask - q.bid) * BPS) / mid > risk.maxSpreadBps) return RejectReason.SPREAD_TOO_WIDE;
        }
        return RejectReason.NONE;
    }

    function _recordFailure(bytes32 feedId, Feed storage f, FailureReason reason, uint8 survivors)
        private
        returns (bool)
    {
        emit ValidationFailed(feedId, reason, survivors);

        unchecked {
            if (f.consecutiveFailures < type(uint8).max) f.consecutiveFailures += 1;
        }
        if (!f.paused && f.consecutiveFailures >= f.risk.failuresToPause) {
            f.paused = true;
            emit FeedPaused(feedId, "consecutive validation failures");
        }
        return false;
    }

    function _countDistinctKinds(Source[] storage srcs, uint256[] memory idxs, uint256 count)
        private
        view
        returns (uint8 distinct)
    {
        uint256 seen; // bitmask over SourceKind
        for (uint256 i; i < count; ++i) {
            uint256 bit = 1 << uint8(srcs[idxs[i]].kind);
            if (seen & bit == 0) {
                seen |= bit;
                unchecked {
                    ++distinct;
                }
            }
        }
    }

    /// @dev Insertion sort + median. `count` is bounded by MAX_SOURCES.
    function _median(uint256[] memory values, uint256 count) private pure returns (uint256) {
        uint256[] memory a = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            a[i] = values[i];
        }
        for (uint256 i = 1; i < count; ++i) {
            uint256 key = a[i];
            uint256 j = i;
            while (j > 0 && a[j - 1] > key) {
                a[j] = a[j - 1];
                unchecked {
                    --j;
                }
            }
            a[j] = key;
        }
        if (count % 2 == 1) return a[count / 2];
        return (a[count / 2 - 1] + a[count / 2]) / 2;
    }

    function _deviationBps(uint256 value, uint256 ref) private pure returns (uint256) {
        if (ref == 0) return type(uint256).max;
        uint256 diff = value > ref ? value - ref : ref - value;
        return (diff * BPS) / ref;
    }

    function _validateRiskConfig(RiskConfig calldata risk) private pure {
        if (risk.minSources == 0 || risk.minSources > MAX_SOURCES) revert InvalidRiskConfig();
        if (risk.minDistinctKinds == 0 || risk.minDistinctKinds > risk.minSources) revert InvalidRiskConfig();
        if (risk.maxDeviationBps == 0 || risk.maxDeviationBps > BPS) revert InvalidRiskConfig();
        if (risk.maxSpreadBps == 0 || risk.maxSpreadBps > BPS) revert InvalidRiskConfig();
        if (risk.maxStaleness == 0) revert InvalidRiskConfig();
        if (risk.failuresToPause == 0) revert InvalidRiskConfig();
    }

    function _requireFeed(bytes32 feedId) private view {
        if (!_feeds[feedId].exists) revert UnknownFeed(feedId);
    }

    // ---------------------------------------------------------------------
    // Consumer API
    // ---------------------------------------------------------------------

    /**
     * @notice Latest validated price. Reverts unless the feed is live and fresh —
     *         downstream markets must never trade on a lapsed price.
     */
    function getPrice(bytes32 feedId) external view returns (uint256 price, uint64 validatedAt) {
        Feed storage f = _feeds[feedId];
        if (!f.exists) revert UnknownFeed(feedId);
        if (f.paused) revert FeedIsPaused(feedId);
        if (f.last.validatedAt == 0) revert NoValidPrice(feedId);
        if (block.timestamp - f.last.validatedAt > f.risk.maxStaleness) {
            revert StalePrice(feedId, f.last.validatedAt);
        }
        return (f.last.price, f.last.validatedAt);
    }

    /// @notice Non-reverting read for UIs and analytics.
    function peekPrice(bytes32 feedId)
        external
        view
        returns (uint256 price, uint64 validatedAt, uint8 sourceCount, bool paused, bool fresh)
    {
        Feed storage f = _feeds[feedId];
        ValidatedPrice memory v = f.last;
        fresh = v.validatedAt != 0 && block.timestamp - v.validatedAt <= f.risk.maxStaleness;
        return (v.price, v.validatedAt, v.sourceCount, f.paused, fresh);
    }

    /// @notice True when a market may rely on this feed right now.
    function isTradable(bytes32 feedId) external view returns (bool) {
        Feed storage f = _feeds[feedId];
        return f.exists && !f.paused && f.last.validatedAt != 0
            && block.timestamp - f.last.validatedAt <= f.risk.maxStaleness;
    }

    function getFeed(bytes32 feedId)
        external
        view
        returns (string memory description, RiskConfig memory risk, ValidatedPrice memory last, bool paused)
    {
        Feed storage f = _feeds[feedId];
        if (!f.exists) revert UnknownFeed(feedId);
        return (f.description, f.risk, f.last, f.paused);
    }

    function getSources(bytes32 feedId) external view returns (Source[] memory) {
        return _sources[feedId];
    }

    function getQuote(bytes32 feedId, address reporter) external view returns (Quote memory) {
        uint256 idx = _sourceIndex[feedId][reporter];
        if (idx == 0) revert NotASource(feedId, reporter);
        return _quotes[feedId][idx - 1];
    }

    /// @notice Successful validation rounds for this feed since creation.
    function validationCount(bytes32 feedId) external view returns (uint64) {
        return _feeds[feedId].validationCount;
    }

    function feedCount() external view returns (uint256) {
        return _feedIds.length;
    }

    function feedIdAt(uint256 index) external view returns (bytes32) {
        return _feedIds[index];
    }
}
