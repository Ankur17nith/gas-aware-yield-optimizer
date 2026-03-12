// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IAavePool {
    /// @notice Supplies an amount of underlying asset into the reserve,
    ///         receiving in return overlying aTokens.
    /// @param asset      The address of the underlying asset to supply
    /// @param amount     The amount to supply
    /// @param onBehalfOf The address that will receive the aTokens
    /// @param referralCode Code used for third-party integrations (0 for none)
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /// @notice Withdraws an amount of underlying asset from the reserve,
    ///         burning the equivalent aTokens.
    /// @param asset  The address of the underlying asset to withdraw
    /// @param amount The amount to withdraw (type(uint256).max for full balance)
    /// @param to     The address that will receive the underlying asset
    /// @return The final amount withdrawn
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /// @notice Returns the normalized income of the reserve.
    ///         Used to compute current supply APY.
    /// @param asset The address of the underlying asset
    /// @return The reserve's normalized income (ray, 1e27)
    function getReserveNormalizedIncome(address asset)
        external
        view
        returns (uint256);

    /// @notice Returns the state and configuration of the reserve
    /// @param asset The address of the underlying asset
    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint128 accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }

    function getReserveData(address asset)
        external
        view
        returns (ReserveData memory);
}
