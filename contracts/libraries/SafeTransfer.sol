// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";

/// @title SafeTransfer
/// @notice Gas-efficient library for safe ERC-20 token transfers that
///         handles non-standard implementations (e.g. USDT) that may
///         not return a bool on transfer.
library SafeTransfer {
    error TransferFailed();
    error TransferFromFailed();
    error ApproveFailed();

    /// @notice Safely transfers tokens from the caller to a recipient.
    /// @param token  The ERC-20 token address
    /// @param to     The recipient address
    /// @param amount The amount of tokens to transfer
    function safeTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    /// @notice Safely transfers tokens on behalf of a sender to a recipient.
    /// @param token  The ERC-20 token address
    /// @param from   The sender address
    /// @param to     The recipient address
    /// @param amount The amount of tokens to transfer
    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFromFailed();
        }
    }

    /// @notice Safely approves a spender to spend tokens.
    ///         Resets allowance to 0 first for USDT compatibility.
    /// @param token   The ERC-20 token address
    /// @param spender The spender address
    /// @param amount  The amount of tokens to approve
    function safeApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        // Reset to zero first (required by USDT and similar tokens)
        if (amount > 0) {
            (bool resetSuccess, bytes memory resetData) = address(token).call(
                abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
            );
            if (!resetSuccess || (resetData.length != 0 && !abi.decode(resetData, (bool)))) {
                revert ApproveFailed();
            }
        }

        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert ApproveFailed();
        }
    }
}
