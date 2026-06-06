// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @notice Mock DEX router for 0G Galileo that behaves like Uniswap V3
///         SwapRouter: pulls tokenIn via transferFrom and pays tokenOut at the
///         real price reported by the shared price oracle (fed from Binance).
///         No permissionless fallback (audit C-03). Fills at oracle mid-price
///         (no spread) - a stand-in for a real AMM, which only exists on the
///         production chains.
contract OrcusRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    IPriceOracle public immutable oracle;
    address public owner;

    constructor(address _usdc, address _oracle, address _owner) {
        require(_usdc != address(0) && _oracle != address(0) && _owner != address(0), "zero addr");
        usdc = _usdc;
        oracle = IPriceOracle(_oracle);
        owner = _owner;
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

    function withdraw(address token, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        if (token == address(0)) {
            (bool ok, ) = payable(owner).call{value: amount}("");
            require(ok, "native send failed");
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }
}
