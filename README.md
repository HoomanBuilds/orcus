<p align="center">
  <img src="assets/logo-dark.png#gh-light-mode-only" alt="Orcus" width="80" />
  <img src="assets/logo-light.png#gh-dark-mode-only" alt="Orcus" width="80" />
</p>

<h1 align="center">Orcus</h1>

> An MEV-resistant dark pool agent that keeps your trading intent encrypted until settlement is final.

Orcus is an autonomous trading agent built on 0G. Users submit encrypted trading strategies to a Strategy Vault on 0G Chain. The agent decrypts them inside a TEE (Trusted Execution Environment) via 0G Compute, consults live market data, decides whether to execute, writes an immutable audit receipt to 0G Storage, and settles the swap on-chain. At no point does any validator, front-runner, or observer see what the user intended to trade.

The problem it solves: every DEX transaction today is visible in the public mempool before it confirms. Bots monitor this pool, see your pending swap, and sandwich you - buying before you and selling after, extracting value at your expense. Orcus eliminates this attack surface entirely. The intent is ECIES-encrypted in your browser, only a sealed TEE enclave can read it, and the swap settles in a single atomic transaction that no one can front-run.

This repository is the working testnet build, submitted for the 0G APAC Hackathon (Track 2: Agentic Trading Arena).

---

## Table of Contents

- [What Orcus Does](#what-orcus-does)
- [Why It Exists](#why-it-exists)
- [How It Works](#how-it-works)
  - [The Encryption Layer](#the-encryption-layer)
  - [The Agent](#the-agent)
  - [The Contracts](#the-contracts)
  - [The Dashboard](#the-dashboard)
- [0G Integration](#0g-integration)
- [Deployed Contracts](#deployed-contracts)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Security Model](#security-model)

---

## What Orcus Does

Orcus is three systems working together:

1. **A Strategy Vault.** A Solidity contract on 0G Galileo that holds user deposits and encrypted intents. Only the authorized TEE agent can trigger execution. Users can withdraw at any time.

2. **An autonomous agent.** A TypeScript service that watches the vault for new intents, decrypts them using the ECIES private key, runs sealed inference on 0G Compute to decide whether to execute, writes an audit receipt to 0G Storage, and settles the swap on-chain.

3. **A web dashboard.** A Next.js application where users encrypt their strategy in-browser, deposit funds, monitor intent lifecycle, view execution proofs, and track their trade history.

The result: a user types "swap my OG to USDC now" into the dashboard, the text gets encrypted before it leaves the browser, deposited to the vault as opaque bytes, picked up by the agent, decrypted inside an Intel TDX enclave, executed as a swap, and settled - with a permanent proof receipt stored on 0G Storage. The mempool never sees a readable intent.

---

## Why It Exists

MEV (Maximal Extractable Value) costs DeFi users tens of millions of dollars annually. Sandwich attacks alone extracted around $60M from Ethereum traders in the past year. The attack works because every pending swap sits in a public waiting room before it confirms.

Existing solutions - private mempools, commit-reveal schemes, MEV-Share - all make tradeoffs. Private mempools centralize trust. Commit-reveal adds latency and requires two transactions. MEV-Share still leaks partial information.

Orcus takes a different approach. The intent is encrypted at the source with a key only a TEE enclave can access. The enclave runs on 0G Compute, which guarantees that neither the node operator nor any external observer can read the intent or the decision logic. By the time anything hits the chain, the swap is already done.

This is not a theoretical design. The repository contains a working end-to-end flow on 0G Galileo testnet with verified trade executions.

---

## How It Works

### The Encryption Layer

The user types a natural-language strategy into the web dashboard. Before it leaves the browser, it is encrypted using ECIES-256 with the agent's public key. The ciphertext is then submitted to the Strategy Vault alongside a deposit of native OG tokens - all in a single transaction.

```
User types: "swap my OG to USDC immediately"

Browser encrypts with ECIES-256:
  plaintext  →  0x04a9...bf96a1...ca2659 (opaque ciphertext)

On-chain, anyone can see:
  - A deposit of 0.1 OG to the vault
  - A blob of encrypted bytes
  - Nothing about what the user wants to do
```

The encryption uses the `eciesjs` library. The agent's ECIES public key is published in the frontend environment so the browser can encrypt without any server round-trip.

### The Agent

The agent is a TypeScript Node.js process that runs continuously. On startup it backfills the last 5000 blocks for any missed `IntentSet` events, then enters a 4-second polling loop for new ones.

When it finds an active intent:

1. Decrypt the ciphertext using the ECIES private key.
2. Fetch a live market snapshot from CoinGecko (OG price, 24h change, trend direction).
3. Send the decrypted intent and market data to 0G Compute for sealed inference. The model (Qwen 2.5-7B Instruct) runs inside an Intel TDX enclave and returns either `EXECUTE` or `WAIT`.
4. If `EXECUTE`: upload the decision JSON to 0G Storage. The upload returns a merkle root hash.
5. Call `executeTradeWithProof()` on the vault, passing the swap calldata, the TEE attestation placeholder, and the storage receipt hash.
6. The vault forwards the deposit to the OrcusRouter, which converts OG to oUSDC and sends it directly to the user's wallet.

The agent's sealed inference call goes through the 0G Compute Router - an OpenAI-compatible HTTP endpoint authenticated with per-provider API keys generated via the `0g-compute-cli`. The system prompt instructs the model to always execute when the user's intent contains words like "now" or "immediately," and only return `WAIT` for conditional intents.

### The Contracts

Three contracts are deployed on 0G Galileo (Chain ID 16602):

**StrategyVault** - The core contract. Users deposit OG and submit encrypted intents via `depositAndSetIntent()`. Only the authorized TEE agent address can call `executeTradeWithProof()`, which validates the calldata shape (must be `exactInputSingle`), enforces on-chain slippage limits if configured, forwards the deposit to the router, and emits a `TradeExecuted` event with the storage receipt hash.

**OrcusRouter** - A swap router that accepts native OG and transfers oUSDC to the specified recipient at a fixed exchange rate (1 OG = 0.50 oUSDC). It parses the `exactInputSingle` calldata to extract the recipient address, calculates the output amount, transfers oUSDC, and returns `amountOut` for the vault's slippage check.

**OrcusUSDC (oUSDC)** - A minimal ERC-20 used as the settlement token. The deployer mints liquidity to the router. 18 decimals, standard transfer/approve/transferFrom interface.

### The Dashboard

The web frontend is a Next.js 15 application with App Router, wagmi v2, viem, and RainbowKit for wallet connectivity.

Pages:
- `/strategy` - The intent terminal. Type a strategy, pick a token (USDC or USDT), set an amount, encrypt in-browser, submit to the vault. Shows the three-step progress indicator (Encrypt, Submit, Execute).
- `/dashboard` - Vault overview with live balance, intent lifecycle banner (pending/executed), protocol activity feed, and withdrawal controls. Polls via TanStack Query with shared cache.
- `/activity` - Protocol-wide feed of all `TradeExecuted` events. No wallet required.
- `/history` - User's personal trade history filtered by address.
- `/proof/[hash]` - Proof viewer showing the merkle root, verification steps, and links to StorageScan and ChainScan.

State management uses wagmi hooks for contract reads (auto-refetch every 8s), TanStack Query for event polling (shared across pages, 15s interval, block-anchored to avoid scanning from genesis), and a toast notification system for transaction confirmations.

---

## 0G Integration

Orcus uses three core 0G components:

**0G Compute** - Sealed AI inference. The agent sends the decrypted intent and market data to a Qwen 2.5-7B model running inside an Intel TDX enclave on the 0G Compute network. The model's input, output, and weights are invisible to the node operator. The inference call is authenticated via `app-sk-*` bearer tokens generated through the `0g-compute-cli` setup flow.

**0G Storage** - Immutable audit receipts. Before executing each trade, the agent uploads a JSON receipt (containing the user address, the TEE decision, and a timestamp) to 0G Storage on Galileo testnet. The upload returns a merkle root hash that is then stored on-chain in the `TradeExecuted` event, creating a permanent, independently verifiable link between the execution and its proof.

**0G Chain** - All smart contracts (StrategyVault, OrcusRouter, OrcusUSDC) are deployed natively on 0G Galileo (Chain ID 16602). The agent polls events, submits transactions, and settles swaps directly on 0G Chain.

---

## Deployed Contracts

All contracts are live on 0G Galileo Testnet (Chain ID 16602).

| Contract | Address | Explorer |
| -------- | ------- | -------- |
| StrategyVault | `0xc624fFC2c9069a53e0D62CF5172fB10aDDA2D205` | [View](https://chainscan-galileo.0g.ai/address/0xc624fFC2c9069a53e0D62CF5172fB10aDDA2D205) |
| OrcusRouter | `0xA8325455Daa5A0150174bD2d7A7f80828627D4Ff` | [View](https://chainscan-galileo.0g.ai/address/0xA8325455Daa5A0150174bD2d7A7f80828627D4Ff) |
| OrcusUSDC (oUSDC) | `0xf63c7CC79CD0b76399E56a432cd2aF9eD36D8740` | [View](https://chainscan-galileo.0g.ai/address/0xf63c7CC79CD0b76399E56a432cd2aF9eD36D8740) |

Verified on-chain activity:
- [Trade execution tx](https://chainscan-galileo.0g.ai/tx/0x7484203319ccd3730779c8240b92b8a701e750ec1c2ebf993f409c7a0a00a73b) - 0.1 OG swapped to 0.05 oUSDC via sealed TEE decision
- [Storage receipts](https://storagescan-galileo.0g.ai/submissions) - Uploaded decision proofs visible on StorageScan

---

## Project Structure

```
orcus/
├── contracts/                                - hardhat + solidity 0.8.24 (evmVersion: cancun)
│   ├── contracts/
│   │   ├── StrategyVault.sol                 - intent vault with TEE-only execution
│   │   ├── OrcusRouter.sol                   - swap router (OG to oUSDC, fixed rate)
│   │   └── OrcusUSDC.sol                     - settlement stablecoin (ERC-20)
│   ├── scripts/
│   │   ├── deploy.ts                         - standard deploy script
│   │   └── deploy-demo.js                    - deploys all three contracts + mints liquidity
│   ├── test/
│   │   └── StrategyVault.test.ts             - 7 unit tests covering full vault lifecycle
│   └── hardhat.config.ts
│
├── agent/                                    - typescript node.js service
│   ├── src/
│   │   ├── index.ts                          - event loop, backfill, execution orchestration
│   │   ├── env.ts                            - environment variable loader
│   │   ├── market.ts                         - coingecko price feed with fallback
│   │   ├── crypto/
│   │   │   └── ecies.ts                      - ECIES decryption of user intents
│   │   ├── tee/
│   │   │   └── sealedDecide.ts               - 0G Compute inference (Qwen 2.5-7B via TDX)
│   │   ├── storage/
│   │   │   └── writeReceipt.ts               - 0G Storage upload (merkle root receipt)
│   │   ├── dex/
│   │   │   └── jaine.ts                      - swap calldata builder (exactInputSingle)
│   │   └── scripts/
│   │       └── setup.ts                      - one-time 0G Compute setup (ledger + API key)
│   ├── patches/
│   │   └── 0g-ts-sdk-market-fix.sh           - SDK patch for testnet compatibility
│   └── package.json
│
└── web/                                      - next.js 15 (app router) + rainbowkit + wagmi
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                      - landing page
    │   │   ├── strategy/page.tsx             - encrypt and submit intents
    │   │   ├── dashboard/page.tsx            - vault overview + intent lifecycle
    │   │   ├── activity/page.tsx             - protocol-wide execution feed
    │   │   ├── history/page.tsx              - user's personal trade history
    │   │   ├── vault/page.tsx                - vault management + withdraw
    │   │   └── proof/[hash]/page.tsx         - receipt verification viewer
    │   ├── components/
    │   │   ├── navbar.tsx                    - wallet button + navigation
    │   │   ├── toast.tsx                     - notification system
    │   │   ├── intent-status-banner.tsx      - intent lifecycle (pending/executed)
    │   │   └── wallet-gate.tsx               - connect-wallet prompt
    │   ├── hooks/
    │   │   └── useVaultEvents.ts             - shared TanStack Query event hooks
    │   └── lib/
    │       ├── vaultAbi.ts                   - contract ABI
    │       ├── vaultEvents.ts                - event fetching + block anchor
    │       ├── encrypt.ts                    - ECIES encryption (browser-side)
    │       ├── tokens.ts                     - swap target tokens
    │       ├── chain.ts                      - 0G Galileo chain definition
    │       └── wagmi.ts                      - wagmi + rainbowkit config
    └── package.json
```

---

## Quick Start

You need Node 20+, npm, and a browser. The agent needs OG tokens on Galileo testnet for gas.

```bash
# clone
git clone <repo-url>
cd orcus

# 1. contracts (optional - already deployed on Galileo)
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy-demo.js --network galileo

# 2. agent
cd ../agent
npm install

# one-time: set up 0G Compute access (creates ledger, generates API key)
# requires 0g-compute-cli installed and 4+ OG in the wallet
npm run setup

# run the agent
npm run start

# 3. web dashboard
cd ../web
npm install
npm run dev
# open http://localhost:3000
```

### Environment Variables

**agent/.env**
```
GALILEO_RPC=https://evmrpc-testnet.0g.ai
AGENT_PRIVATE_KEY=<private-key-with-OG-balance>
AGENT_ECIES_PRIVATE_KEY=<ecies-private-key-for-decryption>
VAULT_ADDRESS=0xc624fFC2c9069a53e0D62CF5172fB10aDDA2D205
STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
ZG_SERVICE_URL=<from-setup-script>
ZG_API_SECRET=<from-setup-script>
```

**web/.env**
```
NEXT_PUBLIC_VAULT_ADDRESS=0xc624fFC2c9069a53e0D62CF5172fB10aDDA2D205
NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY=<ecies-public-key-hex>
NEXT_PUBLIC_WC_PROJECT_ID=<walletconnect-project-id>
```

### Testing the Full Flow

1. Open `http://localhost:3000`, connect MetaMask on 0G Galileo network.
2. Navigate to `/strategy`. Type a goal like "swap my OG to USDC now", select USDC, enter amount.
3. Submit. The browser encrypts the intent, then deposits OG + ciphertext to the vault in one transaction.
4. The agent (running via `npm run start`) detects the intent within 4 seconds.
5. Agent decrypts, calls 0G Compute for sealed inference, uploads receipt to 0G Storage, executes the swap.
6. Check `/dashboard` - you will see the TradeExecuted event and oUSDC in your wallet.
7. Click the proof link to verify the storage receipt on StorageScan.

The full cycle takes about 10-15 seconds from submission to settlement.

---

## Tech Stack

| Layer | Tool |
| ----- | ---- |
| Smart Contracts | Solidity 0.8.24, Hardhat, ethers v6 |
| Agent Runtime | TypeScript, Node.js, tsx |
| TEE Inference | 0G Compute Router, Qwen 2.5-7B Instruct, Intel TDX |
| Audit Storage | 0G Storage SDK (@0gfoundation/0g-ts-sdk), merkle proofs |
| Encryption | ECIES-256 (eciesjs) |
| Frontend | Next.js 16, React 19, wagmi v2, viem, RainbowKit |
| State Management | TanStack Query (shared event cache, block-anchored polling) |
| Chain | 0G Galileo Testnet (Chain ID 16602) |

---

## Security Model

| Threat | How Orcus handles it |
| ------ | -------------------- |
| Front-running / sandwich attacks | Intent is ECIES-encrypted before leaving the browser. Mempool sees only opaque bytes. |
| Validator collusion | Vault only accepts execution calls from the authorized TEE agent address. No one else can trigger a swap. |
| Node operator reading strategy | 0G Compute runs inference inside Intel TDX enclaves. Input, output, and model weights are invisible to the operator. |
| Agent misbehavior | Every execution includes a `storageReceiptHash` pointing to the full decision record on 0G Storage. Anyone can download and verify. |
| Custodial risk | Users can withdraw their deposit at any time via `withdraw()`. No admin can move user funds. The vault is non-custodial. |
| Key compromise | The ECIES private key is held only by the agent. In production this would live inside the TEE enclave itself, never touching disk. |

---

*Your intent. Encrypted. Sealed. Settled.*
