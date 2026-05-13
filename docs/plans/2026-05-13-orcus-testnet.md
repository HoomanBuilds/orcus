# Orcus — MEV-Resistant Dark Pool Agent (Testnet) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Project codename:** `Orcus` (placeholder, may be renamed later). Use `orcus` for package names, repo identifiers, and on-chain labels until the user instructs otherwise.

**Goal:** Ship an end-to-end testnet build on 0G Galileo of an MEV-resistant dark pool trading agent: ECIES-encrypted intents → Strategy Vault contract → sealed TEE inference on 0G Compute → Jaine DEX execution → audit receipts on 0G Storage → Next.js dashboard.

**Architecture:** Three independent folders under one git repo — `contracts/` (Hardhat + Solidity 0.8.20, evmVersion `cancun`), `agent/` (TypeScript Node service using `@0glabs/0g-serving-broker` and `@0glabs/0g-ts-sdk`), `web/` (Next.js 15 App Router + RainbowKit + wagmi + viem). No workspace tooling — each folder is its own npm project with its own `node_modules`. User encrypts intent with the agent's ECIES public key, deposits into Strategy Vault on 0G Galileo (Chain ID 16602), agent watches events, runs sealed inference inside Intel TDX + NVIDIA H100/H200 enclave, executes Jaine swap with TEE attestation, writes immutable receipt to 0G Storage.

**Tech Stack:** Solidity 0.8.20 (cancun) · Hardhat · ethers v6 · TypeScript · `@0glabs/0g-serving-broker` · `@0glabs/0g-ts-sdk` · Next.js 15 (App Router) · wagmi v2 · viem · RainbowKit · `eciesjs` · Vitest · **npm** (no workspaces).

---

## Source-of-Truth Constants (verified May 2026)

Copy these literally — do **not** invent values.

```
TESTNET (Galileo)
Chain ID:           16602
RPC:                https://evmrpc-testnet.0g.ai
Explorer:           https://chainscan-galileo.0g.ai
Storage Scan:       https://storagescan-galileo.0g.ai
Storage Indexer:    https://indexer-storage-turbo.0g.ai
Faucet:             https://faucet.0g.ai  +  https://faucets.chain.link/0g-testnet-galileo

TEE Providers (verify with broker.inference.listService() at runtime)
deepseek provider:  0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3
gpt-oss provider:   0xf07240Efa67755B5311bc75784a061eDB47165Dd

Critical SDK rules (NON-NEGOTIABLE)
1. evmVersion: "cancun" in ALL Solidity configs
2. ethers v6 only — use waitForDeployment(), getAddress() (NOT v5 patterns)
3. After EVERY inference call, ALWAYS call broker.inference.processResponse(providerAddress, chatID, usageData)
4. Extract ChatID from ZG-Res-Key response header FIRST, body fallback second
5. ALWAYS file.close() in a finally{} block after ZgFile use
```

---

## Hard Operational Rules (read before every task)

1. **Never hand-edit `package.json` to add dependencies.** Always use the install command (`npm install <pkg>`, `npm install -D <pkg>`, `npx create-next-app@latest`, `npx hardhat init`, etc.). The user has explicitly demanded this. Same applies to `tsconfig.json` extension — let CLIs generate it, then edit only fields that need overriding.
2. **Never initialize a project by typing `package.json` from scratch.** Use `npm init -y`, `npx create-next-app`, `npx hardhat init`, etc.
3. **Web frontend MUST be Next.js** (App Router). No Vite/CRA/Remix.
4. **Testnet only.** Never write code that targets mainnet RPC/Chain ID 16661 in this plan.
5. **No Claude attribution** in commits or PRs. One-line conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
6. **Commit in logical parts.** Each task ends with one focused commit.
7. **TDD where the framework supports it.** Contract logic and agent pure functions are test-first. UI is verified by manual browser run plus typecheck.
8. **ethers v6 syntax only** — `JsonRpcProvider`, `Wallet`, `waitForDeployment()`, `getAddress()`, `parseEther`, `formatEther`.
9. **No comments unless WHY is non-obvious.** No docstrings, no banner comments.
10. **Verify TEE providers at runtime** with `broker.inference.listService()` before hardcoding any address into business logic.

---

## High-Level Task Map

| # | Task | Output |
|---|------|--------|
| 0 | Repo bootstrap (git init, root README, .gitignore) | git repo with `docs/`, `.gitignore`, root README |
| 1 | `contracts/` folder bootstrap via `npx hardhat init` | Hardhat TS project, hardhat config patched for 0G Galileo + cancun |
| 2 | `StrategyVault.sol` — failing tests | red Hardhat tests covering deposit / intent / TEE-auth / withdraw |
| 3 | `StrategyVault.sol` — minimal implementation | tests green |
| 4 | Deploy script + Galileo deploy | live contract address on chainscan-galileo |
| 5 | `agent/` folder bootstrap via `npm init -y` + installs | empty TS service with Vitest, env loader |
| 6 | ECIES key utilities (TDD) | `generateKeyPair`, `encryptIntent`, `decryptIntent` |
| 7 | 0G Compute broker wrapper (TDD with mocks) | `sealedDecide()` that calls TEE + always processResponse |
| 8 | 0G Storage audit-log writer (TDD with mocks) | `writeReceipt()` that always closes ZgFile |
| 9 | Jaine swap builder (testnet) | `buildSwapTx()` against verified router |
| 10 | Agent event-loop wiring | `cd agent && npm start` watches vault events end-to-end |
| 11 | `web/` folder bootstrap via `npx create-next-app` | Next.js 15 App Router + Tailwind + TS |
| 12 | Web: wagmi + RainbowKit + 0G Galileo chain config | wallet connect on home page |
| 13 | Web: Set Strategy page (encrypt + deposit) | ECIES encrypt in browser, write to vault |
| 14 | Web: Dashboard + History + Proof Viewer | reads events, links to chainscan + storagescan |
| 15 | E2E rehearsal on testnet | 1 full intent → execution → receipt cycle, recorded |
| 16 | README + submission artefacts | demo links, env template, architecture diagram |

---

## Task 0 — Repo Bootstrap

**Files:**
- Create: `/home/shreyas/code/work/private-defi/.gitignore`
- Create: `/home/shreyas/code/work/private-defi/.nvmrc`
- Create: `/home/shreyas/code/work/private-defi/.env.example`
- Create: `/home/shreyas/code/work/private-defi/README.md`

**Step 0.1: Initialize git**

```bash
cd /home/shreyas/code/work/private-defi
git init -b main
```

There is **no root package.json** in this layout. Each of `contracts/`, `agent/`, `web/` is its own independent npm project with its own `node_modules`. Do not run `npm init` at the repo root.

**Step 0.2 (skipped — no root package.json in this layout)**

**Step 0.3 (skipped — no workspace file)**

**Step 0.4: Write `.gitignore`**

```
node_modules
.env
.env.local
.env.*.local
.DS_Store
dist
build
.next
out
artifacts
cache
typechain-types
coverage
*.log
```

**Step 0.5: Write `.nvmrc`**

```
20
```

**Step 0.6: Write `.env.example`** (root-level template the per-package envs will inherit from documentation-wise)

```
PRIVATE_KEY=0x...
GALILEO_RPC=https://evmrpc-testnet.0g.ai
STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
AGENT_PRIVATE_KEY=0x...
AGENT_ECIES_PRIVATE_KEY=0x...
AGENT_ECIES_PUBLIC_KEY=0x...
VAULT_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY=0x...
NEXT_PUBLIC_CHAIN_ID=16602
NEXT_PUBLIC_RPC=https://evmrpc-testnet.0g.ai
```

**Step 0.7: Minimal root README**

Short README that explains: project name (Orcus), it's a hackathon build, 0G Galileo testnet only, folder layout (`contracts/`, `agent/`, `web/`), and that each folder is installed independently (`cd <folder> && npm install`).

**Step 0.8: Commit**

```bash
git add .
git commit -m "chore: bootstrap orcus repo"
```

---

## Task 1 — Contracts Folder Bootstrap

**Files:**
- Create: `contracts/` (via Hardhat init)
- Modify: `contracts/hardhat.config.ts` (after init)
- Modify: `contracts/package.json` only via `npm install` — never by hand
- Create: `contracts/.env.example`

**Step 1.1: Init Hardhat project**

```bash
cd /home/shreyas/code/work/private-defi
mkdir contracts && cd contracts
npm init -y
npx hardhat@latest --init
```

Choose: **"Create a TypeScript project (with Mocha and Ethers.js)"** when prompted. Accept defaults; do **not** accept any prompt that downgrades to ethers v5. The hardhat CLI will run its own `npm install` to add the toolbox + ethers v6.

**Step 1.2: Verify ethers v6 was installed**

```bash
cd /home/shreyas/code/work/private-defi/contracts
node -e "console.log(require('ethers/package.json').version)"
```

Expected: prints a version starting with `6.`. If it prints `5.`, run `npm install -D ethers@6` and re-run the check.

**Step 1.3: Add dotenv via install command**

```bash
npm install -D dotenv
```

**Step 1.4: Patch `hardhat.config.ts`**

Replace the generated config with:

```ts
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    galileo: {
      url: process.env.GALILEO_RPC ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
```

**Step 1.5: Write `contracts/.env.example`**

```
PRIVATE_KEY=0x...
GALILEO_RPC=https://evmrpc-testnet.0g.ai
AGENT_ADDRESS=0x...
```

**Step 1.6: Sanity compile**

```bash
cd /home/shreyas/code/work/private-defi/contracts
npx hardhat compile
```

Expected: "Compiled X Solidity files successfully" with no errors. If a `Lock.sol` example exists, leave it for now; it'll be replaced in Task 2.

**Step 1.7: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add contracts
git commit -m "feat(contracts): scaffold hardhat for 0G galileo"
```

---

## Task 2 — StrategyVault Failing Tests

**Files:**
- Delete: `contracts/contracts/Lock.sol`, `contracts/test/Lock.ts` (if Hardhat generated them)
- Create: `contracts/test/StrategyVault.test.ts`

**Step 2.1: Remove example files**

```bash
cd /home/shreyas/code/work/private-defi/contracts
rm -f contracts/Lock.sol test/Lock.ts ignition/modules/Lock.ts
```

**Step 2.2: Write test file**

```ts
// contracts/test/StrategyVault.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("StrategyVault", () => {
  async function deploy() {
    const [owner, user, agent, attacker] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("StrategyVault");
    const vault = await Vault.deploy(agent.address);
    await vault.waitForDeployment();
    return { vault, owner, user, agent, attacker };
  }

  it("constructor sets the TEE agent address", async () => {
    const { vault, agent } = await deploy();
    expect(await vault.teeAgentAddress()).to.equal(agent.address);
  });

  it("depositAndSetIntent stores encrypted intent and credits balance", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("ciphertext"));
    const value = ethers.parseEther("0.01");

    await expect(
      vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value })
    )
      .to.emit(vault, "IntentSet")
      .withArgs(user.address, value);

    expect(await vault.balances(user.address)).to.equal(value);
    const intent = await vault.intents(user.address);
    expect(intent.maxSlippage).to.equal(50);
    expect(intent.stopLoss).to.equal(500);
    expect(intent.active).to.equal(true);
  });

  it("reverts deposit with zero value", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await expect(
      vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value: 0 })
    ).to.be.revertedWith("Must deposit funds");
  });

  it("only TEE agent can call executeTradeWithProof", async () => {
    const { vault, user, attacker } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await vault
      .connect(user)
      .depositAndSetIntent(encryptedGoal, 50, 500, { value: ethers.parseEther("0.01") });

    await expect(
      vault
        .connect(attacker)
        .executeTradeWithProof(user.address, "0x", "0x", ethers.ZeroHash)
    ).to.be.revertedWith("Unauthorized");
  });

  it("agent can execute and emits TradeExecuted", async () => {
    const { vault, user, agent } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await vault
      .connect(user)
      .depositAndSetIntent(encryptedGoal, 50, 500, { value: ethers.parseEther("0.01") });

    const receiptHash = ethers.id("receipt-1");
    await expect(
      vault
        .connect(agent)
        .executeTradeWithProof(user.address, "0x", "0xdeadbeef", receiptHash)
    )
      .to.emit(vault, "TradeExecuted")
      .withArgs(user.address, receiptHash, "0xdeadbeef");
  });

  it("user can withdraw their balance and clears intent", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    const value = ethers.parseEther("0.01");
    await vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value });

    await expect(vault.connect(user).withdraw()).to.changeEtherBalance(user, value);
    expect(await vault.balances(user.address)).to.equal(0n);
    const intent = await vault.intents(user.address);
    expect(intent.active).to.equal(false);
  });

  it("withdraw reverts when nothing to withdraw", async () => {
    const { vault, user } = await deploy();
    await expect(vault.connect(user).withdraw()).to.be.revertedWith("Nothing to withdraw");
  });
});
```

**Step 2.3: Run tests — expect failure (no contract yet)**

```bash
cd /home/shreyas/code/work/private-defi/contracts
npx hardhat test
```

Expected: compile error / "no contract named StrategyVault". This is the red state.

**Step 2.4: Commit (red tests)**

```bash
cd /home/shreyas/code/work/private-defi
git add contracts/test/StrategyVault.test.ts
git rm -f contracts/contracts/Lock.sol contracts/test/Lock.ts contracts/ignition/modules/Lock.ts 2>/dev/null || true
git commit -m "test(contracts): failing tests for StrategyVault"
```

---

## Task 3 — StrategyVault Minimal Implementation

**Files:**
- Create: `contracts/contracts/StrategyVault.sol`

**Step 3.1: Write contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StrategyVault {
    struct Intent {
        bytes encryptedGoal;
        uint256 maxSlippage;
        uint256 stopLoss;
        uint256 depositAmount;
        bool active;
    }

    mapping(address => Intent) public intents;
    mapping(address => uint256) public balances;
    address public immutable teeAgentAddress;

    event IntentSet(address indexed user, uint256 amount);
    event TradeExecuted(address indexed user, bytes32 receiptHash, bytes teeAttestation);

    constructor(address _teeAgentAddress) {
        teeAgentAddress = _teeAgentAddress;
    }

    function depositAndSetIntent(
        bytes calldata _encryptedGoal,
        uint256 _maxSlippage,
        uint256 _stopLoss
    ) external payable {
        require(msg.value > 0, "Must deposit funds");
        balances[msg.sender] += msg.value;
        intents[msg.sender] = Intent({
            encryptedGoal: _encryptedGoal,
            maxSlippage: _maxSlippage,
            stopLoss: _stopLoss,
            depositAmount: msg.value,
            active: true
        });
        emit IntentSet(msg.sender, msg.value);
    }

    function executeTradeWithProof(
        address user,
        bytes calldata,
        bytes calldata teeAttestation,
        bytes32 storageReceiptHash
    ) external {
        require(msg.sender == teeAgentAddress, "Unauthorized");
        require(intents[user].active, "No active intent");
        emit TradeExecuted(user, storageReceiptHash, teeAttestation);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        balances[msg.sender] = 0;
        intents[msg.sender].active = false;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
    }
}
```

> Note: For testnet MVP, `executeTradeWithProof` accepts but does not verify the attestation bytes on-chain — verification is in the agent service. The hackathon scope (per refined doc §8) treats attestation as event metadata, not on-chain check. Document this clearly in the README as a known scope cut.

**Step 3.2: Run tests — expect green**

```bash
cd /home/shreyas/code/work/private-defi/contracts
npx hardhat test
```

Expected: all 7 tests pass.

**Step 3.3: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add contracts/contracts/StrategyVault.sol
git commit -m "feat(contracts): implement StrategyVault"
```

---

## Task 4 — Deploy to 0G Galileo

**Files:**
- Create: `contracts/scripts/deploy.ts`
- Create: `contracts/.env` (user fills in PRIVATE_KEY + AGENT_ADDRESS — never commit)

**Step 4.1: Fund a deployer wallet**

User action (manual): visit `https://faucet.0g.ai`, claim 0.1 OG. Repeat next day if more needed (daily 0.1 OG cap).

**Step 4.2: Write deploy script**

```ts
// contracts/scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const agentAddress = process.env.AGENT_ADDRESS;
  if (!agentAddress) throw new Error("AGENT_ADDRESS env required");

  const Vault = await ethers.getContractFactory("StrategyVault");
  const vault = await Vault.deploy(agentAddress);
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log("StrategyVault deployed to:", addr);
  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${addr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Step 4.3: Generate the agent wallet that will sign executeTradeWithProof**

```bash
cd /home/shreyas/code/work/private-defi/contracts
node -e "const w = require('ethers').Wallet.createRandom(); console.log(JSON.stringify({address: w.address, privateKey: w.privateKey}))"
```

Save the address as `AGENT_ADDRESS` in `contracts/.env` and the privateKey as `AGENT_PRIVATE_KEY` (will be reused by the agent service in Task 5). Also fund this agent address from the faucet (it'll pay gas to call executeTradeWithProof).

**Step 4.4: Deploy**

```bash
cd /home/shreyas/code/work/private-defi/contracts
npx hardhat run scripts/deploy.ts --network galileo
```

Expected: a console line `StrategyVault deployed to: 0x...`. Visit the printed explorer URL and confirm the contract is shown.

**Step 4.5: Record the deployed address**

Append to `contracts/.env` and root `.env.example` placeholder (do **not** commit `.env`).

**Step 4.6: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add contracts/scripts/deploy.ts contracts/.env.example
git commit -m "feat(contracts): add galileo deploy script"
```

---

## Task 5 — Agent Folder Bootstrap

**Files:**
- Create: `agent/` directory
- Create: `agent/tsconfig.json` (via `npx tsc --init`)
- Create: `agent/vitest.config.ts`
- Create: `agent/src/env.ts`
- Create: `agent/src/index.ts`
- Create: `agent/.env.example`

**Step 5.1: Init project**

```bash
cd /home/shreyas/code/work/private-defi
mkdir agent && cd agent
npm init -y
npm pkg set name=orcus-agent type=module private=true
npm pkg set scripts.dev="tsx watch src/index.ts" scripts.start="tsx src/index.ts" scripts.test="vitest run" scripts.typecheck="tsc --noEmit"
```

**Step 5.2: Install deps via commands only (no hand edits)**

```bash
npm install ethers@6 dotenv eciesjs @0glabs/0g-serving-broker @0glabs/0g-ts-sdk
npm install -D typescript tsx vitest @types/node
```

**Step 5.3: Generate tsconfig**

```bash
npx tsc --init --rootDir src --outDir dist --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --resolveJsonModule --strict --skipLibCheck
```

**Step 5.4: Write `agent/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

**Step 5.5: Write `agent/src/env.ts`** (centralized env loader, fail-fast)

```ts
import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  rpc: required("GALILEO_RPC"),
  chainId: 16602,
  agentPk: required("AGENT_PRIVATE_KEY"),
  agentEciesSk: required("AGENT_ECIES_PRIVATE_KEY"),
  vault: required("VAULT_ADDRESS"),
  storageIndexer: required("STORAGE_INDEXER"),
};
```

**Step 5.6: Write placeholder `agent/src/index.ts`**

```ts
import { env } from "./env.js";
console.log("Orcus agent boot. vault=", env.vault);
```

**Step 5.7: Write `agent/.env.example`**

```
GALILEO_RPC=https://evmrpc-testnet.0g.ai
AGENT_PRIVATE_KEY=0x...
AGENT_ECIES_PRIVATE_KEY=0x...
VAULT_ADDRESS=0x...
STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
```

**Step 5.8: Smoke-test typecheck + boot**

```bash
cd /home/shreyas/code/work/private-defi/agent
npm run typecheck
```

Expected: no errors.

**Step 5.9: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add agent
git commit -m "feat(agent): scaffold typescript service"
```

---

## Task 6 — ECIES Key Utilities (TDD)

**Files:**
- Create: `agent/src/crypto/ecies.ts`
- Create: `agent/src/crypto/ecies.test.ts`

**Step 6.1: Write failing test**

```ts
// agent/src/crypto/ecies.test.ts
import { describe, it, expect } from "vitest";
import { generateKeyPair, encryptIntent, decryptIntent } from "./ecies.js";

describe("ecies", () => {
  it("round-trips an intent payload", () => {
    const { privateKey, publicKey } = generateKeyPair();
    const intent = { goal: "swap 1 OG to USDC", maxSlippage: 50 };
    const cipher = encryptIntent(publicKey, intent);
    expect(cipher).toMatch(/^0x[0-9a-f]+$/i);
    const plain = decryptIntent(privateKey, cipher);
    expect(plain).toEqual(intent);
  });

  it("decrypt with wrong key throws", () => {
    const { publicKey } = generateKeyPair();
    const other = generateKeyPair();
    const cipher = encryptIntent(publicKey, { goal: "x" });
    expect(() => decryptIntent(other.privateKey, cipher)).toThrow();
  });
});
```

**Step 6.2: Run — expect fail**

```bash
cd /home/shreyas/code/work/private-defi/agent
npm test
```

Expected: red ("Cannot find module ./ecies.js").

**Step 6.3: Write implementation**

```ts
// agent/src/crypto/ecies.ts
import { PrivateKey, encrypt, decrypt } from "eciesjs";

export interface KeyPair {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;
}

export function generateKeyPair(): KeyPair {
  const sk = new PrivateKey();
  return {
    privateKey: `0x${sk.secret.toString("hex")}` as `0x${string}`,
    publicKey: `0x${sk.publicKey.toHex()}` as `0x${string}`,
  };
}

export function encryptIntent(publicKey: string, intent: unknown): `0x${string}` {
  const buf = encrypt(publicKey, Buffer.from(JSON.stringify(intent)));
  return `0x${buf.toString("hex")}`;
}

export function decryptIntent<T = unknown>(privateKey: string, cipherHex: string): T {
  const cipher = Buffer.from(cipherHex.replace(/^0x/, ""), "hex");
  const buf = decrypt(privateKey, cipher);
  return JSON.parse(buf.toString("utf8")) as T;
}
```

**Step 6.4: Run — expect green**

```bash
npm test
```

**Step 6.5: One-shot CLI to mint the agent ECIES key (used by deploy ops, not by tests)**

```bash
cd /home/shreyas/code/work/private-defi/agent
npx tsx -e "import {generateKeyPair} from './src/crypto/ecies.ts'; console.log(JSON.stringify(generateKeyPair(),null,2))"
```

Save output:
- `AGENT_ECIES_PRIVATE_KEY` → `agent/.env`
- `AGENT_ECIES_PUBLIC_KEY` → `web/.env.local` later (as `NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY`)

**Step 6.6: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add agent/src/crypto
git commit -m "feat(agent): ecies intent encryption"
```

---

## Task 7 — Sealed TEE Decision Wrapper (TDD)

**Files:**
- Create: `agent/src/tee/sealedDecide.ts`
- Create: `agent/src/tee/sealedDecide.test.ts`

**Step 7.1: Write failing test (with a mocked broker)**

```ts
// agent/src/tee/sealedDecide.test.ts
import { describe, it, expect, vi } from "vitest";
import { sealedDecide } from "./sealedDecide.js";

function mockBroker() {
  return {
    inference: {
      listService: vi.fn().mockResolvedValue([
        { provider: "0xPROV", verifiability: "TeeML" },
      ]),
      getServiceMetadata: vi.fn().mockResolvedValue({
        endpoint: "https://tee.example",
        model: "deepseek",
      }),
      requestHeaders: vi.fn().mockResolvedValue({ "X-Sig": "ok" }),
      processResponse: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("sealedDecide", () => {
  it("returns parsed decision and ALWAYS calls processResponse", async () => {
    const broker = mockBroker();
    global.fetch = vi.fn().mockResolvedValue({
      headers: { get: () => "chat-123" },
      json: async () => ({
        id: "chat-123",
        choices: [
          { message: { content: JSON.stringify({ action: "EXECUTE", reason: "ok", tradeParams: {} }) } },
        ],
        usage: { total_tokens: 10 },
      }),
    }) as unknown as typeof fetch;

    const out = await sealedDecide(broker as any, "0xPROV", "ciphertext", "market");
    expect(out.action).toBe("EXECUTE");
    expect(broker.inference.processResponse).toHaveBeenCalledWith("0xPROV", "chat-123", { total_tokens: 10 });
  });

  it("calls processResponse even when JSON parse fails", async () => {
    const broker = mockBroker();
    global.fetch = vi.fn().mockResolvedValue({
      headers: { get: () => "chat-456" },
      json: async () => ({
        id: "chat-456",
        choices: [{ message: { content: "not json" } }],
        usage: { total_tokens: 5 },
      }),
    }) as unknown as typeof fetch;

    await expect(sealedDecide(broker as any, "0xPROV", "c", "m")).rejects.toThrow();
    expect(broker.inference.processResponse).toHaveBeenCalledWith("0xPROV", "chat-456", { total_tokens: 5 });
  });
});
```

**Step 7.2: Run — expect fail**

```bash
npm test
```

**Step 7.3: Implementation**

```ts
// agent/src/tee/sealedDecide.ts
export type Decision =
  | { action: "WAIT"; reason: string }
  | { action: "EXECUTE"; reason: string; tradeParams: Record<string, unknown> };

interface Broker {
  inference: {
    listService(): Promise<Array<{ provider: string; verifiability: string }>>;
    getServiceMetadata(provider: string): Promise<{ endpoint: string; model: string }>;
    requestHeaders(provider: string, content: string): Promise<Record<string, string>>;
    processResponse(provider: string, chatId: string, usage: unknown): Promise<void>;
  };
}

export async function sealedDecide(
  broker: Broker,
  provider: string,
  encryptedIntent: string,
  marketSnapshot: string,
): Promise<Decision> {
  const services = await broker.inference.listService();
  const svc = services.find((s) => s.provider === provider && s.verifiability === "TeeML");
  if (!svc) throw new Error("TEE provider not available");

  const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
  const userContent =
    `Encrypted intent: ${encryptedIntent}\n` +
    `Current market: ${marketSnapshot}\n` +
    `Respond ONLY with JSON: {"action":"EXECUTE"|"WAIT","reason":"...","tradeParams":{...}}`;
  const headers = await broker.inference.requestHeaders(provider, userContent);

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a sealed trading agent. Return ONLY valid JSON." },
        { role: "user", content: userContent },
      ],
    }),
  });

  const chatId = res.headers.get("ZG-Res-Key") ?? "";
  const body = (await res.json()) as {
    id: string;
    choices: Array<{ message: { content: string } }>;
    usage: unknown;
  };
  const resolvedChatId = chatId || body.id;

  try {
    const content = body.choices[0]?.message?.content ?? "";
    return JSON.parse(content) as Decision;
  } finally {
    await broker.inference.processResponse(provider, resolvedChatId, body.usage);
  }
}
```

**Step 7.4: Run — expect green**

```bash
npm test
```

**Step 7.5: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add agent/src/tee
git commit -m "feat(agent): sealed tee decision wrapper"
```

---

## Task 8 — 0G Storage Audit Receipt Writer (TDD)

**Files:**
- Create: `agent/src/storage/writeReceipt.ts`
- Create: `agent/src/storage/writeReceipt.test.ts`

**Step 8.1: Write failing test**

```ts
// agent/src/storage/writeReceipt.test.ts
import { describe, it, expect, vi } from "vitest";
import { writeReceipt } from "./writeReceipt.js";

describe("writeReceipt", () => {
  it("uploads, returns root hash, and ALWAYS closes the file", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const merkleTree = vi.fn().mockResolvedValue([{ rootHash: () => "0xROOT" }]);

    const ZgFileMock = { fromBuffer: vi.fn().mockResolvedValue({ merkleTree, close }) };
    const indexer = { upload: vi.fn().mockResolvedValue(undefined) };

    const root = await writeReceipt(
      indexer as any,
      ZgFileMock as any,
      "wallet" as any,
      { test: 1 },
      "rpc"
    );
    expect(root).toBe("0xROOT");
    expect(indexer.upload).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the file even when upload throws", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const merkleTree = vi.fn().mockResolvedValue([{ rootHash: () => "0xROOT" }]);
    const ZgFileMock = { fromBuffer: vi.fn().mockResolvedValue({ merkleTree, close }) };
    const indexer = { upload: vi.fn().mockRejectedValue(new Error("boom")) };

    await expect(
      writeReceipt(indexer as any, ZgFileMock as any, "wallet" as any, {}, "rpc")
    ).rejects.toThrow("boom");
    expect(close).toHaveBeenCalledTimes(1);
  });
});
```

**Step 8.2: Run — expect fail**

```bash
npm test
```

**Step 8.3: Implementation**

```ts
// agent/src/storage/writeReceipt.ts
import type { Wallet } from "ethers";

interface ZgFileLike {
  merkleTree(): Promise<[{ rootHash(): string }]>;
  close(): Promise<void>;
}
interface ZgFileCtor {
  fromBuffer(buf: Buffer, name: string): Promise<ZgFileLike>;
}
interface IndexerLike {
  upload(file: ZgFileLike, rpc: string, wallet: Wallet): Promise<unknown>;
}

export async function writeReceipt(
  indexer: IndexerLike,
  ZgFile: ZgFileCtor,
  wallet: Wallet,
  receipt: unknown,
  rpc: string,
): Promise<string> {
  const file = await ZgFile.fromBuffer(Buffer.from(JSON.stringify(receipt)), "receipt.json");
  try {
    const [tree] = await file.merkleTree();
    await indexer.upload(file, rpc, wallet);
    return tree.rootHash();
  } finally {
    await file.close();
  }
}
```

**Step 8.4: Run — expect green**

```bash
npm test
```

**Step 8.5: Commit**

```bash
git add agent/src/storage
git commit -m "feat(agent): 0g storage receipt writer"
```

---

## Task 9 — Jaine Swap TX Builder

> **Pre-task:** Visit `https://jaine.exchange` (or 0G ecosystem docs) and record the **current Galileo testnet swap router address** and ABI. Save the router address as `JAINE_ROUTER` in `agent/.env`. If Jaine has no working testnet deployment at build time, document and fall back: emit a `TradeExecuted` with a no-op `tradeData` (still satisfies "1 trade with TEE proof" submission requirement using a dummy ERC20).

**Files:**
- Create: `agent/src/dex/jaine.ts`
- Create: `agent/src/dex/jaine.abi.json` (paste router ABI from explorer)

**Step 9.1: Add the router ABI**

After fetching the verified ABI from `chainscan-galileo.0g.ai` for the JAINE router, paste into `agent/src/dex/jaine.abi.json`.

**Step 9.2: Implement builder**

```ts
// agent/src/dex/jaine.ts
import { Contract, Interface, JsonRpcProvider, Wallet } from "ethers";
import abi from "./jaine.abi.json" with { type: "json" };

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: string;
  deadline: number;
  fee: number;
}

export function buildSwapCalldata(params: SwapParams): string {
  const iface = new Interface(abi as any);
  // NOTE: replace fragment name with the actual function the verified ABI exposes
  // (commonly `exactInputSingle` on CLMM routers, similar to Uniswap v3).
  return iface.encodeFunctionData("exactInputSingle", [
    {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: params.fee,
      recipient: params.recipient,
      deadline: BigInt(params.deadline),
      amountIn: params.amountIn,
      amountOutMinimum: params.minAmountOut,
      sqrtPriceLimitX96: 0n,
    },
  ]);
}

export async function executeSwap(
  rpc: string,
  signer: Wallet,
  router: string,
  params: SwapParams,
): Promise<string> {
  const provider = new JsonRpcProvider(rpc);
  const wallet = signer.connect(provider);
  const data = buildSwapCalldata(params);
  const tx = await wallet.sendTransaction({ to: router, data, value: 0n });
  const receipt = await tx.wait();
  return receipt!.hash;
}
```

**Step 9.3: Type-check**

```bash
cd /home/shreyas/code/work/private-defi/agent
npm run typecheck
```

(Unit-testing live swaps is out of scope; this gets exercised in Task 15 E2E.)

**Step 9.4: Commit**

```bash
git add agent/src/dex
git commit -m "feat(agent): jaine swap calldata builder"
```

---

## Task 10 — Agent Event Loop

**Files:**
- Modify: `agent/src/index.ts`
- Create: `agent/src/abi/strategyVault.json` (copy from `contracts/artifacts/contracts/StrategyVault.sol/StrategyVault.json` → only the `abi` field)
- Create: `agent/src/market.ts` (stub market snapshot fetcher)

**Step 10.1: Export ABI from contracts build**

```bash
cd /home/shreyas/code/work/private-defi/contracts
npx hardhat compile
mkdir -p ../agent/src/abi
node -e "console.log(JSON.stringify(require('./artifacts/contracts/StrategyVault.sol/StrategyVault.json').abi))" > ../agent/src/abi/strategyVault.json
```

**Step 10.2: Stub market snapshot**

```ts
// agent/src/market.ts
export async function getMarketSnapshot(): Promise<string> {
  return JSON.stringify({
    ts: Date.now(),
    note: "stub market feed; replace with 0G DA subscription post-MVP",
  });
}
```

**Step 10.3: Wire `agent/src/index.ts`**

```ts
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
import vaultAbi from "./abi/strategyVault.json" with { type: "json" };
import { env } from "./env.js";
import { decryptIntent } from "./crypto/ecies.js";
import { sealedDecide } from "./tee/sealedDecide.js";
import { writeReceipt } from "./storage/writeReceipt.js";
import { getMarketSnapshot } from "./market.js";

const TEE_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";

async function main() {
  const provider = new JsonRpcProvider(env.rpc);
  const wallet = new Wallet(env.agentPk, provider);
  const vault = new Contract(env.vault, vaultAbi as any, wallet);
  const broker = await createZGComputeNetworkBroker(wallet);
  const indexer = new Indexer(env.storageIndexer);

  console.log("orcus agent listening on vault", env.vault);

  vault.on("IntentSet", async (user: string, amount: bigint, ev: any) => {
    try {
      console.log("intent from", user, "amount", amount.toString());
      const intent = await vault.intents(user);
      const plain = decryptIntent<{ goal: string; maxSlippage: number }>(
        env.agentEciesSk,
        intent.encryptedGoal,
      );
      const market = await getMarketSnapshot();
      const decision = await sealedDecide(broker as any, TEE_PROVIDER, JSON.stringify(plain), market);
      if (decision.action !== "EXECUTE") {
        console.log("WAIT:", decision.reason);
        return;
      }

      const receiptHash = await writeReceipt(
        indexer as any,
        ZgFile as any,
        wallet,
        { user, decision, ts: Date.now() },
        env.rpc,
      );

      const tx = await vault.executeTradeWithProof(
        user,
        "0x",
        "0x", // attestation bytes — populate from TEE response in a follow-up
        receiptHash,
      );
      const r = await tx.wait();
      console.log("executed", r?.hash);
    } catch (e) {
      console.error("loop error", e);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Step 10.4: Boot test**

```bash
cd /home/shreyas/code/work/private-defi/agent
npm start
```

Expected: `orcus agent listening on vault 0x...` and process stays alive. Kill with Ctrl-C.

**Step 10.5: Commit**

```bash
git add agent/src
git commit -m "feat(agent): event loop wiring"
```

---

## Task 11 — Web Folder Bootstrap (Next.js)

**Files:**
- Create: `web/` (via `npx create-next-app@latest`)

**Step 11.1: Scaffold Next.js**

```bash
cd /home/shreyas/code/work/private-defi
npx create-next-app@latest web \
  --ts --app --tailwind --eslint --src-dir --use-npm --no-import-alias
```

When prompted for Turbopack: choose default (Yes). Do not accept any prompt that disables App Router or TS.

**Step 11.2: Set package name**

```bash
cd /home/shreyas/code/work/private-defi/web
npm pkg set name=orcus-web private=true
```

**Step 11.3: Install web3 deps via commands only**

```bash
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query eciesjs
```

**Step 11.4: Smoke run**

```bash
cd /home/shreyas/code/work/private-defi/web
npm run dev
```

Expected: dev server boots at `http://localhost:3000`, default Next.js page renders. Kill the server.

**Step 11.5: Commit**

```bash
cd /home/shreyas/code/work/private-defi
git add web
git commit -m "feat(web): scaffold next.js 15 app"
```

---

## Task 12 — Web Chain + Wallet Config

**Files:**
- Create: `web/src/lib/chain.ts`
- Create: `web/src/lib/wagmi.ts`
- Create: `web/src/app/providers.tsx`
- Modify: `web/src/app/layout.tsx`
- Create: `web/.env.local.example`

**Step 12.1: Define 0G Galileo chain**

```ts
// web/src/lib/chain.ts
import { defineChain } from "viem";

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "ChainScan", url: "https://chainscan-galileo.0g.ai" } },
  testnet: true,
});
```

**Step 12.2: wagmi config**

```ts
// web/src/lib/wagmi.ts
"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { galileo } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Orcus",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "orcus-dev",
  chains: [galileo],
  ssr: true,
});
```

**Step 12.3: Providers**

```tsx
// web/src/app/providers.tsx
"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Step 12.4: Wrap root layout**

Edit `web/src/app/layout.tsx` to wrap `{children}` with `<Providers>`. Add a `ConnectButton` import to the homepage in a later step.

**Step 12.5: Env template**

```
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY=0x...
NEXT_PUBLIC_WC_PROJECT_ID=...
```

**Step 12.6: Visual check**

```bash
cd /home/shreyas/code/work/private-defi/web
npm run dev
```

Visit `http://localhost:3000`. Add a `ConnectButton` to `app/page.tsx` and confirm RainbowKit modal opens. Kill server.

**Step 12.7: Commit**

```bash
git add web/src web/.env.local.example
git commit -m "feat(web): wagmi + rainbowkit + galileo chain"
```

---

## Task 13 — Web: Set Strategy Page

**Files:**
- Create: `web/src/lib/encrypt.ts`
- Create: `web/src/lib/vaultAbi.ts` (paste ABI)
- Create: `web/src/app/strategy/page.tsx`
- Modify: `web/src/app/page.tsx` (add nav link)

**Step 13.1: Browser-side encrypt helper**

```ts
// web/src/lib/encrypt.ts
import { encrypt } from "eciesjs";

export function encryptIntentBrowser(pubKeyHex: string, intent: unknown): `0x${string}` {
  const buf = encrypt(pubKeyHex, Buffer.from(JSON.stringify(intent)));
  return `0x${buf.toString("hex")}`;
}
```

**Step 13.2: Strategy page**

```tsx
// web/src/app/strategy/page.tsx
"use client";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther, toHex } from "viem";
import { encryptIntentBrowser } from "@/lib/encrypt";
import { vaultAbi } from "@/lib/vaultAbi";

const VAULT = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`;
const AGENT_PUB = process.env.NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY as string;

export default function StrategyPage() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [goal, setGoal] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [maxSlippage, setMaxSlippage] = useState(50);
  const [stopLoss, setStopLoss] = useState(500);
  const [hash, setHash] = useState<string | null>(null);

  async function submit() {
    if (!address) return;
    const ciphertext = encryptIntentBrowser(AGENT_PUB, { goal, ts: Date.now() });
    const tx = await writeContractAsync({
      abi: vaultAbi,
      address: VAULT,
      functionName: "depositAndSetIntent",
      args: [ciphertext, BigInt(maxSlippage), BigInt(stopLoss)],
      value: parseEther(amount),
    });
    setHash(tx);
  }

  return (
    <main className="mx-auto max-w-xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Set Strategy</h1>
      <textarea className="w-full border p-2" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. swap 0.01 OG to USDC when price dips 1%" />
      <input className="w-full border p-2" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount (OG)" />
      <input className="w-full border p-2" type="number" value={maxSlippage} onChange={(e) => setMaxSlippage(Number(e.target.value))} placeholder="maxSlippage (bps)" />
      <input className="w-full border p-2" type="number" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} placeholder="stopLoss (bps)" />
      <button disabled={isPending || !address} onClick={submit} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {isPending ? "Submitting…" : "Encrypt & Deposit"}
      </button>
      {hash && (
        <p>
          tx: <a className="underline" href={`https://chainscan-galileo.0g.ai/tx/${hash}`} target="_blank">{hash}</a>
        </p>
      )}
    </main>
  );
}
```

**Step 13.3: Add `vaultAbi.ts`** (copy from `agent/src/abi/strategyVault.json` and `export const vaultAbi = [...] as const;`)

**Step 13.4: Run dev server, manually test**

```bash
cd /home/shreyas/code/work/private-defi/web
npm run dev
```

Open `/strategy`, connect wallet, submit a tiny intent. Confirm tx hash on `chainscan-galileo.0g.ai`. Confirm `IntentSet` event in logs.

**Step 13.5: Commit**

```bash
git add web/src
git commit -m "feat(web): set strategy page with ecies encrypt + deposit"
```

---

## Task 14 — Web: Dashboard + History + Proof Viewer

**Files:**
- Create: `web/src/app/dashboard/page.tsx`
- Create: `web/src/app/history/page.tsx`
- Create: `web/src/app/proof/[hash]/page.tsx`

**Step 14.1: Dashboard** — display: connected address, current balance in vault (`balances(address)`), current intent (`intents(address).active`), withdraw button (`writeContract`).

**Step 14.2: History** — use viem's `getContractEvents` (chunk fromBlock if needed) to fetch `TradeExecuted(user)` events filtered by connected address. Render a table with: timestamp, receiptHash, link to `https://storagescan-galileo.0g.ai/file/<rootHash>`, link to tx on chainscan.

**Step 14.3: Proof viewer** — page accepts the storage root hash in the URL and embeds an iframe / link to `storagescan-galileo.0g.ai` plus a "verify attestation bytes" placeholder block (display the raw bytes from event; full attestation verification UI is post-MVP).

**Step 14.4: Manual verification** — Run dev server, walk through the three pages. Confirm withdraw refunds the test deposit.

**Step 14.5: Commit**

```bash
git add web/src
git commit -m "feat(web): dashboard, history, proof viewer"
```

---

## Task 15 — End-to-End Rehearsal

**Step 15.1: Start agent**

```bash
cd /home/shreyas/code/work/private-defi/agent
npm start
```

**Step 15.2: Use the dashboard**

In one browser tab, set a strategy goal that the agent will EXECUTE (e.g., `goal: "always execute"`, since the testnet stub market always returns a snapshot — for the rehearsal, you can short-circuit `sealedDecide` to a deterministic EXECUTE if the TEE provider is flaky; document this as a demo-mode flag).

**Step 15.3: Watch logs**

- Agent must log `intent from <user>`, then `executed 0x<hash>`.
- ChainScan must show the `TradeExecuted` event.
- StorageScan must show the receipt root hash you wrote.

**Step 15.4: Record screen capture** for the demo video (3 min max). Cover:
1. Connect wallet
2. Set intent + deposit
3. Agent log showing TEE call + storage write
4. ChainScan TradeExecuted event
5. StorageScan receipt entry

**Step 15.5: Commit any fixes**

```bash
git commit -am "fix: e2e rehearsal patches"
```

---

## Task 16 — README + Submission Artefacts

**Files:**
- Modify: `/home/shreyas/code/work/private-defi/README.md`

**Step 16.1: README contents**

- Project name (Orcus, codename — final name TBD)
- One-sentence description (≤30 words)
- Architecture diagram (ASCII version from refined doc, trimmed)
- Which 0G modules are used: Compute (sealed TEE), Storage (receipts), Chain (vault). DA noted as stubbed for testnet MVP.
- Galileo deployment addresses (vault, agent EOA)
- Demo video URL (Loom or YouTube unlisted)
- Local run: `cd contracts && npm install && npx hardhat run scripts/deploy.ts --network galileo` → fill envs → `cd ../agent && npm install && npm start` → `cd ../web && npm install && npm run dev`
- Known scope cuts (on-chain attestation verification, real 0G DA market feed)

**Step 16.2: Verify required submission items**

- [ ] Public GitHub repo with meaningful commit history (this plan produces it)
- [ ] Galileo Strategy Vault address on `chainscan-galileo.0g.ai`
- [ ] At least one `TradeExecuted` event visible
- [ ] At least one 0G Storage write visible on `storagescan-galileo.0g.ai`
- [ ] Demo video ≤ 3 min
- [ ] X/Twitter post drafted (do not post until user approves)

**Step 16.3: Commit**

```bash
git add README.md
git commit -m "docs: submission readme"
```

---

## Reference — Skills To Use During Execution

- `@superpowers:executing-plans` for the task-by-task execution loop
- `@superpowers:test-driven-development` for Tasks 2, 6, 7, 8 (red → green → commit)
- `@superpowers:verification-before-completion` before marking the plan "done"
- `@0g-compute` whenever touching the broker SDK (rules 3 and 4 above)
- `@0g-storage` whenever touching `ZgFile`/`Indexer` (rule 5 above)
- `@0g-chain` whenever touching contracts / deploy (rules 1, 2, 6 above)
- `@frontend-design` and `@frontend-ux` if/when polishing the dashboard beyond the wired-up state
- `@security` before mainnet (out of scope here, but flag in README)

---

## Plan Hygiene

- DRY: shared chain constants live in `web/src/lib/chain.ts` + `agent/src/env.ts`; do not duplicate RPC URLs in components.
- YAGNI: no on-chain attestation verifier, no DA subscription, no agent NFT marketplace, no multi-step strategies in v1 — testnet ships the spine first.
- TDD: red commit before green commit on Tasks 2/6/7/8.
- Frequent commits: every task ends with one focused commit; no batching across tasks.
