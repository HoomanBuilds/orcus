// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPriceOracle {
    /// @notice Refresh the on-chain price from `data`, called atomically by the
    ///         vault inside executeTrade. Mock adapter: ABI-encoded uint256
    ///         (priceScaled, 1e18). Pyth adapter: a Hermes price-update VAA
    ///         forwarded to pyth.updatePriceFeeds (msg.value pays the fee).
    function updatePrice(bytes calldata data) external payable;

    /// @return amountOut expected output amount in tokenOut decimals
    function getExpectedOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}
