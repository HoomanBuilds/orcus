// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Push price oracle for 0G Galileo (no Pyth/Chainlink on the testnet).
///         The StrategyVault calls updatePrice() atomically inside executeTrade
///         with the live Binance price (ABI-encoded uint256, oUSDC-per-1-
///         wrapped-native scaled by 1e18), so the slippage floor always uses a
///         fresh price. On mainnet a Pyth pull adapter implements the same
///         interface (updatePrice forwards a Hermes VAA to pyth.updatePriceFeeds).
contract OrcusOracle is IPriceOracle, Ownable {
    uint256 public priceScaled;
    uint256 public updatedAt;
    uint256 public maxAge;    // staleness window (s); 0 disables the check
    address public updater;   // the StrategyVault (calls updatePrice during executeTrade)

    event PriceUpdated(uint256 priceScaled, uint256 at);
    event UpdaterUpdated(address indexed oldUpdater, address indexed newUpdater);
    event MaxAgeUpdated(uint256 maxAge);

    constructor(address initialOwner, address _updater, uint256 _maxAge) Ownable(initialOwner) {
        require(_updater != address(0), "zero updater");
        updater = _updater;
        maxAge = _maxAge;
        emit UpdaterUpdated(address(0), _updater);
        emit MaxAgeUpdated(_maxAge);
    }

    modifier onlyUpdater() {
        require(msg.sender == updater || msg.sender == owner(), "not updater");
        _;
    }

    function setUpdater(address _new) external onlyOwner {
        require(_new != address(0), "zero updater");
        emit UpdaterUpdated(updater, _new);
        updater = _new;
    }

    function setMaxAge(uint256 _maxAge) external onlyOwner {
        maxAge = _maxAge;
        emit MaxAgeUpdated(_maxAge);
    }

    /// @notice Seed/override the price directly (owner/updater). Used at deploy.
    function setPrice(uint256 _priceScaled) external onlyUpdater {
        _set(_priceScaled);
    }

    /// @notice Atomic refresh from ABI-encoded uint256, called by the vault.
    function updatePrice(bytes calldata data) external payable onlyUpdater {
        require(data.length == 32, "bad price data");
        _set(abi.decode(data, (uint256)));
    }

    function _set(uint256 _priceScaled) private {
        require(_priceScaled > 0, "zero price");
        priceScaled = _priceScaled;
        updatedAt = block.timestamp;
        emit PriceUpdated(_priceScaled, block.timestamp);
    }

    function getExpectedOut(address, address, uint256 amountIn)
        external view override returns (uint256)
    {
        require(priceScaled > 0, "no price");
        if (maxAge != 0) {
            require(block.timestamp - updatedAt <= maxAge, "stale price");
        }
        return (amountIn * priceScaled) / 1e18;
    }
}
