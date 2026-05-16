#!/bin/bash
# Patch @0glabs/0g-ts-sdk to handle pricePerSector() revert on 0G storage network
# The market contract's pricePerSector() reverts on the current storage chain,
# so we catch and default to 0 (free storage)
TARGETS=(
  "node_modules/@0glabs/0g-ts-sdk/lib.esm/transfer/Uploader.js"
  "node_modules/@0glabs/0g-ts-sdk/lib.commonjs/transfer/Uploader.js"
)
for f in "${TARGETS[@]}"; do
  if [ -f "$f" ]; then
    sed -i "s/await marketContract\.pricePerSector()/await marketContract.pricePerSector().catch(() => BigInt('0'))/" "$f"
  fi
done
