// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Consumer-side view of {PriceValidationEngine}.
interface IPriceValidationEngine {
    function getPrice(bytes32 feedId) external view returns (uint256 price, uint64 validatedAt);
    function isTradable(bytes32 feedId) external view returns (bool);
    function validationCount(bytes32 feedId) external view returns (uint64);
}
