/// Mock settlement coin for the Orcus dark pool on Sui (the oUSDC equivalent).
/// Mirrors the EVM OrcusUSDC: owner mints initial liquidity to fund the mock DEX.
/// On a real Sui deployment this is replaced by canonical USDC.
module orcus::orcus_usdc;

use sui::coin::{Self, TreasuryCap};

/// One-time witness for the currency.
public struct ORCUS_USDC has drop {}

#[allow(deprecated_usage)]
fun init(witness: ORCUS_USDC, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        6,
        b"oUSDC",
        b"Orcus USDC",
        b"Mock settlement token for the Orcus dark pool",
        option::none(),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, ctx.sender());
}

/// Owner mints oUSDC (used to fund the mock DEX pool).
public fun mint(
    treasury: &mut TreasuryCap<ORCUS_USDC>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    transfer::public_transfer(coin::mint(treasury, amount, ctx), recipient);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ORCUS_USDC {}, ctx);
}
