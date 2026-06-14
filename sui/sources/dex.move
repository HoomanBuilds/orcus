/// Mock DEX for the Orcus dark pool on Sui. Behaves like the EVM OrcusRouter: takes the
/// input coin and pays the settlement coin (oUSDC) at the oracle price. No real AMM -
/// a stand-in for Cetus/DeepBook, which are used on a real Sui deployment.
module orcus::dex;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::Clock;
use orcus::orcus_usdc::ORCUS_USDC;
use orcus::oracle::{Self, PriceOracle};

const E_SLIPPAGE: u64 = 0;
const E_ZERO_IN: u64 = 1;

public struct Pool has key {
    id: UID,
    usdc: Balance<ORCUS_USDC>,
    sui: Balance<SUI>,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Pool {
        id: object::new(ctx),
        usdc: balance::zero(),
        sui: balance::zero(),
    });
}

/// Seed the pool with oUSDC inventory (mirrors minting 1,000,000 oUSDC to the router).
public fun fund(pool: &mut Pool, usdc: Coin<ORCUS_USDC>) {
    balance::join(&mut pool.usdc, coin::into_balance(usdc));
}

/// Swap SUI in for oUSDC out at the oracle price. Reverts if output < min_out.
public fun swap(
    pool: &mut Pool,
    coin_in: Coin<SUI>,
    oracle: &PriceOracle,
    clock: &Clock,
    min_out: u64,
    ctx: &mut TxContext,
): Coin<ORCUS_USDC> {
    let amount_in = coin::value(&coin_in);
    assert!(amount_in > 0, E_ZERO_IN);
    balance::join(&mut pool.sui, coin::into_balance(coin_in));
    let out = oracle::expected_out(oracle, amount_in, clock);
    assert!(out >= min_out, E_SLIPPAGE);
    coin::take(&mut pool.usdc, out, ctx)
}

public fun usdc_reserve(pool: &Pool): u64 { balance::value(&pool.usdc) }
public fun sui_reserve(pool: &Pool): u64 { balance::value(&pool.sui) }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
