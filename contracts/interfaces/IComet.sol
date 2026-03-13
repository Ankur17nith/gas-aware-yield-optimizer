// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IComet {
    function supply(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
}
