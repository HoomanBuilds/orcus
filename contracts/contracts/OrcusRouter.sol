// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title OrcusRouter
 * @notice Swap router for the Orcus dark pool — accepts native OG and
 *         transfers oUSDC to the recipient at a fixed exchange rate.
 * @dev Designed to be called by StrategyVault.executeTradeWithProof via
 *      a low-level call with exactInputSingle-encoded calldata.
 */
contract OrcusRouter {
    /** @notice Exchange rate numerator (1 OG = RATE_NUM/RATE_DEN oUSDC) */
    uint256 public constant RATE_NUM = 50;

    /** @notice Exchange rate denominator */
    uint256 public constant RATE_DEN = 100;

    /** @notice Address of the oUSDC token contract */
    address public immutable usdc;

    /** @notice Owner who can withdraw accumulated OG */
    address public owner;

    /**
     * @param _usdc Address of the OrcusUSDC (oUSDC) token
     */
    constructor(address _usdc) {
        usdc = _usdc;
        owner = msg.sender;
    }

    receive() external payable {}

    /**
     * @notice Handles exactInputSingle calls forwarded from the vault.
     * @dev Decodes the recipient from the ABI-encoded calldata, calculates
     *      the output amount at the fixed rate, transfers oUSDC to the
     *      recipient, and returns amountOut as a 32-byte word.
     *
     *      exactInputSingle calldata layout (after 4-byte selector):
     *        0x00: tokenIn (address)
     *        0x20: tokenOut (address)
     *        0x40: fee (uint24)
     *        0x60: recipient (address)
     *        0x80: deadline (uint256)
     *        0xA0: amountIn (uint256)
     *        0xC0: amountOutMinimum (uint256)
     *        0xE0: sqrtPriceLimitX96 (uint160)
     */
    fallback() external payable {
        require(msg.data.length >= 4 + 0x100, "calldata too short");

        address recipient;
        assembly {
            recipient := calldataload(100)
        }

        uint256 amountOut = (msg.value * RATE_NUM) / RATE_DEN;
        require(
            IERC20(usdc).transfer(recipient, amountOut),
            "USDC transfer failed"
        );

        assembly {
            mstore(0, amountOut)
            return(0, 32)
        }
    }

    /**
     * @notice Allows the owner to withdraw accumulated OG or ERC20 tokens.
     * @param token Address of the token to withdraw (address(0) for native OG)
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).transfer(owner, amount);
        }
    }
}
