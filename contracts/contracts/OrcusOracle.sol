// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @notice Mock oracle for 0G Galileo. Returns expected output at the same
///         fixed rate as OrcusRouter so the vault's slippage floor is
///         price-grounded with a single code path. Real chains use a
///         Pyth/Chainlink adapter implementing the same interface.
contract OrcusOracle is IPriceOracle {
    uint256 public constant RATE_NUM = 50;
    uint256 public constant RATE_DEN = 100;

    function getExpectedOut(address, address, uint256 amountIn)
        external
        pure
        override
        returns (uint256)
    {
        return (amountIn * RATE_NUM) / RATE_DEN;
    }
}
