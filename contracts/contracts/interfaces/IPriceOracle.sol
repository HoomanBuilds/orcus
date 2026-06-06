// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPriceOracle {
    /// @return amountOut expected output amount in tokenOut decimals
    function getExpectedOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}
