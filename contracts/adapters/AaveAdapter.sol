// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../interfaces/IAavePool.sol";
import "../libraries/SafeTransfer.sol";

/// @title AaveAdapter
/// @notice Adapter contract for depositing into and withdrawing from Aave V3.
///         Acts as a standardized interface that the Router calls.
contract AaveAdapter {
    using SafeTransfer for IERC20;

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    IAavePool public immutable aavePool;
    address public immutable router;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error OnlyRouter();
    error ZeroAmount();
    error ZeroAddress();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposited(
        address indexed token,
        address indexed user,
        uint256 amount
    );

    event Withdrawn(
        address indexed token,
        address indexed user,
        uint256 amount
    );

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyRouter() {
        if (msg.sender != router) revert OnlyRouter();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @param _aavePool Address of the Aave V3 Pool contract
    /// @param _router   Address of the Router contract
    constructor(address _aavePool, address _router) {
        if (_aavePool == address(0) || _router == address(0))
            revert ZeroAddress();
        aavePool = IAavePool(_aavePool);
        router = _router;
    }

    // ──────────────────────────────────────────────
    //  External Functions
    // ──────────────────────────────────────────────

    /// @notice Deposits tokens into Aave V3 on behalf of the user.
    ///         The Router must have already transferred tokens to this contract.
    /// @param token  The stablecoin address (USDC, DAI, USDT)
    /// @param amount The amount of tokens to deposit
    /// @param user   The end-user who owns the position
    function deposit(
        address token,
        uint256 amount,
        address user
    ) external onlyRouter {
        if (amount == 0) revert ZeroAmount();

        // Approve Aave Pool to spend tokens
        IERC20(token).safeApprove(address(aavePool), amount);

        // Supply to Aave — aTokens go to the user directly
        aavePool.supply(token, amount, user, 0);

        emit Deposited(token, user, amount);
    }

    /// @notice Withdraws tokens from Aave V3 back to the user.
    ///         Requires the user to have approved this contract to spend aTokens.
    /// @param token  The underlying stablecoin address
    /// @param amount The amount to withdraw (use type(uint256).max for full)
    /// @param user   The end-user who owns the position
    /// @return withdrawn The actual amount withdrawn
    function withdraw(
        address token,
        uint256 amount,
        address user
    ) external onlyRouter returns (uint256 withdrawn) {
        if (amount == 0) revert ZeroAmount();

        // Withdraw from Aave — tokens go directly to the user
        withdrawn = aavePool.withdraw(token, amount, user);

        emit Withdrawn(token, user, withdrawn);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Returns the current liquidity rate (supply APY) for a token.
    /// @param token The underlying asset address
    /// @return rate The current liquidity rate in ray (1e27)
    function getCurrentRate(address token)
        external
        view
        returns (uint128 rate)
    {
        IAavePool.ReserveData memory data = aavePool.getReserveData(token);
        rate = data.currentLiquidityRate;
    }

    /// @notice Returns the aToken address for a given underlying asset.
    /// @param token The underlying asset address
    /// @return The corresponding aToken address
    function getATokenAddress(address token)
        external
        view
        returns (address)
    {
        IAavePool.ReserveData memory data = aavePool.getReserveData(token);
        return data.aTokenAddress;
    }
}
