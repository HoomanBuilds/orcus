// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Mainnet IPriceOracle backed by Pyth (a pull oracle). updatePrice forwards a
///         Hermes price-update VAA to pyth.updatePriceFeeds (msg.value pays the fee);
///         getExpectedOut reads getPriceNoOlderThan (reverts if stale) and converts to
///         tokenOut units. Assumes `feedId` is the tokenIn/USD feed and tokenOut is a
///         ~1 USD stable. Deployed once per chain with that chain's native/USD feed.
contract PythPriceOracle is IPriceOracle {
    IPyth public immutable pyth;
    bytes32 public immutable feedId;
    uint256 public immutable maxAge;

    constructor(address _pyth, bytes32 _feedId, uint256 _maxAge) {
        require(_pyth != address(0), "zero pyth");
        require(_feedId != bytes32(0), "zero feed");
        require(_maxAge > 0, "zero maxAge");
        pyth = IPyth(_pyth);
        feedId = _feedId;
        maxAge = _maxAge;
    }

    function updatePrice(bytes calldata data) external payable override {
        bytes[] memory updateData = abi.decode(data, (bytes[]));
        pyth.updatePriceFeeds{value: msg.value}(updateData);
    }

    function getExpectedOut(address tokenIn, address tokenOut, uint256 amountIn)
        external view override returns (uint256)
    {
        PythStructs.Price memory p = pyth.getPriceNoOlderThan(feedId, maxAge);
        require(p.price > 0, "bad price");
        uint256 priceU = uint256(uint64(p.price));
        uint8 dIn = IERC20Metadata(tokenIn).decimals();
        uint8 dOut = IERC20Metadata(tokenOut).decimals();

        // expectedOut = amountIn * priceU * 10^expo * 10^dOut / 10^dIn  (tokenOut units)
        uint256 num = amountIn * priceU * (10 ** dOut);
        uint256 den = 10 ** dIn;
        if (p.expo < 0) {
            den = den * (10 ** uint256(int256(-p.expo)));
        } else {
            num = num * (10 ** uint256(int256(p.expo)));
        }
        return num / den;
    }
}
