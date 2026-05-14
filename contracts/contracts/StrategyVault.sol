// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract StrategyVault {
    // Jaine/Zer0 exactInputSingle selector — only this calldata shape is permitted
    bytes4 private constant EXACT_INPUT_SINGLE = 0x414bf389;

    struct Intent {
        bytes   encryptedGoal;
        uint256 maxSlippage;
        uint256 stopLoss;
        uint256 depositAmount;
        bool    active;
    }

    mapping(address => Intent)  public intents;
    mapping(address => uint256) public balances;

    address public teeAgentAddress;
    address public immutable jaineRouter;
    address public immutable owner;
    bool    public paused;

    event IntentSet(address indexed user, uint256 amount, bytes32 intentHash);
    event TradeExecuted(address indexed user, bytes32 receiptHash, bytes teeAttestation);
    event Withdrawn(address indexed user, uint256 amount);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    modifier onlyOwner()  { require(msg.sender == owner,  "not owner"); _; }
    modifier notPaused()  { require(!paused,               "paused");    _; }

    constructor(address _teeAgentAddress, address _jaineRouter) {
        require(_teeAgentAddress != address(0), "zero agent");
        require(_jaineRouter     != address(0), "zero router");
        owner            = msg.sender;
        teeAgentAddress  = _teeAgentAddress;
        jaineRouter      = _jaineRouter;
    }

    function pause()   external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    function setAgent(address _new) external onlyOwner {
        require(_new != address(0), "zero agent");
        emit AgentUpdated(teeAgentAddress, _new);
        teeAgentAddress = _new;
    }

    function depositAndSetIntent(
        bytes calldata _encryptedGoal,
        uint256 _maxSlippage,
        uint256 _stopLoss
    ) external payable notPaused {
        require(msg.value > 0,              "Must deposit funds");
        require(_encryptedGoal.length > 0,  "empty intent");
        require(!intents[msg.sender].active, "intent already active");
        balances[msg.sender] += msg.value;
        intents[msg.sender] = Intent({
            encryptedGoal: _encryptedGoal,
            maxSlippage:   _maxSlippage,
            stopLoss:      _stopLoss,
            depositAmount: balances[msg.sender],
            active:        true
        });
        bytes32 intentHash = keccak256(abi.encode(_encryptedGoal, _maxSlippage, _stopLoss));
        emit IntentSet(msg.sender, msg.value, intentHash);
    }

    function executeTradeWithProof(
        address user,
        bytes calldata tradeData,
        bytes calldata teeAttestation,
        bytes32 storageReceiptHash,
        uint256 minAmountOut
    ) external notPaused {
        require(msg.sender == teeAgentAddress, "Unauthorized");
        require(intents[user].active,           "No active intent");
        require(tradeData.length >= 4,          "tradeData too short");
        require(bytes4(tradeData[:4]) == EXACT_INPUT_SINGLE, "invalid selector");

        uint256 amount        = balances[user];
        uint256 storedSlippage = intents[user].maxSlippage;
        require(amount > 0, "No balance");

        // Agent-supplied minAmountOut must be at least as strict as user's stored slippage
        if (storedSlippage > 0) {
            uint256 floor = (amount * (10000 - storedSlippage)) / 10000;
            require(minAmountOut >= floor, "minAmountOut below slippage limit");
        }

        balances[user] = 0;
        intents[user].active = false;

        (bool ok, bytes memory result) = jaineRouter.call{value: amount}(tradeData);
        require(ok, "swap failed");

        // Enforce output — router returns amountOut as first 32 bytes
        if (result.length >= 32) {
            uint256 amountOut = abi.decode(result, (uint256));
            require(amountOut >= minAmountOut, "slippage exceeded");
        }

        emit TradeExecuted(user, storageReceiptHash, teeAttestation);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        balances[msg.sender] = 0;
        intents[msg.sender].active = false;
        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
    }
}
