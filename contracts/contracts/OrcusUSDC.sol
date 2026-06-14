// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Settlement token for the Orcus dark pool. Owner mints initial
///         liquidity, then calls finishMinting() to permanently cap supply.
contract OrcusUSDC is ERC20, Ownable {
    bool public mintingFinished;

    event MintingFinished();

    constructor(address initialOwner)
        ERC20("Orcus USDC", "oUSDC")
        Ownable(initialOwner)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        require(!mintingFinished, "minting finished");
        _mint(to, amount);
    }

    /// @notice One-way switch: after this, no more tokens can ever be minted.
    function finishMinting() external onlyOwner {
        mintingFinished = true;
        emit MintingFinished();
    }
}
