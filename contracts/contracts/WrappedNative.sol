// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal WETH9-style wrapper for the chain's native gas token.
///         Used as the canonical wrapped-native on 0G Galileo and in tests.
contract WrappedNative is ERC20 {
    constructor() ERC20("Wrapped Native", "WNATIVE") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "native send failed");
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}
