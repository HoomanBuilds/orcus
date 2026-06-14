// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter02} from "../interfaces/ISwapRouter02.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Test mock of Uniswap V3 SwapRouter02 (no `deadline` in the params struct).
///         Exercises the vault's routerKind=1 path. Pays tokenOut at the oracle price.
contract MockSwapRouter02 is ISwapRouter02 {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    IPriceOracle public immutable oracle;

    constructor(address _usdc, address _oracle) {
        usdc = _usdc;
        oracle = IPriceOracle(_oracle);
    }

    function exactInputSingle(ExactInputSingleParams calldata p)
        external payable override returns (uint256 amountOut)
    {
        require(p.amountIn > 0, "zero amountIn");
        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);
        amountOut = oracle.getExpectedOut(p.tokenIn, p.tokenOut, p.amountIn);
        require(amountOut >= p.amountOutMinimum, "slippage");
        IERC20(usdc).safeTransfer(p.recipient, amountOut);
    }
}
