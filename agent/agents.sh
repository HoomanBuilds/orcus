#!/usr/bin/env bash
# Start ALL Orcus chain agents with one command. Run from the agent/ folder.
# Web runs separately:  cd ../web && npm run dev
# Agents: galileo + arbitrum/base/fuji/mantle sepolia (EVM) + Sui.
# Ctrl+C stops all of them. Logs are prefixed per [label].
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

trap 'echo; echo "[orcus] stopping all agents..."; kill 0' EXIT INT TERM

start() { # label cmd...
  local label="$1"; shift
  "$@" 2>&1 | sed -u "s/^/[$label] /" &
}

start gal  env CHAIN=galileo          npm run start
start arb  env CHAIN=arbitrum-sepolia npm run start
start base env CHAIN=base-sepolia     npm run start
start fuji env CHAIN=avalanche-fuji   npm run start
start mnt  env CHAIN=mantle-sepolia   npm run start
start sui  npm run start:sui

echo "[orcus] 5 EVM agents + Sui started. Ctrl+C to stop."
wait
