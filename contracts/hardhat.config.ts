import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
    overrides: {
      "@pythnetwork/pyth-sdk-solidity/MockPyth.sol": {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
      "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol": {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
      "@pythnetwork/pyth-sdk-solidity/PythErrors.sol": {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
      "@pythnetwork/pyth-sdk-solidity/PythUtils.sol": {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
  },
  networks: {
    galileo: {
      url: process.env.GALILEO_RPC ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    "arbitrum-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    fuji: {
      url: process.env.FUJI_RPC ?? "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    "mantle-sepolia": {
      url: process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC ?? "https://sepolia.drpc.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
