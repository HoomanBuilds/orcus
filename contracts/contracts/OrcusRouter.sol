// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/// @notice Mock DEX router for 0G Galileo that behaves like Uniswap V3
///         SwapRouter: pulls tokenIn via transferFrom and pays tokenOut at a
///         fixed rate. No permissionless fallback (audit C-03).
contract OrcusRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    uint256 public constant RATE_NUM = 50;   // 1 tokenIn = 0.5 tokenOut
    uint256 public constant RATE_DEN = 100;

    address public immutable usdc;
    address public owner;

    constructor(address _usdc, address _owner) {
        require(_usdc != address(0) && _owner != address(0), "zero addr");
        usdc = _usdc;
        owner = _owner;
    }

    function exactInputSingle(ExactInputSingleParams calldata p)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        require(p.amountIn > 0, "zero amountIn");
        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);
        amountOut = (p.amountIn * RATE_NUM) / RATE_DEN;
        require(amountOut >= p.amountOutMinimum, "slippage");
        IERC20(usdc).safeTransfer(p.recipient, amountOut);
    }

    /// @notice Owner ops withdrawal (mock). On a real router this would not exist.
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
