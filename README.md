<p align="center">
  <img src="assets/logo-dark.png#gh-light-mode-only" alt="Orcus" width="80" />
  <img src="assets/logo-light.png#gh-dark-mode-only" alt="Orcus" width="80" />
</p>

<h1 align="center">Orcus</h1>

> An MEV-resistant dark pool agent that keeps your trading intent encrypted until settlement is final - across six EVM chains and Sui.

Orcus is an autonomous, multi-chain trading agent. Users submit an encrypted trading strategy to a Strategy Vault on the chain of their choice. The agent decrypts it inside a TEE (Trusted Execution Environment) on **0G Compute**, computes technical indicators, decides whether to execute, writes an immutable audit receipt to **0G Storage**, and settles the swap on-chain. At no point does any validator, front-runner, or observer see what the user intended to trade.

0G is the privacy and proof backbone for every trade regardless of where it settles: the sealed inference runs on 0G Compute and every decision receipt is anchored on 0G Storage. The vault and settlement live on the selected chain - **0G Galileo, Ethereum Sepolia, Arbitrum Sepolia, Base Sepolia, Avalanche Fuji, Mantle Sepolia, or Sui**.

The problem it solves: every DEX transaction today is visible in the public mempool before it confirms. Bots monitor this pool, see your pending swap, and sandwich you - buying before you and selling after, extracting value at your expense. Orcus eliminates this attack surface. The intent is ECIES-encrypted in your browser, only a sealed TEE enclave can read it, and the swap settles in a single atomic transaction that no one can front-run.

---

## Table of Contents

- [What Orcus Does](#what-orcus-does)
- [Why It Exists](#why-it-exists)
- [How It Works](#how-it-works)
  - [The Encryption Layer](#the-encryption-layer)
  - [Strategy Intelligence](#strategy-intelligence)
  - [The Agent](#the-agent)
  - [The Contracts](#the-contracts)
  - [Settlement: Mock Router vs Real Uniswap](#settlement-mock-router-vs-real-uniswap)
  - [The Dashboard](#the-dashboard)
- [0G Integration](#0g-integration)
- [Supported Chains](#supported-chains)
- [Deployed Contracts](#deployed-contracts)
- [Live On-Chain Activity](#live-on-chain-activity)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Security Model](#security-model)
- [For Judges / Reviewers](#for-judges--reviewers)

---

## What Orcus Does

Orcus is three systems working together:

1. **A Strategy Vault** (per chain). A contract that holds user deposits and encrypted intents. Only the authorized TEE agent can trigger execution, and even then it has zero discretion over the swap - the vault builds the call itself and enforces an independent oracle price floor. Users can withdraw at any time. Deployed on six EVM chains (Solidity) and Sui (Move).

2. **An autonomous agent.** A TypeScript service - one process per chain - that watches its vault for new intents, decrypts them with the ECIES private key, computes indicators, runs sealed inference on 0G Compute, writes an audit receipt to 0G Storage, and submits an EIP-712-signed execution to the vault.

3. **A web dashboard.** A Next.js application where users pick a chain, encrypt their strategy in-browser, deposit funds, monitor intent lifecycle, view execution proofs, and track trade history across all chains.

The result: a user describes a strategy in the dashboard, the strategy is encrypted before it leaves the browser, deposited to the vault as opaque bytes, picked up by the agent, decrypted inside an Intel TDX enclave, evaluated, executed as a swap, and settled - with a permanent proof receipt on 0G Storage. The mempool never sees a readable intent.

---

## Why It Exists

MEV (Maximal Extractable Value) costs DeFi users tens of millions of dollars annually. Sandwich attacks alone extracted around $60M from Ethereum traders in the past year. The attack works because every pending swap sits in a public waiting room before it confirms.

Existing solutions - private mempools, commit-reveal schemes, MEV-Share - all make tradeoffs. Private mempools centralize trust. Commit-reveal adds latency and requires two transactions. MEV-Share still leaks partial information.

Orcus encrypts the intent at the source with a key only a TEE enclave can access. The enclave runs on 0G Compute, which guarantees that neither the node operator nor any external observer can read the intent or the decision logic. By the time anything hits the chain, the swap is already done.

This is not a theoretical design. The repository contains a working end-to-end flow with verified trade executions, including a **real Uniswap V3 swap settling in real USDC on Ethereum Sepolia** and a live trade on Sui.

---

## How It Works

### The Encryption Layer

The user composes a strategy in the web dashboard. Before it leaves the browser, it is encrypted using ECIES-256 with the agent's public key. The ciphertext is submitted to the Strategy Vault alongside a deposit of the native token - all in a single transaction.

```
User strategy, ECIES-256 encrypted in the browser, becomes 0x04a9...bf96a1...ca2659 (opaque)

On-chain, anyone can see:
  - A deposit of native tokens to the vault
  - A blob of encrypted bytes
  - Nothing about what the user wants to do
```

The encryption uses `eciesjs`. The agent's ECIES public key is published in the frontend so the browser can encrypt without any server round-trip.

### Strategy Intelligence

Orcus supports two ways to express a strategy:

- **Simple mode** - describe it in plain English ("buy when RSI dips under 30 and price is below the 1h moving average"). A server-side call to the TEE parses it into typed conditions, which are shown back to you as a read-only summary before you submit.
- **Advanced mode** - specify conditions exactly with a term builder: indicator (price / RSI / MA / volatility / 24h change), period, operator (`<`, `>`, crosses above/below, ...), value or moving-average reference, combined with AND/OR. At least one condition is required; chat is optional.

A critical design point, proven by live feasibility testing: **the 7B model cannot do numeric comparisons reliably.** So evaluation is hybrid - **code is authoritative** for computing indicators, comparing conditions, and deciding the action; the **AI only writes the human-readable reason** (with a deterministic code fallback). The AI never does math, never fetches data, and never changes the decision. A free-text "swap now" intent still routes through the TEE for a straight EXECUTE/WAIT call.

Every condition and its computed value, the action, and the reason are recorded in the 0G Storage receipt, so the full decision trail is independently verifiable.

### The Agent

The agent is a TypeScript Node.js process - **one per chain**, selected by the `CHAIN` env var. On startup it backfills recent blocks for missed `IntentSet` events, then enters a polling loop.

When it finds an active intent:

1. Decrypt the ciphertext with the ECIES private key.
2. Build a structured market snapshot: live price + indicators (MA, RSI, realized volatility) from Binance klines (CoinGecko fallback).
3. Decide:
   - typed strategy: evaluate the conditions in code (authoritative action), then ask the TEE for a one-sentence reason;
   - free-text goal: sealed inference on 0G Compute returns EXECUTE or WAIT.
4. Upload the decision receipt to 0G Storage (always on Galileo) and get a merkle root hash.
5. Sign the execution parameters with EIP-712 (`ExecParams`) and call `executeTrade()` on the vault, passing a fresh price update applied atomically inside the same transaction.
6. The vault refreshes the oracle, computes the slippage floor, performs the swap, and sends the settlement token directly to the user.

The sealed inference call uses the 0G Compute OpenAI-compatible endpoint authenticated with a per-provider `app-sk-*` key. The pinned model is **qwen2.5-omni-7b (TeeML)** running in an Intel TDX enclave.

### The Contracts

**EVM (Solidity 0.8.24, `evmVersion: cancun`):**

- **StrategyVault** - the core contract. Users deposit native via `depositNative()` or an ERC-20 via `depositToken()` with an encrypted goal and a max-slippage. Only the agent can call `executeTrade()`, and it carries **zero calldata discretion**: the vault builds the swap, forces the recipient to itself, reads an independent oracle price floor, and verifies an **EIP-712 attestation** (`ExecParams{user,tokenOut,fee,agentMinOut,deadline,receiptHash,nonce}`) signed by the attestor. Per-user nonce (replay-safe), `requestCancel()` escape hatch with a cooldown, `Ownable2Step` + `ReentrancyGuard` + `Pausable`. `routerKind` selects the original Uniswap V3 SwapRouter (with deadline) or SwapRouter02 (no deadline).
- **OrcusOracle** - a push price oracle. The vault calls `updatePrice()` atomically inside `executeTrade()` with the live Binance price, so the slippage floor is always fresh (no staleness window).
- **OrcusRouter** - the mock DEX used where testnets have no real liquidity. Pulls `tokenIn` and pays `tokenOut` at the oracle price, no spread - a stand-in for an AMM.
- **OrcusUSDC (oUSDC)** - the mock settlement token (OZ ERC-20, one-way `finishMinting`).
- **WrappedNative** - a minimal WETH9 for wrapping native deposits.
- **PythPriceOracle** - a real Pyth pull adapter (same `IPriceOracle` interface) for the production/mainnet path.

**Sui (Move):** an `orcus` package with `orcus_usdc` (coin), `oracle` (atomic push + expected-out), `dex` (mock swap), and `vault` (capability-gated, ed25519 attestation, oracle floor, per-user nonce, cancel cooldown).

### Settlement: Mock Router vs Real Uniswap

Testnet DEX pools are mostly empty, so a real swap there would just revert. Orcus handles this per chain:

- **Five EVM chains + Sui** run the self-contained **mock router** (OrcusRouter / Move `dex`) and settle in **mock oUSDC**, priced from the live Binance feed.
- **Ethereum Sepolia** is different: it has a deep, real Uniswap V3 WETH/USDC pool, so its vault points at the **real Uniswap V3 SwapRouter02** and settles in **real USDC** (6 decimals). This is the same `StrategyVault` contract - only `swapRouter`/`routerKind`/`tokenOut` differ.

The real-Uniswap path is proven end-to-end on Sepolia: a deposit was swapped through the real SwapRouter02 and the user received real USDC, with the decision receipt on 0G Storage. (Note: testnet pools are not arbitraged, so Sepolia's pool is mispriced ~10x; since the flow sells WETH for USDC the pool overpays and the oracle floor - a minimum - clears comfortably. On a real arbitraged pool the same floor is tight.)

### The Dashboard

A Next.js 16 (App Router) application with wagmi v2 + viem + RainbowKit for EVM and `@mysten/dapp-kit` + `@mysten/sui` for Sui, sharing one React Query client.

Pages:
- `/strategy` - the intent terminal. Pick a chain, build a strategy (Simple or Advanced), choose native or ERC-20, set amount + slippage, encrypt in-browser, submit.
- `/dashboard` - vault overview for the active chain: balance, intent lifecycle banner, withdrawal + `requestCancel` controls.
- `/activity` - protocol-wide `TradeExecuted` feed (no wallet required).
- `/history` - the connected wallet's trade history, aggregated across all EVM chains or read from Sui.
- `/proof/[hash]` - proof viewer: fetches the JSON receipt from 0G Storage by its merkle root and renders the verdict, market inputs, oracle floor, and (for typed strategies) the full condition-by-condition decision trail, with a chain-aware explorer link.

A navbar chain selector switches the active chain (auto-switching the EVM network) and the connect button is VM-aware (RainbowKit for EVM, dapp-kit for Sui).

---

## 0G Integration

**0G Compute** - sealed AI inference. The agent sends the decrypted intent and market data to qwen2.5-omni-7b running inside an Intel TDX enclave. Input, output, and weights are invisible to the node operator. Authenticated via an `app-sk-*` bearer token. This is what makes MEV resistance possible: the decision logic never leaves the enclave in plaintext.

**0G Storage** - immutable audit receipts. Before every execution the agent uploads a JSON receipt (user, market snapshot + indicators, oracle, TEE verdict, and the typed-strategy trail) to 0G Storage on Galileo. The upload returns a merkle root that is stored on-chain in the `TradeExecuted` event, creating a permanent, independently verifiable link between an execution and its proof. **0G Storage is always used regardless of the trading chain** - a Sepolia or Sui trade still anchors its receipt on 0G.

**0G Chain** - the Galileo vault settles natively, the agent's storage wallet pays storage fees on Galileo, and 0G is the home network of the whole system.

---

## Supported Chains

| Chain | Chain ID | Native | DEX | Settlement |
| ----- | -------- | ------ | --- | ---------- |
| 0G Galileo | 16602 | OG | Mock OrcusRouter | oUSDC (18) |
| Ethereum Sepolia | 11155111 | ETH | **Real Uniswap V3** | **Real USDC (6)** |
| Arbitrum Sepolia | 421614 | ETH | Mock OrcusRouter | oUSDC (18) |
| Base Sepolia | 84532 | ETH | Mock OrcusRouter | oUSDC (18) |
| Avalanche Fuji | 43113 | AVAX | Mock OrcusRouter | oUSDC (18) |
| Mantle Sepolia | 5003 | MNT | Mock OrcusRouter | oUSDC (18) |
| Sui | testnet | SUI | Mock Move `dex` | oUSDC (6) |

Shared agent/attestor/owner across all EVM chains: `0x17A076d6cCaf37Bc9386EAB653A5EfAd8B07430C`.

---

## Deployed Contracts

### 0G Galileo (16602) - [ChainScan](https://chainscan-galileo.0g.ai)
| Contract | Address |
| -------- | ------- |
| StrategyVault | `0x21D50633853DDbecA1920C553f1D89b2d3E9847f` |
| OrcusOracle (push) | `0x3A18BD556a1De367642bf576186c1f28646c11c9` |
| OrcusRouter (mock) | `0x7C086017E2CE9d9202E02Ce602f2aD67Aa864270` |
| OrcusUSDC (oUSDC) | `0x58F995999cae47d39e987e393b9fdd422f43cec5` |
| WrappedNative | `0x5dF3176B4ED3813f50fEd765Ace918Aea268AC5d` |

### Ethereum Sepolia (11155111) - real Uniswap V3 - [Etherscan](https://sepolia.etherscan.io)
| Contract | Address |
| -------- | ------- |
| StrategyVault | `0x5e08CEd8e3b901B6A46e1488b7a7F52576ceb411` |
| OrcusOracle (push) | `0x23AaF326F53c38CC10a522257cF89746Ca915e0e` |
| Uniswap V3 SwapRouter02 | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` |
| USDC (real, 6 dec) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| WETH9 (real) | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

### Arbitrum Sepolia (421614) / Base Sepolia (84532) / Avalanche Fuji (43113)
Deployed with the same bytecode at deployer nonce 0 on each chain, so the addresses are identical across all three.
| Contract | Address |
| -------- | ------- |
| StrategyVault | `0x3d1360f91521f99C913962ab6fcB15B62653CAEF` |
| OrcusOracle (push) | `0xc8648F849507F3721CD9e5f6B4e24399e4d6418c` |
| OrcusRouter (mock) | `0xD52c32c327368A48774898C815531B4DE44D04ed` |
| OrcusUSDC (oUSDC) | `0xD5bdd124De482d3e0244F6122E403983A4E25D62` |
| WrappedNative | `0xceCFFD386AF1dd956Efbd2307da4386399162775` |

Explorers: [Arbitrum Sepolia](https://sepolia.arbiscan.io) · [Base Sepolia](https://sepolia.basescan.org) · [Avalanche Fuji](https://testnet.snowtrace.io)

### Mantle Sepolia (5003) - [Explorer](https://explorer.sepolia.mantle.xyz)
| Contract | Address |
| -------- | ------- |
| StrategyVault | `0x1D97662e187D8964B6a0783865326FEde8d14b8C` |
| OrcusOracle (push) | `0x0bDf25e660a7DA2e38bb8E6Bc1218da17C6f5ad1` |
| OrcusRouter (mock) | `0xe92B828cAE6466cB73eC445caBd30d422138C8E1` |
| OrcusUSDC (oUSDC) | `0x5Bd4ea1D03a73c67f40C1dbF02a1ffb38b7d66d0` |
| WrappedNative | `0xE60B807b3a83dd2f865FFacd1BB57704D1926891` |

### Sui Testnet - [SuiScan](https://suiscan.xyz/testnet)
| Object | ID |
| ------ | -- |
| Package | `0x07e3af4c0e5389fe27b9fc2519cd5ccdfaae772085ce1a9e754aeb55519f9dc8` |
| Vault | `0x47e998d5b287f123e128f54b5b23f6f38a2bde1bf1fa8ad288a74d81b0b154f1` |
| Pool | `0x4bd52b1b7817b13432eb49daf6afdbccfe7808f6498cf93bb8e2302d67110973` |
| Oracle | `0xc00b3ad57a1f0bf64bc4f51aae31d4a7820f3d13b956dc866c149c72d729b826` |
| oUSDC coin type | `<package>::orcus_usdc::ORCUS_USDC` |

---

## Live On-Chain Activity

- **Ethereum Sepolia, real Uniswap V3** - [execute tx](https://sepolia.etherscan.io/tx/0x7fc0fa217139692fc4f0be381f388fd7297da36403d2f1e84608a2e206135837): 0.001 ETH swapped to real USDC through the real SwapRouter02, settled to the user. Receipt root `0xffc58d328c029165881741c390636503177ac6addab517821eb5fd9d741548a2` ([on 0G Storage](https://indexer-storage-testnet-turbo.0g.ai/file?root=0xffc58d328c029165881741c390636503177ac6addab517821eb5fd9d741548a2)).
- **Sui** - first live end-to-end run: a SUI deposit swapped via the Move `dex`, with receipt root `0x2ed4dc1c4f8c20771a877fd53e510574cae4fad47c24c2ba8945d9bfa83cfd0c` on 0G Storage.
- **0G Storage receipts** - [StorageScan submissions](https://storagescan-galileo.0g.ai/submissions) (uploader `0x17A076d6cCaf37Bc9386EAB653A5EfAd8B07430C`).

---

## Project Structure

```
orcus/
├── contracts/                          - hardhat + solidity 0.8.24 (evmVersion: cancun)
│   ├── contracts/
│   │   ├── StrategyVault.sol           - intent vault, EIP-712 attestation, oracle floor, routerKind
│   │   ├── OrcusOracle.sol             - push price oracle (atomic update in executeTrade)
│   │   ├── OrcusRouter.sol             - mock DEX (oracle-priced swap, no liquidity needed)
│   │   ├── OrcusUSDC.sol               - mock settlement token (OZ ERC-20)
│   │   ├── WrappedNative.sol           - minimal WETH9
│   │   ├── PythPriceOracle.sol         - real Pyth pull adapter (mainnet path)
│   │   └── interfaces/                 - ISwapRouter, ISwapRouter02, IPriceOracle, IWrappedNative
│   ├── scripts/deploy.ts               - mock | real | realpush deploy modes
│   ├── test/                           - vault suite + Arbitrum & Sepolia Uniswap fork tests
│   └── hardhat.config.ts               - galileo + 6 testnets
│
├── agent/                              - typescript node.js service (one process per chain)
│   ├── src/
│   │   ├── index.ts                    - EVM event loop, decide, EIP-712 execute
│   │   ├── chains.ts                   - per-chain config (CHAIN env selects)
│   │   ├── indicators.ts               - MA / RSI / volatility snapshot
│   │   ├── price/                      - binance feed, pyth (Hermes VAA) update builder
│   │   ├── strategy/                   - typed schema, code evaluator, indicator adapter, AI narration
│   │   ├── crypto/ecies.ts             - intent decryption
│   │   ├── tee/sealedDecide.ts         - 0G Compute inference (qwen2.5-omni-7b, TeeML)
│   │   ├── storage/writeReceipt.ts     - 0G Storage upload (always Galileo)
│   │   ├── sign/                       - EIP-712 (EVM) + ed25519 (Sui) attestation
│   │   ├── sui/                        - Sui listener + PTB execution
│   │   └── scripts/                    - intent:evm / intent:sui test depositors, setup
│   ├── agents.sh                       - run all agents locally (one command)
│   └── ecosystem.config.cjs            - pm2 config for the host
│
├── sui/                                - move package "orcus" (coin, oracle, dex, vault)
│
└── web/                                - next.js 16 (app router)
    └── src/
        ├── app/                        - strategy, dashboard, activity, history, vault, proof
        ├── components/                 - navbar, chain selector, VM-aware connect, strategy builder
        └── lib/                        - chain registry, wagmi + dapp-kit config, encryption, receipts
```

---

## Quick Start

You need Node 20+ and npm. The three folders are independent npm projects - install each separately. The agent needs gas on whichever chain(s) you run.

```bash
git clone <repo-url> && cd orcus

# 1. contracts (already deployed; redeploy only if needed)
cd contracts && npm install && npx hardhat compile
#   mock stack (any EVM testnet):  DEPLOY_MODE=mock     AGENT_ADDRESS=0x.. npx hardhat run scripts/deploy.ts --network galileo
#   real Uniswap (Sepolia):        DEPLOY_MODE=realpush AGENT_ADDRESS=0x.. SWAP_ROUTER=.. WETH=.. USDC=.. npx hardhat run scripts/deploy.ts --network sepolia

# 2. agent
cd ../agent && npm install
npm run setup                 # one-time 0G Compute access (ledger + app-sk key)
CHAIN=galileo npm run start   # run one chain
./agents.sh                   # or run all chains (EVM + Sui) locally
# pm2 start ecosystem.config.cjs   # or run on a host with pm2

# 3. web dashboard
cd ../web && npm install && npm run dev   # http://localhost:3000
```

### Environment Variables

**agent/.env** (per-chain vars fall back to shared ones; see `.env.example`)
```
AGENT_PRIVATE_KEY=<executor/attestor key, funded on each chain>
AGENT_ECIES_PRIVATE_KEY=<ecies key for decrypting intents>
STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
ZG_SERVICE_URL=<from setup>            # 0G Compute endpoint
ZG_API_SECRET=<from setup>             # app-sk-* token
# per-chain (e.g. SEPOLIA_VAULT / SEPOLIA_USDC / SEPOLIA_RPC, GALILEO_RPC, ...)
SEPOLIA_VAULT=0x5e08CEd8e3b901B6A46e1488b7a7F52576ceb411
SEPOLIA_USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

**web/.env** (chain registry lives in `src/lib/chains.ts`; only keys/secrets are env)
```
NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY=<ecies public key hex>
NEXT_PUBLIC_WC_PROJECT_ID=<walletconnect project id>
# server-only TEE creds for /api/parse-strategy (NOT NEXT_PUBLIC):
ZG_SERVICE_URL=<0G compute endpoint>
ZG_API_SECRET=<app-sk-* token>
ZG_MODEL=qwen/qwen2.5-omni-7b
```

### Testing the Full Flow

1. Open `http://localhost:3000`, pick a chain in the navbar, connect a wallet (MetaMask for EVM, Slush/Suiet for Sui).
2. Go to `/strategy`, build a strategy (Simple or Advanced), set amount + slippage, submit. The browser encrypts the intent and deposits it in one transaction.
3. The agent for that chain (`CHAIN=<key> npm run start`) detects the intent, decrypts, computes indicators, decides, uploads the receipt, and executes.
4. Check `/dashboard` and `/history` for the `TradeExecuted` event and the settlement token in your wallet; open `/proof/<hash>` to verify the receipt on 0G Storage.

You can also create a test intent without the UI: `CHAIN=<key> npm run intent:evm` (EVM) or `npm run intent:sui` (Sui).

---

## Tech Stack

| Layer | Tool |
| ----- | ---- |
| Smart Contracts | Solidity 0.8.24 (cancun), Hardhat, OpenZeppelin v5, ethers v6 |
| Sui | Move package (coin / oracle / dex / vault), ed25519 attestation |
| Agent Runtime | TypeScript, Node.js, tsx, vitest |
| TEE Inference | 0G Compute, qwen2.5-omni-7b, Intel TDX (TeeML) |
| Audit Storage | 0G Storage SDK (@0gfoundation/0g-ts-sdk), merkle proofs |
| Market Data | Binance klines (CoinGecko fallback), MA / RSI / volatility |
| Encryption | ECIES-256 (eciesjs) |
| Frontend | Next.js 16, React 19, wagmi v2, viem, RainbowKit, @mysten/dapp-kit + @mysten/sui |
| Oracles | OrcusOracle (push) on testnets; Pyth pull adapter for mainnet |
| Chains | 0G Galileo + Ethereum/Arbitrum/Base Sepolia, Avalanche Fuji, Mantle Sepolia, Sui |

---

## Security Model

| Threat | How Orcus handles it |
| ------ | -------------------- |
| Front-running / sandwich attacks | Intent is ECIES-encrypted before leaving the browser. Mempool sees only opaque bytes. |
| Agent calldata manipulation | The vault builds the swap itself and forces `recipient = self`; the agent supplies no swap calldata. |
| Bad-price / manipulated fills | An independent oracle price floor is read atomically in `executeTrade`; output below the floor reverts. |
| Replay / forged execution | Each execution requires an EIP-712 attestation over a per-user nonce; nonces increment on use. |
| Validator collusion | Only the authorized agent address can call `executeTrade`. |
| Node operator reading strategy | 0G Compute runs inference inside Intel TDX enclaves; input, output, and weights are invisible to the operator. |
| Agent misbehavior | Every execution embeds a 0G Storage receipt hash with the full decision trail. Anyone can download and verify. |
| Custodial risk | Users withdraw at any time via `withdraw()`, plus a `requestCancel()` escape hatch. The vault is non-custodial; `Ownable2Step` + `ReentrancyGuard` + `Pausable`. |
| Key compromise | The ECIES private key is held only by the agent; in production it lives inside the TEE enclave. |

---

## For Judges / Reviewers

### Network Setup (0G Galileo)

| Field | Value |
| ----- | ----- |
| Network Name | 0G Galileo Testnet |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Chain ID | `16602` |
| Currency Symbol | OG |
| Block Explorer | `https://chainscan-galileo.0g.ai` |

Other chains use their standard public testnet RPCs (see `agent/.env.example` and `web/src/lib/chains.ts`). Get testnet OG from the [0G Faucet](https://faucet.0g.ai) or [Chainlink Faucet](https://faucets.chain.link/0g-testnet-galileo).

### On-chain Proof of 0G Integration

| Component | Evidence |
| --------- | -------- |
| 0G Chain | [StrategyVault on ChainScan](https://chainscan-galileo.0g.ai/address/0x21D50633853DDbecA1920C553f1D89b2d3E9847f) |
| 0G Compute | Sealed inference via 0G Compute (see `agent/src/tee/sealedDecide.ts`) |
| 0G Storage | [Receipts on StorageScan](https://storagescan-galileo.0g.ai/submissions); live receipt root `0xffc58d32...548a2` |
| Real Uniswap settlement | [Sepolia execute tx](https://sepolia.etherscan.io/tx/0x7fc0fa217139692fc4f0be381f388fd7297da36403d2f1e84608a2e206135837) |

### Why 0G Is Essential

**0G Compute** makes MEV resistance possible - without sealed inference, the agent's decision logic would be visible to the node operator. **0G Storage** provides the accountability layer - every decision is a merkle-anchored receipt linked on-chain. Both are used for *every* trade, on *every* chain, including the real-Uniswap Sepolia settlement and the Sui trade. **0G Chain** is the home network where the system and its proofs live.

### What to Look For

1. The ciphertext on-chain (the first arg of `depositNative` is opaque encrypted bytes).
2. The agent terminal: decrypt, indicators, TEE decision, 0G Storage upload, EIP-712 execute.
3. The settlement token arriving in the user's wallet (real USDC on Sepolia, oUSDC elsewhere).
4. The `TradeExecuted` event carrying the storage receipt hash.
5. The receipt rendered in `/proof/<hash>`, including the typed-strategy decision trail.

---

*Your intent. Encrypted. Sealed. Settled. Across chains.*
