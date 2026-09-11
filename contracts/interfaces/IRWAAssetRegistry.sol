// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Consumer-side view of {RWAAssetRegistry}.
interface IRWAAssetRegistry {
    function isMintable(bytes32 assetId) external view returns (bool);
    function attestedUnits(bytes32 assetId) external view returns (uint256);
    function statusOf(bytes32 assetId) external view returns (uint8);
}
