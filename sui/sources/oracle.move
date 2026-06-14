/// Push price oracle for the Orcus dark pool on Sui. The vault calls `update_price`
/// atomically inside `execute_trade` (package-visibility), so the slippage floor always
/// uses a fresh price. `price_scaled` is USD price * 1e6. On a real deployment this is
/// replaced by a Pyth-on-Sui adapter behind the same `expected_out` shape.
module orcus::oracle;

use sui::clock::Clock;

const E_NO_PRICE: u64 = 0;
const E_STALE: u64 = 1;
const E_ZERO_PRICE: u64 = 2;

/// price_scaled = USD price * SCALE; expected_out = amount_in * price_scaled / SCALE.
const SCALE: u128 = 1_000_000;

public struct PriceOracle has key {
    id: UID,
    price_scaled: u128,
    updated_at_ms: u64,
    max_age_ms: u64, // 0 disables the staleness check (demo); set > 0 in production
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(PriceOracle {
        id: object::new(ctx),
        price_scaled: 0,
        updated_at_ms: 0,
        max_age_ms: 0,
    });
}

/// Refresh the price. Package-visible: only the orcus vault may call it (atomic update).
public(package) fun update_price(o: &mut PriceOracle, price_scaled: u128, clock: &Clock) {
    assert!(price_scaled > 0, E_ZERO_PRICE);
    o.price_scaled = price_scaled;
    o.updated_at_ms = clock.timestamp_ms();
}

/// Expected output (tokenOut units) for `amount_in` tokenIn at the current price.
public fun expected_out(o: &PriceOracle, amount_in: u64, clock: &Clock): u64 {
    assert!(o.price_scaled > 0, E_NO_PRICE);
    if (o.max_age_ms != 0) {
        assert!(clock.timestamp_ms() - o.updated_at_ms <= o.max_age_ms, E_STALE);
    };
    ((((amount_in as u128) * o.price_scaled) / SCALE) as u64)
}

public fun price_scaled(o: &PriceOracle): u128 { o.price_scaled }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun update_for_testing(o: &mut PriceOracle, price_scaled: u128, clock: &Clock) {
    update_price(o, price_scaled, clock);
}
