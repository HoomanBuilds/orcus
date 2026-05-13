// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StrategyVault {
    struct Intent {
        bytes encryptedGoal;
        uint256 maxSlippage;
        uint256 stopLoss;
        uint256 depositAmount;
        bool active;
    }

    mapping(address => Intent) public intents;
    mapping(address => uint256) public balances;
    address public immutable teeAgentAddress;

    event IntentSet(address indexed user, uint256 amount);
    event TradeExecuted(address indexed user, bytes32 receiptHash, bytes teeAttestation);

    constructor(address _teeAgentAddress) {
        teeAgentAddress = _teeAgentAddress;
    }

    function depositAndSetIntent(
        bytes calldata _encryptedGoal,
        uint256 _maxSlippage,
        uint256 _stopLoss
    ) external payable {
        require(msg.value > 0, "Must deposit funds");
        balances[msg.sender] += msg.value;
        intents[msg.sender] = Intent({
            encryptedGoal: _encryptedGoal,
            maxSlippage: _maxSlippage,
            stopLoss: _stopLoss,
            depositAmount: msg.value,
            active: true
        });
        emit IntentSet(msg.sender, msg.value);
    }

    function executeTradeWithProof(
        address user,
        bytes calldata,
        bytes calldata teeAttestation,
        bytes32 storageReceiptHash
    ) external {
        require(msg.sender == teeAgentAddress, "Unauthorized");
        require(intents[user].active, "No active intent");
        emit TradeExecuted(user, storageReceiptHash, teeAttestation);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        balances[msg.sender] = 0;
        intents[msg.sender].active = false;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
    }
}
