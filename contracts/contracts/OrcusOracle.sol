// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Push price oracle for 0G Galileo, where no Pyth/Chainlink contract is
///         deployed. An off-chain updater (the agent) pushes the real
///         wrapped-native/USD price fetched from the Binance public API (symbol
///         0GUSDT). `priceScaled` is oUSDC-per-1-wrapped-native scaled by 1e18,
///         assuming the settlement token is a ~1 USD stable with 18 decimals.
///         On mainnet this is replaced by a Pyth pull adapter behind the same
///         IPriceOracle interface (0G mainnet Pyth 0x2880aB155794e7179c9eE2e38200202908C17B43,
///         feed Crypto.0G/USD).
contract OrcusOracle is IPriceOracle, Ownable {
    uint256 public priceScaled;
    uint256 public updatedAt;
    uint256 public maxAge;     // staleness window in seconds; 0 disables the check
    address public updater;

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

    function setPrice(uint256 _priceScaled) external {
        require(msg.sender == updater || msg.sender == owner(), "not updater");
        require(_priceScaled > 0, "zero price");
        priceScaled = _priceScaled;
        updatedAt = block.timestamp;
        emit PriceUpdated(_priceScaled, block.timestamp);
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
