// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title OrcusUSDC (oUSDC)
 * @notice ERC-20 stablecoin used as the settlement token in the Orcus
 *         dark pool. The owner (deployer) can mint tokens to fund the
 *         OrcusRouter with liquidity.
 * @dev Minimal implementation — no permit, no pausability.
 */
contract OrcusUSDC {
    string public constant name = "Orcus USDC";
    string public constant symbol = "oUSDC";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Mints new oUSDC tokens to a given address.
     * @param to Recipient of the minted tokens
     * @param amount Amount to mint (18 decimals)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Transfers oUSDC from the caller to another address.
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Approves a spender to transfer tokens on behalf of the caller.
     * @param spender Address authorized to spend
     * @param amount Allowance amount
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfers oUSDC from one address to another using an allowance.
     * @param from Address to transfer from
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
