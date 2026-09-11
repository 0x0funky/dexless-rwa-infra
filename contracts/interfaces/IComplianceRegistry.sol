// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Consumer-side view of {ComplianceRegistry}.
interface IComplianceRegistry {
    function isVerified(address account) external view returns (bool);
    function isVerifiedAtLeast(address account, uint8 minTier) external view returns (bool);
    function totalAttested() external view returns (uint256);
}
