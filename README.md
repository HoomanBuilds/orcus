# Orcus

Codename **Orcus** (may be renamed later). A hackathon build of an
MEV-resistant dark pool trading agent running on the
**0G Galileo testnet** (Chain ID `16602`).

## Status

Testnet-only WIP. No mainnet code lives in this repo yet.

## Folder layout

This repo is a plain multi-folder layout. There is no root `package.json`
and no workspace tooling. Each folder below is an independent npm project
and must be installed on its own.

- `contracts/` — Solidity Strategy Vault (Hardhat, `evmVersion: cancun`).
- `agent/` — TypeScript sealed-TEE trading agent.
- `web/` — Next.js 15 dashboard.

## Install

Install each project separately:

```
cd contracts && npm install
cd agent && npm install
cd web && npm install
```

## Tooling

- **npm only.** No pnpm, no yarn, no workspaces.
- Node version pinned via `.nvmrc` (Node 20).
- Copy `.env.example` to `.env` and fill in the values before running
  anything that touches the chain.

## Plan

See the implementation plan at
[`docs/plans/2026-05-13-orcus-testnet.md`](docs/plans/2026-05-13-orcus-testnet.md).
