// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IERC20.sol";
import "./libraries/SafeTransfer.sol";

/// @title Router
/// @notice Central routing contract for the Gas-Aware Stablecoin Yield Optimizer.
///         Routes deposits, withdrawals, and migrations between DeFi protocol
///         adapters (Aave, Curve, etc.) while enforcing access control and
///         slippage protections.
contract Router {
    using SafeTransfer for IERC20;

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    enum Protocol {
        AAVE,
        CURVE
    }

    struct MigrationParams {
        Protocol fromProtocol;
        Protocol toProtocol;
        address token;
        uint256 amount;
        uint256 minReceived;
        bytes extraData; // Protocol-specific params (e.g. Curve slippage)
    }

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    address public owner;
    bool private _locked;

    // Protocol adapters
    mapping(Protocol => address) public adapters;

    // Whitelisted stablecoins
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Emergency pause
    bool public paused;

    // Fee configuration (in basis points, max 50 = 0.5%)
    uint256 public feeBps;
    address public feeRecipient;
    uint256 public constant MAX_FEE_BPS = 50;

    // Accumulated fees per token
    mapping(address => uint256) public accruedFees;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error OnlyOwner();
    error Paused();
    error Reentrancy();
    error ZeroAddress();
    error ZeroAmount();
    error UnsupportedToken();
    error AdapterNotSet();
    error SameProtocol();
    error SlippageExceeded();
    error FeeTooHigh();
    error WithdrawFailed();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposited(
        address indexed user,
        Protocol indexed protocol,
        address token,
        uint256 amount
    );

    event Withdrawn(
        address indexed user,
        Protocol indexed protocol,
        address token,
        uint256 amount
    );

    event Migrated(
        address indexed user,
        Protocol fromProtocol,
        Protocol toProtocol,
        address token,
        uint256 amount
    );

    event AdapterUpdated(Protocol indexed protocol, address adapter);
    event TokenWhitelisted(address indexed token, bool status);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address recipient);
    event FeesCollected(address token, uint256 amount);
    event EmergencyPauseToggled(bool paused);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        feeBps = 10; // Default 0.1% fee
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /// @notice Set or update the adapter address for a protocol.
    function setAdapter(Protocol protocol, address adapter)
        external
        onlyOwner
    {
        if (adapter == address(0)) revert ZeroAddress();
        adapters[protocol] = adapter;
        emit AdapterUpdated(protocol, adapter);
    }

    /// @notice Add or remove a stablecoin from the whitelist.
    function setTokenSupport(address token, bool status)
        external
        onlyOwner
    {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = status;
        if (status) {
            tokenList.push(token);
        }
        emit TokenWhitelisted(token, status);
    }

    /// @notice Update the protocol fee (max 0.5%).
    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    /// @notice Update the fee recipient address.
    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    /// @notice Toggle emergency pause.
    function togglePause() external onlyOwner {
        paused = !paused;
        emit EmergencyPauseToggled(paused);
    }

    /// @notice Transfer ownership of the contract.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Collect accrued fees for a token.
    function collectFees(address token) external onlyOwner {
        uint256 amount = accruedFees[token];
        if (amount == 0) revert ZeroAmount();
        accruedFees[token] = 0;
        IERC20(token).safeTransfer(feeRecipient, amount);
        emit FeesCollected(token, amount);
    }

    // ──────────────────────────────────────────────
    //  Core Functions
    // ──────────────────────────────────────────────

    /// @notice Deposit stablecoins into a protocol via its adapter.
    /// @param protocol The target protocol (AAVE or CURVE)
    /// @param token    The stablecoin to deposit
    /// @param amount   The amount of tokens to deposit
    /// @param extraData Protocol-specific parameters
    function deposit(
        Protocol protocol,
        address token,
        uint256 amount,
        bytes calldata extraData
    ) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!supportedTokens[token]) revert UnsupportedToken();

        address adapter = adapters[protocol];
        if (adapter == address(0)) revert AdapterNotSet();

        // Calculate fee
        uint256 fee = (amount * feeBps) / 10000;
        uint256 depositAmount = amount - fee;

        // Pull tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Accrue fee
        if (fee > 0) {
            accruedFees[token] += fee;
        }

        // Transfer deposit amount to adapter
        IERC20(token).safeTransfer(adapter, depositAmount);

        // Call adapter deposit
        if (protocol == Protocol.AAVE) {
            (bool success,) = adapter.call(
                abi.encodeWithSignature(
                    "deposit(address,uint256,address)",
                    token,
                    depositAmount,
                    msg.sender
                )
            );
            if (!success) revert WithdrawFailed();
        } else if (protocol == Protocol.CURVE) {
            uint256 minLP = extraData.length >= 32
                ? abi.decode(extraData, (uint256))
                : 0;
            (bool success,) = adapter.call(
                abi.encodeWithSignature(
                    "deposit(address,uint256,address,uint256)",
                    token,
                    depositAmount,
                    msg.sender,
                    minLP
                )
            );
            if (!success) revert WithdrawFailed();
        }

        emit Deposited(msg.sender, protocol, token, depositAmount);
    }

    /// @notice Withdraw stablecoins from a protocol via its adapter.
    /// @param protocol The source protocol
    /// @param token    The stablecoin to withdraw
    /// @param amount   The amount to withdraw
    /// @param extraData Protocol-specific parameters
    function withdraw(
        Protocol protocol,
        address token,
        uint256 amount,
        bytes calldata extraData
    ) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!supportedTokens[token]) revert UnsupportedToken();

        address adapter = adapters[protocol];
        if (adapter == address(0)) revert AdapterNotSet();

        if (protocol == Protocol.AAVE) {
            (bool success,) = adapter.call(
                abi.encodeWithSignature(
                    "withdraw(address,uint256,address)",
                    token,
                    amount,
                    msg.sender
                )
            );
            if (!success) revert WithdrawFailed();
        } else if (protocol == Protocol.CURVE) {
            uint256 minAmount = extraData.length >= 32
                ? abi.decode(extraData, (uint256))
                : 0;
            (bool success,) = adapter.call(
                abi.encodeWithSignature(
                    "withdraw(address,uint256,address,uint256)",
                    token,
                    amount,
                    msg.sender,
                    minAmount
                )
            );
            if (!success) revert WithdrawFailed();
        }

        emit Withdrawn(msg.sender, protocol, token, amount);
    }

    /// @notice Migrate funds from one protocol to another in a single
    ///         transaction.
    /// @param params The migration parameters
    function migrate(MigrationParams calldata params)
        external
        whenNotPaused
        nonReentrant
    {
        _migrate(params);
    }

    /// @notice Alias for migrate() used by some frontends and integrators.
    function migratePosition(MigrationParams calldata params)
        external
        whenNotPaused
        nonReentrant
    {
        _migrate(params);
    }

    function _migrate(MigrationParams calldata params) internal {
        if (params.amount == 0) revert ZeroAmount();
        if (!supportedTokens[params.token]) revert UnsupportedToken();
        if (params.fromProtocol == params.toProtocol) revert SameProtocol();

        address fromAdapter = adapters[params.fromProtocol];
        address toAdapter = adapters[params.toProtocol];
        if (fromAdapter == address(0) || toAdapter == address(0))
            revert AdapterNotSet();

        // Step 1: Withdraw from source protocol to this contract
        uint256 received;
        if (params.fromProtocol == Protocol.AAVE) {
            (bool success, bytes memory data) = fromAdapter.call(
                abi.encodeWithSignature(
                    "withdraw(address,uint256,address)",
                    params.token,
                    params.amount,
                    address(this)
                )
            );
            if (!success) revert WithdrawFailed();
            received = abi.decode(data, (uint256));
        } else {
            (bool success, bytes memory data) = fromAdapter.call(
                abi.encodeWithSignature(
                    "withdraw(address,uint256,address,uint256)",
                    params.token,
                    params.amount,
                    address(this),
                    params.minReceived
                )
            );
            if (!success) revert WithdrawFailed();
            received = abi.decode(data, (uint256));
        }

        if (received < params.minReceived) revert SlippageExceeded();

        // Step 2: Calculate fee on the migrated amount
        uint256 fee = (received * feeBps) / 10000;
        uint256 depositAmount = received - fee;
        if (fee > 0) {
            accruedFees[params.token] += fee;
        }

        // Step 3: Deposit into target protocol
        IERC20(params.token).safeTransfer(toAdapter, depositAmount);

        if (params.toProtocol == Protocol.AAVE) {
            (bool success,) = toAdapter.call(
                abi.encodeWithSignature(
                    "deposit(address,uint256,address)",
                    params.token,
                    depositAmount,
                    msg.sender
                )
            );
            if (!success) revert WithdrawFailed();
        } else {
            uint256 minLP = params.extraData.length >= 32
                ? abi.decode(params.extraData, (uint256))
                : 0;
            (bool success,) = toAdapter.call(
                abi.encodeWithSignature(
                    "deposit(address,uint256,address,uint256)",
                    params.token,
                    depositAmount,
                    msg.sender,
                    minLP
                )
            );
            if (!success) revert WithdrawFailed();
        }

        emit Migrated(
            msg.sender,
            params.fromProtocol,
            params.toProtocol,
            params.token,
            depositAmount
        );
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Returns the list of whitelisted tokens.
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /// @notice Returns the adapter address for a given protocol.
    function getAdapter(Protocol protocol) external view returns (address) {
        return adapters[protocol];
    }

    /// @notice Returns protocol info for display purposes.
    function getProtocolName(Protocol protocol)
        external
        pure
        returns (string memory)
    {
        if (protocol == Protocol.AAVE) return "Aave V3";
        if (protocol == Protocol.CURVE) return "Curve";
        return "Unknown";
    }
}
