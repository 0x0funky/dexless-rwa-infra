// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

/**
 * @title FeeDistributor
 * @notice Distributes RWA yield and market fees to entitled holders in rounds.
 *
 * Each round pins an IPFS snapshot of the full entitlement table together with
 * its Merkle root, so any holder can independently recompute the root from the
 * published snapshot and prove the operator did not tamper with allocations.
 * Holders then pull their own share — one on-chain claim per wallet, which is
 * exactly the kind of genuine multi-wallet business activity the market should
 * exhibit.
 *
 * Unclaimed funds can be swept back to the treasury only after the round's
 * claim window has closed.
 */
contract FeeDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using BitMaps for BitMaps.BitMap;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    struct Round {
        bytes32 merkleRoot;
        address token; // asset paid out (e.g. USDT on BNB Chain)
        uint256 totalAmount;
        uint256 claimedAmount;
        uint64 snapshotBlock; // block at which holder balances were snapshotted
        uint64 opensAt;
        uint64 closesAt;
        bool swept;
        string snapshotURI; // ipfs://... full entitlement table
    }

    Round[] private _rounds;
    mapping(uint256 roundId => BitMaps.BitMap) private _claimed;

    address public treasury;

    /// @notice Lifetime number of individual holder claims — a real-user activity metric.
    uint256 public totalClaims;

    event RoundOpened(
        uint256 indexed roundId,
        address indexed token,
        uint256 totalAmount,
        bytes32 merkleRoot,
        uint64 snapshotBlock,
        uint64 opensAt,
        uint64 closesAt,
        string snapshotURI
    );
    event Claimed(uint256 indexed roundId, uint256 indexed index, address indexed account, uint256 amount);
    event RoundSwept(uint256 indexed roundId, address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed previous, address indexed current);

    error UnknownRound(uint256 roundId);
    error RoundNotOpen(uint256 roundId);
    error RoundClosed(uint256 roundId);
    error RoundStillOpen(uint256 roundId);
    error AlreadyClaimed(uint256 roundId, uint256 index);
    error InvalidProof();
    error AlreadySwept(uint256 roundId);
    error InvalidWindow();
    error ZeroAddress();
    error ZeroAmount();

    constructor(address admin, address treasury_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Distribution
    // ---------------------------------------------------------------------

    /**
     * @notice Fund and open a distribution round.
     * @dev Leaf encoding is `keccak256(abi.encode(index, account, amount))`.
     *      The caller must have approved `totalAmount` of `token` to this contract.
     */
    function openRound(
        address token,
        uint256 totalAmount,
        bytes32 merkleRoot,
        uint64 snapshotBlock,
        uint64 opensAt,
        uint64 closesAt,
        string calldata snapshotURI
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant returns (uint256 roundId) {
        if (token == address(0)) revert ZeroAddress();
        if (totalAmount == 0) revert ZeroAmount();
        if (closesAt <= opensAt || closesAt <= block.timestamp) revert InvalidWindow();

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        _rounds.push(
            Round({
                merkleRoot: merkleRoot,
                token: token,
                totalAmount: totalAmount,
                claimedAmount: 0,
                snapshotBlock: snapshotBlock,
                opensAt: opensAt,
                closesAt: closesAt,
                swept: false,
                snapshotURI: snapshotURI
            })
        );
        roundId = _rounds.length - 1;

        emit RoundOpened(
            roundId, token, totalAmount, merkleRoot, snapshotBlock, opensAt, closesAt, snapshotURI
        );
    }

    /// @notice Claim an entitlement. Anyone may submit on a holder's behalf; funds always go to `account`.
    function claim(uint256 roundId, uint256 index, address account, uint256 amount, bytes32[] calldata proof)
        external
        nonReentrant
    {
        if (roundId >= _rounds.length) revert UnknownRound(roundId);
        Round storage r = _rounds[roundId];

        if (block.timestamp < r.opensAt) revert RoundNotOpen(roundId);
        if (block.timestamp > r.closesAt) revert RoundClosed(roundId);
        if (_claimed[roundId].get(index)) revert AlreadyClaimed(roundId, index);

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
        if (!MerkleProof.verify(proof, r.merkleRoot, leaf)) revert InvalidProof();

        _claimed[roundId].set(index);
        r.claimedAmount += amount;
        totalClaims += 1;

        IERC20(r.token).safeTransfer(account, amount);
        emit Claimed(roundId, index, account, amount);
    }

    /// @notice Return unclaimed funds to the treasury once the window has closed.
    function sweep(uint256 roundId) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        if (roundId >= _rounds.length) revert UnknownRound(roundId);
        Round storage r = _rounds[roundId];
        if (block.timestamp <= r.closesAt) revert RoundStillOpen(roundId);
        if (r.swept) revert AlreadySwept(roundId);

        r.swept = true;
        uint256 remaining = r.totalAmount - r.claimedAmount;
        if (remaining > 0) {
            IERC20(r.token).safeTransfer(treasury, remaining);
        }
        emit RoundSwept(roundId, treasury, remaining);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function isClaimed(uint256 roundId, uint256 index) external view returns (bool) {
        return _claimed[roundId].get(index);
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        if (roundId >= _rounds.length) revert UnknownRound(roundId);
        return _rounds[roundId];
    }

    function roundCount() external view returns (uint256) {
        return _rounds.length;
    }

    /// @notice Recompute a leaf off-chain-compatibly, for SDK and UI use.
    function leafOf(uint256 index, address account, uint256 amount) external pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
    }
}
