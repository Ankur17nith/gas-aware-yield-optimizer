// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICurvePool {
    /// @notice Add liquidity to the pool (2-coin variant).
    /// @param amounts     Array of token amounts to deposit
    /// @param minMintAmount Minimum LP tokens to receive
    /// @return The amount of LP tokens minted
    function add_liquidity(
        uint256[2] calldata amounts,
        uint256 minMintAmount
    ) external returns (uint256);

    /// @notice Remove liquidity from the pool in a single coin.
    /// @param tokenAmount Amount of LP tokens to burn
    /// @param i           Index of the coin to withdraw
    /// @param minAmount   Minimum amount of coin to receive
    /// @return The amount of coin withdrawn
    function remove_liquidity_one_coin(
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external returns (uint256);

    /// @notice Get the virtual price of the pool's LP token.
    /// @return The virtual price scaled to 1e18
    function get_virtual_price() external view returns (uint256);

    /// @notice Get the current balance of a coin in the pool.
    /// @param i Index of the coin
    /// @return The balance of coin i
    function balances(uint256 i) external view returns (uint256);

    /// @notice Get the address of the coin at index i.
    /// @param i Index of the coin
    /// @return The address of the coin
    function coins(uint256 i) external view returns (address);

    /// @notice Calculate the amount of coin j received for swapping dx of coin i.
    /// @param i  Index of the input coin
    /// @param j  Index of the output coin
    /// @param dx Amount of input coin
    /// @return   The calculated output amount
    function get_dy(int128 i, int128 j, uint256 dx)
        external
        view
        returns (uint256);

    /// @notice Perform an exchange between two coins.
    /// @param i       Index of the input coin
    /// @param j       Index of the output coin
    /// @param dx      Amount of input coin
    /// @param minDy   Minimum amount of output coin to receive
    /// @return        The actual amount of output coin received
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external returns (uint256);

    /// @notice Returns the LP token address (for metapools).
    function lp_token() external view returns (address);
}
