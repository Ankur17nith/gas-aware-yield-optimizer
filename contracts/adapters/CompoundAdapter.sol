// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../interfaces/IComet.sol";
import "../libraries/SafeTransfer.sol";

/// @title CompoundAdapter
/// @notice Adapter for Compound V3 Comet markets.
///         Router transfers underlying into this contract, then this adapter
///         supplies and withdraws funds on behalf of the Router workflow.
contract CompoundAdapter {
    using SafeTransfer for IERC20;

    IComet public immutable comet;
    address public immutable router;

    error OnlyRouter();
    error ZeroAddress();
    error ZeroAmount();

    event Deposited(address indexed token, address indexed user, uint256 amount);
    event Withdrawn(address indexed token, address indexed user, uint256 amount);

    modifier onlyRouter() {
        if (msg.sender != router) revert OnlyRouter();
        _;
    }

    constructor(address _comet, address _router) {
        if (_comet == address(0) || _router == address(0)) revert ZeroAddress();
        comet = IComet(_comet);
        router = _router;
    }

    function deposit(
        address token,
        uint256 amount,
        address user
    ) external onlyRouter {
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeApprove(address(comet), amount);
        comet.supply(token, amount);

        emit Deposited(token, user, amount);
    }

    function withdraw(
        address token,
        uint256 amount,
        address user
    ) external onlyRouter returns (uint256 withdrawn) {
        if (amount == 0) revert ZeroAmount();

        comet.withdraw(token, amount);
        IERC20(token).safeTransfer(user, amount);

        withdrawn = amount;
        emit Withdrawn(token, user, withdrawn);
    }
}
