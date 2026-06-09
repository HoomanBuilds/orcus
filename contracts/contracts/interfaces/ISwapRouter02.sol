// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Uniswap V3 SwapRouter02 exactInputSingle (selector 0x04e45aaf). Unlike the
///         original SwapRouter, the params struct has NO `deadline` (SwapRouter02 handles
///         deadlines via multicall). Used on chains where only SwapRouter02 is deployed
///         (e.g. Base 0x2626664c2603336E57B271c5C0b26F421741e481, Avalanche
///         0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE). The vault still enforces its own
///         deadline at the ExecParams level, so dropping the swap-level deadline is safe.
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}
