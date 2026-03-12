// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../interfaces/ICurvePool.sol";
import "../libraries/SafeTransfer.sol";

/// @title CurveAdapter
/// @notice Adapter contract for depositing into and withdrawing from Curve
///         stablecoin pools. Provides a standardized interface for the Router.
contract CurveAdapter {
    using SafeTransfer for IERC20;

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    ICurvePool public immutable curvePool;
    address public immutable lpToken;
    address public immutable router;

    // Coin index mapping: token address → Curve pool coin index
    mapping(address => int128) public coinIndex;
    mapping(address => bool) public supportedTokens;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error OnlyRouter();
    error ZeroAmount();
    error ZeroAddress();
    error UnsupportedToken();
    error SlippageExceeded();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposited(
        address indexed token,
        address indexed user,
        uint256 amount,
        uint256 lpReceived
    );

    event Withdrawn(
        address indexed token,
        address indexed user,
        uint256 lpBurned,
        uint256 amountReceived
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

    /// @param _curvePool Address of the Curve stablecoin pool
    /// @param _lpToken   Address of the Curve LP token
    /// @param _router    Address of the Router contract
    /// @param _coins     Array of coin addresses in the pool (length 2)
    constructor(
        address _curvePool,
        address _lpToken,
        address _router,
        address[2] memory _coins
    ) {
        if (
            _curvePool == address(0) ||
            _lpToken == address(0) ||
            _router == address(0)
        ) revert ZeroAddress();

        curvePool = ICurvePool(_curvePool);
        lpToken = _lpToken;
        router = _router;

        for (uint256 i = 0; i < 2; i++) {
            if (_coins[i] != address(0)) {
                coinIndex[_coins[i]] = int128(int256(i));
                supportedTokens[_coins[i]] = true;
            }
        }
    }

    // ──────────────────────────────────────────────
    //  External Functions
    // ──────────────────────────────────────────────

    /// @notice Deposits a single token into the Curve pool.
    ///         The Router must have already transferred tokens to this contract.
    /// @param token         The stablecoin address to deposit
    /// @param amount        The amount of tokens to deposit
    /// @param user          The end-user who owns the position
    /// @param minLPAmount   Minimum LP tokens to accept (slippage protection)
    /// @return lpReceived   The amount of LP tokens minted
    function deposit(
        address token,
        uint256 amount,
        address user,
        uint256 minLPAmount
    ) external onlyRouter returns (uint256 lpReceived) {
        if (amount == 0) revert ZeroAmount();
        if (!supportedTokens[token]) revert UnsupportedToken();

        // Approve the Curve pool to spend tokens
        IERC20(token).safeApprove(address(curvePool), amount);

        // Build the amounts array — deposit only into the correct index
        uint256[2] memory amounts;
        amounts[uint128(coinIndex[token])] = amount;

        // Add liquidity to Curve
        lpReceived = curvePool.add_liquidity(amounts, minLPAmount);

        if (lpReceived < minLPAmount) revert SlippageExceeded();

        // Transfer LP tokens to the user
        IERC20(lpToken).safeTransfer(user, lpReceived);

        emit Deposited(token, user, amount, lpReceived);
    }

    /// @notice Withdraws a single token from the Curve pool by burning LP tokens.
    ///         The Router must have already transferred LP tokens to this contract.
    /// @param token       The stablecoin to withdraw
    /// @param lpAmount    The amount of LP tokens to burn
    /// @param user        The end-user who owns the position
    /// @param minAmount   Minimum underlying tokens to accept
    /// @return received   The actual amount of underlying tokens received
    function withdraw(
        address token,
        uint256 lpAmount,
        address user,
        uint256 minAmount
    ) external onlyRouter returns (uint256 received) {
        if (lpAmount == 0) revert ZeroAmount();
        if (!supportedTokens[token]) revert UnsupportedToken();

        int128 idx = coinIndex[token];

        // Remove liquidity from Curve as a single coin
        received = curvePool.remove_liquidity_one_coin(
            lpAmount,
            idx,
            minAmount
        );

        // Transfer received tokens to the user
        IERC20(token).safeTransfer(user, received);

        emit Withdrawn(token, user, lpAmount, received);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Returns the virtual price of the Curve LP token (1e18 base).
    function getVirtualPrice() external view returns (uint256) {
        return curvePool.get_virtual_price();
    }

    /// @notice Returns the balance of a specific coin in the pool.
    /// @param token The coin address
    function getPoolBalance(address token)
        external
        view
        returns (uint256)
    {
        if (!supportedTokens[token]) revert UnsupportedToken();
        return curvePool.balances(uint128(coinIndex[token]));
    }
}
