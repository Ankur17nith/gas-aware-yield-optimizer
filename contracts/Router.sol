// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IERC20.sol";
import "./libraries/SafeTransfer.sol";

/// @title Router
/// @notice Central routing contract for the Gas-Aware Stablecoin Yield Optimizer.
///         Routes deposits, withdrawals, and migrations between DeFi protocol
///         adapters while enforcing access control and slippage protections.
contract Router {
    using SafeTransfer for IERC20;

    enum Protocol {
        AAVE,
        CURVE,
        COMPOUND
    }

    struct MigrationParams {
        Protocol fromProtocol;
        Protocol toProtocol;
        address token;
        uint256 amount;
        uint256 minReceived;
        bytes extraData;
    }

    address public owner;
    bool private _locked;

    mapping(Protocol => address) public adapters;

    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    bool public paused;

    uint256 public feeBps;
    address public feeRecipient;
    uint256 public constant MAX_FEE_BPS = 50;

    mapping(address => uint256) public accruedFees;

    // user => protocol => token => tracked principal
    mapping(address => mapping(Protocol => mapping(address => uint256)))
        public userProtocolDeposits;

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
    error InsufficientTrackedBalance();

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

    event Rebalanced(
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

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        feeBps = 10;
    }

    function setAdapter(Protocol protocol, address adapter) external onlyOwner {
        if (adapter == address(0)) revert ZeroAddress();
        adapters[protocol] = adapter;
        emit AdapterUpdated(protocol, adapter);
    }

    function setTokenSupport(address token, bool status) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();

        bool wasSupported = supportedTokens[token];
        supportedTokens[token] = status;
        if (status && !wasSupported) {
            tokenList.push(token);
        }

        emit TokenWhitelisted(token, status);
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    function togglePause() external onlyOwner {
        paused = !paused;
        emit EmergencyPauseToggled(paused);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function collectFees(address token) external onlyOwner {
        uint256 amount = accruedFees[token];
        if (amount == 0) revert ZeroAmount();
        accruedFees[token] = 0;
        IERC20(token).safeTransfer(feeRecipient, amount);
        emit FeesCollected(token, amount);
    }

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

        uint256 fee = (amount * feeBps) / 10000;
        uint256 depositAmount = amount - fee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        if (fee > 0) {
            accruedFees[token] += fee;
        }

        _depositToProtocol(protocol, adapter, token, depositAmount, msg.sender, extraData);

        userProtocolDeposits[msg.sender][protocol][token] += depositAmount;

        emit Deposited(msg.sender, protocol, token, depositAmount);
    }

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

        uint256 tracked = userProtocolDeposits[msg.sender][protocol][token];
        if (tracked < amount) revert InsufficientTrackedBalance();
        userProtocolDeposits[msg.sender][protocol][token] = tracked - amount;

        _withdrawFromProtocol(protocol, adapter, token, amount, msg.sender, extraData);

        emit Withdrawn(msg.sender, protocol, token, amount);
    }

    function migrate(MigrationParams calldata params)
        external
        whenNotPaused
        nonReentrant
    {
        _migrate(params);
    }

    function migratePosition(MigrationParams calldata params)
        external
        whenNotPaused
        nonReentrant
    {
        _migrate(params);
    }

    function rebalance(MigrationParams calldata params)
        external
        whenNotPaused
        nonReentrant
    {
        _migrate(params);
        emit Rebalanced(
            msg.sender,
            params.fromProtocol,
            params.toProtocol,
            params.token,
            params.amount
        );
    }

    function _migrate(MigrationParams calldata params) internal {
        if (params.amount == 0) revert ZeroAmount();
        if (!supportedTokens[params.token]) revert UnsupportedToken();
        if (params.fromProtocol == params.toProtocol) revert SameProtocol();

        address fromAdapter = adapters[params.fromProtocol];
        address toAdapter = adapters[params.toProtocol];
        if (fromAdapter == address(0) || toAdapter == address(0)) revert AdapterNotSet();

        uint256 tracked = userProtocolDeposits[msg.sender][params.fromProtocol][params.token];
        if (tracked < params.amount) revert InsufficientTrackedBalance();

        bytes memory withdrawExtraData = params.fromProtocol == Protocol.CURVE
            ? abi.encode(params.minReceived)
            : bytes("");

        uint256 received = _withdrawFromProtocol(
            params.fromProtocol,
            fromAdapter,
            params.token,
            params.amount,
            address(this),
            withdrawExtraData
        );

        if (received < params.minReceived) revert SlippageExceeded();

        uint256 fee = (received * feeBps) / 10000;
        uint256 depositAmount = received - fee;
        if (fee > 0) {
            accruedFees[params.token] += fee;
        }

        _depositToProtocol(
            params.toProtocol,
            toAdapter,
            params.token,
            depositAmount,
            msg.sender,
            params.extraData
        );

        userProtocolDeposits[msg.sender][params.fromProtocol][params.token] =
            tracked - params.amount;
        userProtocolDeposits[msg.sender][params.toProtocol][params.token] += depositAmount;

        emit Migrated(
            msg.sender,
            params.fromProtocol,
            params.toProtocol,
            params.token,
            depositAmount
        );
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    function getAdapter(Protocol protocol) external view returns (address) {
        return adapters[protocol];
    }

    function getProtocolName(Protocol protocol)
        external
        pure
        returns (string memory)
    {
        if (protocol == Protocol.AAVE) return "Aave V3";
        if (protocol == Protocol.CURVE) return "Curve";
        if (protocol == Protocol.COMPOUND) return "Compound V3";
        return "Unknown";
    }

    function getUserProtocolDeposit(
        address user,
        Protocol protocol,
        address token
    ) external view returns (uint256) {
        return userProtocolDeposits[user][protocol][token];
    }

    function getUserDeposits(address user, address token)
        external
        view
        returns (
            uint256 aaveAmount,
            uint256 curveAmount,
            uint256 compoundAmount,
            uint256 total
        )
    {
        aaveAmount = userProtocolDeposits[user][Protocol.AAVE][token];
        curveAmount = userProtocolDeposits[user][Protocol.CURVE][token];
        compoundAmount = userProtocolDeposits[user][Protocol.COMPOUND][token];
        total = aaveAmount + curveAmount + compoundAmount;
    }

    function _depositToProtocol(
        Protocol protocol,
        address adapter,
        address token,
        uint256 amount,
        address user,
        bytes calldata extraData
    ) internal {
        IERC20(token).safeTransfer(adapter, amount);

        if (protocol == Protocol.AAVE || protocol == Protocol.COMPOUND) {
            (bool success,) = adapter.call(
                abi.encodeWithSignature(
                    "deposit(address,uint256,address)",
                    token,
                    amount,
                    user
                )
            );
            if (!success) revert WithdrawFailed();
            return;
        }

        if (protocol == Protocol.CURVE) {
            uint256 minLP = extraData.length >= 32 ? abi.decode(extraData, (uint256)) : 0;
            (bool success,) = adapter.call(
                abi.encodeWithSignature(
                    "deposit(address,uint256,address,uint256)",
                    token,
                    amount,
                    user,
                    minLP
                )
            );
            if (!success) revert WithdrawFailed();
            return;
        }

        revert AdapterNotSet();
    }

    function _withdrawFromProtocol(
        Protocol protocol,
        address adapter,
        address token,
        uint256 amount,
        address user,
        bytes memory extraData
    ) internal returns (uint256 received) {
        if (protocol == Protocol.AAVE || protocol == Protocol.COMPOUND) {
            (bool success, bytes memory data) = adapter.call(
                abi.encodeWithSignature(
                    "withdraw(address,uint256,address)",
                    token,
                    amount,
                    user
                )
            );
            if (!success) revert WithdrawFailed();
            if (data.length == 0) return amount;
            received = abi.decode(data, (uint256));
            return received;
        }

        if (protocol == Protocol.CURVE) {
            uint256 minAmount = extraData.length >= 32 ? abi.decode(extraData, (uint256)) : 0;
            (bool success, bytes memory data) = adapter.call(
                abi.encodeWithSignature(
                    "withdraw(address,uint256,address,uint256)",
                    token,
                    amount,
                    user,
                    minAmount
                )
            );
            if (!success) revert WithdrawFailed();
            if (data.length == 0) return amount;
            received = abi.decode(data, (uint256));
            return received;
        }

        revert AdapterNotSet();
    }
}
