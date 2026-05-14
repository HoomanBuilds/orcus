// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MockRouter {
    receive() external payable {}

    // Accepts any calldata, returns msg.value as amountOut (1:1 mock)
    fallback() external payable {
        uint256 amountOut = msg.value;
        assembly { mstore(0, amountOut) return(0, 32) }
    }
}
