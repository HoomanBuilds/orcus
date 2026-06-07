/// MEV-resistant dark-pool vault on Sui. Mirrors the EVM StrategyVault, Move-native:
///  - the agent (holder of `AgentCap`) calls `execute_trade`; it never names a recipient,
///    amount, or DEX — the vault builds the swap and sends output to the user.
///  - a fresh price is applied atomically (oracle::update_price) before the floor is read.
///  - a registered ed25519 `attestor` key signs the exec params (the TEE proof, verified
///    on-chain) — the Move equivalent of the EVM EIP-712 attestation.
///  - per-user nonce (replay), per-user cancel cooldown (escape hatch), oracle-grounded
///    output floor (anti-MEV / anti-rug).
module orcus::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::clock::Clock;
use sui::ed25519;
use sui::event;
use std::bcs;
use orcus::oracle::{Self, PriceOracle};
use orcus::orcus_usdc::ORCUS_USDC;
use orcus::dex::{Self, Pool};

const E_EMPTY_GOAL: u64 = 0;
const E_SLIPPAGE_TOO_HIGH: u64 = 1;
const E_ACTIVE_INTENT: u64 = 2;
const E_ZERO_DEPOSIT: u64 = 3;
const E_EXPIRED: u64 = 4;
const E_CANCELLING: u64 = 5;
const E_BAD_NONCE: u64 = 6;
const E_BAD_ATTESTATION: u64 = 7;
const E_NO_INTENT: u64 = 8;
const E_SLIPPAGE: u64 = 9;
const E_ALREADY_CANCELLING: u64 = 10;
const E_NO_ATTESTOR: u64 = 11;

const MAX_BPS: u64 = 10000;
const CANCEL_COOLDOWN_MS: u64 = 3_600_000; // 1 hour

public struct Intent has store {
    encrypted_goal: vector<u8>,
    deposit: Balance<SUI>,
    max_slippage_bps: u64,
}

public struct Vault has key {
    id: UID,
    intents: Table<address, Intent>,
    nonces: Table<address, u64>,
    cancel_at: Table<address, u64>,
    attestor: vector<u8>, // ed25519 public key (32 bytes); set by owner
}

/// Owner authority (rotate the attestor). Move analogue of Ownable.
public struct OwnerCap has key, store { id: UID }
/// Agent authority (call execute_trade). Move analogue of `onlyAgent`.
public struct AgentCap has key, store { id: UID }

public struct IntentSet has copy, drop { user: address, amount_in: u64 }
public struct TradeExecuted has copy, drop { user: address, amount_out: u64, receipt_hash: vector<u8> }
public struct Withdrawn has copy, drop { user: address, amount: u64 }
public struct CancelRequested has copy, drop { user: address, at_ms: u64 }

fun init(ctx: &mut TxContext) {
    transfer::share_object(Vault {
        id: object::new(ctx),
        intents: table::new(ctx),
        nonces: table::new(ctx),
        cancel_at: table::new(ctx),
        attestor: vector[],
    });
    transfer::transfer(OwnerCap { id: object::new(ctx) }, ctx.sender());
    transfer::transfer(AgentCap { id: object::new(ctx) }, ctx.sender());
}

/// Owner sets the ed25519 attestor public key (the TEE/attestor signing key).
public fun set_attestor(_: &OwnerCap, v: &mut Vault, attestor: vector<u8>) {
    v.attestor = attestor;
}

/// Deposit SUI + an encrypted intent. One active intent per user.
public fun deposit(
    v: &mut Vault,
    payment: Coin<SUI>,
    encrypted_goal: vector<u8>,
    max_slippage_bps: u64,
    ctx: &mut TxContext,
) {
    let user = ctx.sender();
    assert!(encrypted_goal.length() > 0, E_EMPTY_GOAL);
    assert!(max_slippage_bps <= MAX_BPS, E_SLIPPAGE_TOO_HIGH);
    assert!(!table::contains(&v.intents, user), E_ACTIVE_INTENT);

    let bal = coin::into_balance(payment);
    let amount = balance::value(&bal);
    assert!(amount > 0, E_ZERO_DEPOSIT);

    if (!table::contains(&v.nonces, user)) {
        table::add(&mut v.nonces, user, 0);
    };
    if (table::contains(&v.cancel_at, user)) {
        table::remove(&mut v.cancel_at, user);
    };
    table::add(&mut v.intents, user, Intent { encrypted_goal, deposit: bal, max_slippage_bps });
    event::emit(IntentSet { user, amount_in: amount });
}

/// Agent executes a user's intent. Builds the swap, enforces an oracle floor, sends
/// output to the user. The agent has zero discretion over recipient/amount/DEX.
public fun execute_trade(
    _: &AgentCap,
    v: &mut Vault,
    pool: &mut Pool,
    oracle: &mut PriceOracle,
    clock: &Clock,
    user: address,
    new_price_scaled: u128,
    agent_min_out: u64,
    deadline_ms: u64,
    receipt_hash: vector<u8>,
    nonce: u64,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(clock.timestamp_ms() <= deadline_ms, E_EXPIRED);

    if (table::contains(&v.cancel_at, user)) {
        let ca = *table::borrow(&v.cancel_at, user);
        assert!(clock.timestamp_ms() < ca + CANCEL_COOLDOWN_MS, E_CANCELLING);
    };

    let expected_nonce = *table::borrow(&v.nonces, user);
    assert!(nonce == expected_nonce, E_BAD_NONCE);

    assert!(v.attestor.length() > 0, E_NO_ATTESTOR);
    let msg = exec_message(user, agent_min_out, deadline_ms, receipt_hash, nonce);
    assert!(ed25519::ed25519_verify(&signature, &v.attestor, &msg), E_BAD_ATTESTATION);

    assert!(table::contains(&v.intents, user), E_NO_INTENT);
    let Intent { encrypted_goal: _, deposit, max_slippage_bps } = table::remove(&mut v.intents, user);

    // effects before interactions
    *table::borrow_mut(&mut v.nonces, user) = nonce + 1;
    if (table::contains(&v.cancel_at, user)) {
        table::remove(&mut v.cancel_at, user);
    };

    // atomic fresh price, then read the floor from it
    oracle::update_price(oracle, new_price_scaled, clock);
    let amount_in = balance::value(&deposit);
    let expected = oracle::expected_out(oracle, amount_in, clock);
    let floor = (((expected as u128) * ((MAX_BPS - max_slippage_bps) as u128)) / (MAX_BPS as u128)) as u64;
    let min_out = if (floor > agent_min_out) { floor } else { agent_min_out };

    let coin_in = coin::from_balance(deposit, ctx);
    let out = dex::swap(pool, coin_in, oracle, clock, min_out, ctx);
    let out_val = coin::value(&out);
    assert!(out_val > 0 && out_val >= min_out, E_SLIPPAGE);
    transfer::public_transfer(out, user);
    event::emit(TradeExecuted { user, amount_out: out_val, receipt_hash });
}

/// User escape hatch: after the cooldown elapses, the agent can no longer execute.
public fun request_cancel(v: &mut Vault, clock: &Clock, ctx: &mut TxContext) {
    let user = ctx.sender();
    assert!(table::contains(&v.intents, user), E_NO_INTENT);
    assert!(!table::contains(&v.cancel_at, user), E_ALREADY_CANCELLING);
    let now = clock.timestamp_ms();
    table::add(&mut v.cancel_at, user, now);
    event::emit(CancelRequested { user, at_ms: now });
}

/// Withdraw the deposit and clear the intent.
#[allow(lint(self_transfer))]
public fun withdraw(v: &mut Vault, ctx: &mut TxContext) {
    let user = ctx.sender();
    assert!(table::contains(&v.intents, user), E_NO_INTENT);
    let Intent { encrypted_goal: _, deposit, max_slippage_bps: _ } = table::remove(&mut v.intents, user);
    if (table::contains(&v.cancel_at, user)) {
        table::remove(&mut v.cancel_at, user);
    };
    let amount = balance::value(&deposit);
    transfer::public_transfer(coin::from_balance(deposit, ctx), user);
    event::emit(Withdrawn { user, amount });
}

/// Canonical message the attestor signs: address(32) || min_out(8 LE) || deadline(8 LE)
/// || receipt_hash(bcs) || nonce(8 LE). The agent reproduces this byte layout off-chain.
fun exec_message(
    user: address,
    agent_min_out: u64,
    deadline_ms: u64,
    receipt_hash: vector<u8>,
    nonce: u64,
): vector<u8> {
    let mut m = bcs::to_bytes(&user);
    m.append(bcs::to_bytes(&agent_min_out));
    m.append(bcs::to_bytes(&deadline_ms));
    m.append(bcs::to_bytes(&receipt_hash));
    m.append(bcs::to_bytes(&nonce));
    m
}

public fun nonce_of(v: &Vault, user: address): u64 {
    if (table::contains(&v.nonces, user)) { *table::borrow(&v.nonces, user) } else { 0 }
}

public fun has_intent(v: &Vault, user: address): bool {
    table::contains(&v.intents, user)
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun exec_message_for_testing(
    user: address,
    agent_min_out: u64,
    deadline_ms: u64,
    receipt_hash: vector<u8>,
    nonce: u64,
): vector<u8> {
    exec_message(user, agent_min_out, deadline_ms, receipt_hash, nonce)
}
