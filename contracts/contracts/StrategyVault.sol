// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IWrappedNative} from "./interfaces/IWrappedNative.sol";

/// @notice MEV-resistant dark-pool vault. Users deposit funds + an encrypted
///         intent; an off-chain agent decides via sealed TEE inference and
///         calls executeTrade with validated params + an EIP-712 attestation.
///         The vault constructs the swap calldata itself (the agent never
///         names a recipient, amount, or selector) and enforces an
///         oracle-grounded output floor.
contract StrategyVault is Ownable2Step, ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;

    struct Intent {
        bytes   encryptedGoal;
        address tokenIn;
        uint256 amountIn;
        uint16  maxSlippageBps;
        bool    active;
    }

    struct ExecParams {
        address user;
        address tokenOut;
        uint24  fee;
        uint256 agentMinOut;
        uint256 deadline;
        bytes32 receiptHash;
        uint256 nonce;
    }

    bytes32 private constant EXEC_TYPEHASH = keccak256(
        "ExecParams(address user,address tokenOut,uint24 fee,uint256 agentMinOut,uint256 deadline,bytes32 receiptHash,uint256 nonce)"
    );

    uint256 public constant CANCEL_COOLDOWN = 1 hours;
    uint16  public constant MAX_BPS = 10000;

    mapping(address => Intent)  public intents;
    mapping(address => uint256) public intentNonce;
    mapping(address => uint256) public cancelRequestedAt;

    address public agent;
    address public attestor;
    ISwapRouter   public swapRouter;
    IPriceOracle  public oracle;
    IWrappedNative public immutable wrappedNative;

    event IntentSet(address indexed user, uint256 amountIn, bytes32 intentHash);
    event TradeExecuted(address indexed user, address tokenOut, uint256 amountOut, bytes32 receiptHash);
    event Withdrawn(address indexed user, address tokenIn, uint256 amount);
    event CancelRequested(address indexed user, uint256 at);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event AttestorUpdated(address indexed oldAttestor, address indexed newAttestor);
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    constructor(
        address _agent,
        address _attestor,
        address _swapRouter,
        address _oracle,
        address _wrappedNative,
        address _owner
    ) Ownable(_owner) EIP712("Orcus", "1") {
        require(_agent != address(0), "zero agent");
        require(_attestor != address(0), "zero attestor");
        require(_swapRouter.code.length > 0, "router not contract");
        require(_oracle.code.length > 0, "oracle not contract");
        require(_wrappedNative.code.length > 0, "wnative not contract");
        agent = _agent;
        attestor = _attestor;
        swapRouter = ISwapRouter(_swapRouter);
        oracle = IPriceOracle(_oracle);
        wrappedNative = IWrappedNative(_wrappedNative);
        emit AgentUpdated(address(0), _agent);
        emit AttestorUpdated(address(0), _attestor);
        emit SwapRouterUpdated(address(0), _swapRouter);
        emit OracleUpdated(address(0), _oracle);
    }

    // deposits

    function depositNative(bytes calldata encryptedGoal, uint16 maxSlippageBps)
        external payable nonReentrant whenNotPaused
    {
        require(msg.value > 0, "no value");
        _openIntent(encryptedGoal, maxSlippageBps);
        wrappedNative.deposit{value: msg.value}();
        intents[msg.sender] = Intent({
            encryptedGoal: encryptedGoal,
            tokenIn: address(wrappedNative),
            amountIn: msg.value,
            maxSlippageBps: maxSlippageBps,
            active: true
        });
        emit IntentSet(msg.sender, msg.value, _intentHash(encryptedGoal, maxSlippageBps));
    }

    function depositToken(address token, uint256 amount, bytes calldata encryptedGoal, uint16 maxSlippageBps)
        external nonReentrant whenNotPaused
    {
        require(token != address(0), "zero token");
        require(amount > 0, "no amount");
        _openIntent(encryptedGoal, maxSlippageBps);
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        intents[msg.sender] = Intent({
            encryptedGoal: encryptedGoal,
            tokenIn: token,
            amountIn: amount,
            maxSlippageBps: maxSlippageBps,
            active: true
        });
        emit IntentSet(msg.sender, amount, _intentHash(encryptedGoal, maxSlippageBps));
    }

    function _openIntent(bytes calldata encryptedGoal, uint16 maxSlippageBps) private view {
        require(encryptedGoal.length > 0, "empty intent");
        require(maxSlippageBps <= MAX_BPS, "slippage too high");
        require(!intents[msg.sender].active, "active intent");
    }

    function _intentHash(bytes calldata encryptedGoal, uint16 maxSlippageBps)
        private pure returns (bytes32)
    {
        return keccak256(abi.encode(encryptedGoal, maxSlippageBps));
    }

    // execution

    function executeTrade(ExecParams calldata p, bytes calldata signature, bytes calldata priceUpdate)
        external payable nonReentrant whenNotPaused
    {
        require(msg.sender == agent, "not agent");
        require(p.deadline >= block.timestamp, "expired");

        uint256 cancelAt = cancelRequestedAt[p.user];
        require(cancelAt == 0 || block.timestamp < cancelAt + CANCEL_COOLDOWN, "cancelling");

        require(p.nonce == intentNonce[p.user], "bad nonce");

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            EXEC_TYPEHASH, p.user, p.tokenOut, p.fee, p.agentMinOut, p.deadline, p.receiptHash, p.nonce
        )));
        require(ECDSA.recover(digest, signature) == attestor, "bad attestation");

        Intent memory it = intents[p.user];
        require(it.active && it.amountIn > 0, "no intent");

        // effects before interactions
        intentNonce[p.user] = p.nonce + 1;
        delete intents[p.user];
        delete cancelRequestedAt[p.user];

        // atomic fresh price: refresh, then read the floor from the same value
        oracle.updatePrice{value: msg.value}(priceUpdate);
        uint256 expectedOut = oracle.getExpectedOut(it.tokenIn, p.tokenOut, it.amountIn);
        require(expectedOut > 0, "oracle zero");
        uint256 floorOut = (expectedOut * (MAX_BPS - it.maxSlippageBps)) / MAX_BPS;
        uint256 minOut = floorOut > p.agentMinOut ? floorOut : p.agentMinOut;

        IERC20(it.tokenIn).forceApprove(address(swapRouter), it.amountIn);
        uint256 amountOut = swapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: it.tokenIn,
            tokenOut: p.tokenOut,
            fee: p.fee,
            recipient: address(this),
            deadline: p.deadline,
            amountIn: it.amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        }));
        IERC20(it.tokenIn).forceApprove(address(swapRouter), 0);

        require(amountOut > 0 && amountOut >= minOut, "slippage");
        IERC20(p.tokenOut).safeTransfer(p.user, amountOut);
        emit TradeExecuted(p.user, p.tokenOut, amountOut, p.receiptHash);
    }

    // user escape hatch + withdraw

    function requestCancel() external {
        require(intents[msg.sender].active, "no intent");
        require(cancelRequestedAt[msg.sender] == 0, "already requested");
        cancelRequestedAt[msg.sender] = block.timestamp;
        emit CancelRequested(msg.sender, block.timestamp);
    }

    function withdraw() external nonReentrant {
        Intent memory it = intents[msg.sender];
        require(it.active && it.amountIn > 0, "nothing");
        delete intents[msg.sender];
        delete cancelRequestedAt[msg.sender];
        if (it.tokenIn == address(wrappedNative)) {
            wrappedNative.withdraw(it.amountIn);
            (bool ok, ) = payable(msg.sender).call{value: it.amountIn}("");
            require(ok, "native send failed");
        } else {
            IERC20(it.tokenIn).safeTransfer(msg.sender, it.amountIn);
        }
        emit Withdrawn(msg.sender, it.tokenIn, it.amountIn);
    }

    // admin

    function setAgent(address _new) external onlyOwner {
        require(_new != address(0), "zero agent");
        emit AgentUpdated(agent, _new);
        agent = _new;
    }

    function setAttestor(address _new) external onlyOwner {
        require(_new != address(0), "zero attestor");
        emit AttestorUpdated(attestor, _new);
        attestor = _new;
    }

    function setSwapRouter(address _new) external onlyOwner {
        require(_new.code.length > 0, "router not contract");
        emit SwapRouterUpdated(address(swapRouter), _new);
        swapRouter = ISwapRouter(_new);
    }

    function setOracle(address _new) external onlyOwner {
        require(_new.code.length > 0, "oracle not contract");
        emit OracleUpdated(address(oracle), _new);
        oracle = IPriceOracle(_new);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @dev only the wrapped-native contract returns native here (on withdraw unwrap)
    receive() external payable {
        require(msg.sender == address(wrappedNative), "direct native");
    }
}
