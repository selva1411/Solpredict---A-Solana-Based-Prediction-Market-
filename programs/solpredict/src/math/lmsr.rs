//! # LMSR (Logarithmic Market Scoring Rule) — Reference Implementation
//!
//! **NOTE**: This module contains an experimental/reference LMSR mathematical model.
//! The canonical, production AMM model actively used by instructions (`buy_shares`,
//! `sell_shares`, spot price calculations, etc.) is located in [`crate::utils::amm_math`].
//!
//! Kept for reference, algorithmic comparison, and potential future LMSR pool migration.

use crate::errors::SolPredictError;

/// B parameter (liquidity parameter) in lamports.
/// Controls how deep the liquidity pool is. Higher B = less slippage.
/// 100 SOL = 100_000_000_000 lamports gives reasonable slippage for prediction markets.
pub const DEFAULT_B: u128 = 100_000_000_000; // 100 SOL

/// Precision for fixed-point arithmetic (9 decimals matches lamports).
pub const PRECISION: u128 = 1_000_000_000;

/// Scaled ln(2) = ln(2) * PRECISION.
pub const LN2_SCALED: i128 = 693_147_181;
/// Half of scaled ln(2) for nearest-integer rounding.
pub const HALF_LN2_SCALED: i128 = LN2_SCALED / 2;

/// Compute exp(x) for x scaled by PRECISION.
/// Uses range reduction (x = n * ln(2) + r with |r| <= ln(2)/2) followed by a
/// 12-term Taylor series on r, and exact 2^n scaling via bit shift.
pub fn exp_scaled(x: i128) -> Result<u128, SolPredictError> {
    // Range reduction: decompose x = n * ln2 + r where |r| <= ln2 / 2
    let n = if x >= 0 {
        (x + HALF_LN2_SCALED) / LN2_SCALED
    } else {
        (x - HALF_LN2_SCALED) / LN2_SCALED
    };

    // Overflow / underflow guard
    if n.abs() > 63 {
        return Err(SolPredictError::MathOverflow);
    }

    let r = x - n * LN2_SCALED;

    // 12-term Taylor series for exp(r) where |r| <= 0.347
    let mut exp_r: i128 = PRECISION as i128;
    let mut term: i128 = PRECISION as i128;

    for k in 1..=12 {
        term = term
            .checked_mul(r)
            .ok_or(SolPredictError::MathOverflow)?
            .checked_div(
                (k as i128)
                    .checked_mul(PRECISION as i128)
                    .ok_or(SolPredictError::MathOverflow)?,
            )
            .ok_or(SolPredictError::MathOverflow)?;
        exp_r = exp_r
            .checked_add(term)
            .ok_or(SolPredictError::MathOverflow)?;
    }

    if exp_r <= 0 {
        return Err(SolPredictError::MathOverflow);
    }

    let exp_r_u128 = exp_r as u128;
    let result = if n >= 0 {
        exp_r_u128
            .checked_shl(n as u32)
            .ok_or(SolPredictError::MathOverflow)?
    } else {
        exp_r_u128 >> ((-n) as u32)
    };

    if result == 0 {
        return Err(SolPredictError::MathOverflow);
    }

    Ok(result)
}

/// Compute ln(x) for x > 0 scaled by PRECISION.
/// Uses natural log approximation.
pub fn ln_scaled(x: u128) -> Result<i128, SolPredictError> {
    if x == 0 {
        return Err(SolPredictError::MathOverflow);
    }

    // Convert to f64 for ln computation, then back to fixed-point
    // This is a reasonable trade-off for a Solana program since the
    // Solana runtime supports f64 operations.
    let x_f64 = x as f64 / PRECISION as f64;
    if x_f64 <= 0.0 {
        return Err(SolPredictError::MathOverflow);
    }
    let ln_f64 = x_f64.ln();
    Ok((ln_f64 * PRECISION as f64) as i128)
}

/// Cost function: C(q) = b * ln(exp(q_yes/b) + exp(q_no/b))
/// Returns the total cost in lamports for the given quantities.
pub fn cost_function(b: u128, q_yes: u128, q_no: u128) -> Result<u128, SolPredictError> {
    let exp_yes = exp_scaled((q_yes as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let exp_no = exp_scaled((q_no as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let sum = exp_yes
        .checked_add(exp_no)
        .ok_or(SolPredictError::MathOverflow)?;

    let ln_sum = ln_scaled(sum)?;

    let cost = (ln_sum as u128)
        .checked_mul(b)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(SolPredictError::MathOverflow)?;

    Ok(cost)
}

/// Cost to buy `delta` shares of YES.
/// Returns the additional cost in lamports.
pub fn buy_cost_yes(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    let cost_before = cost_function(b, q_yes, q_no)?;
    let cost_after = cost_function(b, q_yes.checked_add(delta).ok_or(SolPredictError::MathOverflow)?, q_no)?;

    cost_after
        .checked_sub(cost_before)
        .ok_or(SolPredictError::MathOverflow)
}

/// Cost to buy `delta` shares of NO.
pub fn buy_cost_no(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    let cost_before = cost_function(b, q_yes, q_no)?;
    let cost_after = cost_function(b, q_yes, q_no.checked_add(delta).ok_or(SolPredictError::MathOverflow)?)?;

    cost_after
        .checked_sub(cost_before)
        .ok_or(SolPredictError::MathOverflow)
}

/// Return from selling `delta` shares of YES.
/// Returns the refund in lamports.
pub fn sell_return_yes(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    if delta > q_yes {
        return Err(SolPredictError::InsufficientShares);
    }

    let cost_before = cost_function(b, q_yes, q_no)?;
    let new_yes = q_yes.checked_sub(delta).ok_or(SolPredictError::MathOverflow)?;
    let cost_after = cost_function(b, new_yes, q_no)?;

    cost_before
        .checked_sub(cost_after)
        .ok_or(SolPredictError::MathOverflow)
}

/// Return from selling `delta` shares of NO.
pub fn sell_return_no(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    if delta > q_no {
        return Err(SolPredictError::InsufficientShares);
    }

    let cost_before = cost_function(b, q_yes, q_no)?;
    let new_no = q_no.checked_sub(delta).ok_or(SolPredictError::MathOverflow)?;
    let cost_after = cost_function(b, q_yes, new_no)?;

    cost_before
        .checked_sub(cost_after)
        .ok_or(SolPredictError::MathOverflow)
}

/// Current YES probability in basis points (0-10000).
/// p_yes = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b))
pub fn probability_yes_bps(
    b: u128,
    q_yes: u128,
    q_no: u128,
) -> Result<u16, SolPredictError> {
    let exp_yes = exp_scaled((q_yes as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let exp_no = exp_scaled((q_no as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let total = exp_yes
        .checked_add(exp_no)
        .ok_or(SolPredictError::MathOverflow)?;

    if total == 0 {
        return Ok(5000); // 50% default
    }

    let bps = exp_yes
        .checked_mul(10_000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(total)
        .ok_or(SolPredictError::MathOverflow)?;

    let bps_u16 = u16::try_from(bps).unwrap_or(5000);
    Ok(bps_u16.min(9999).max(1))
}

/// Current NO probability in basis points.
pub fn probability_no_bps(
    b: u128,
    q_yes: u128,
    q_no: u128,
) -> Result<u16, SolPredictError> {
    let yes_bps = probability_yes_bps(b, q_yes, q_no)?;
    Ok(10000u16.saturating_sub(yes_bps))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exp_small() {
        let result = exp_scaled(0).unwrap();
        assert_eq!(result, PRECISION); // exp(0) = 1.0
    }

    #[test]
    fn test_exp_positive() {
        let result = exp_scaled(PRECISION as i128).unwrap(); // exp(1.0)
        let expected = (std::f64::consts::E * PRECISION as f64) as u128;
        let diff = if result > expected { result - expected } else { expected - result };
        assert!(diff < PRECISION / 100, "exp(1) too far off: {} vs {}", result, expected);
    }

    #[test]
    fn test_probability_equal() {
        // When q_yes == q_no, probability should be ~50%
        let b = 100_000_000_000u128;
        let q = 50_000_000_000u128;
        let p = probability_yes_bps(b, q, q).unwrap();
        assert!((p as i16 - 5000).abs() < 100, "Expected ~50%, got {}%", p as f64 / 100.0);
    }

    #[test]
    fn test_probability_biased() {
        let b = 100_000_000_000u128;
        // YES has twice the pool of NO
        let p = probability_yes_bps(b, 100_000_000_000u128, 50_000_000_000u128).unwrap();
        assert!(p > 5000, "YES should be > 50% when pool is larger");
    }

    #[test]
    fn test_buy_cost_positive() {
        let b = 100_000_000_000u128;
        let cost = buy_cost_yes(b, 50_000_000_000u128, 50_000_000_000u128, 1_000_000u128).unwrap();
        assert!(cost > 0, "Buying shares should cost SOMETHING");
    }

    #[test]
    fn test_sell_return_less_than_buy() {
        let b = 100_000_000_000u128;
        let q_yes = 50_000_000_000u128;
        let q_no = 50_000_000_000u128;
        let delta = 1_000_000u128;

        let buy = buy_cost_yes(b, q_yes, q_no, delta).unwrap();
        let sell_return = sell_return_yes(b, q_yes + delta, q_no, delta).unwrap();

        // Sell return should be <= buy cost (spread = AMM fee)
        assert!(sell_return <= buy, "Sell return should be <= buy cost: {} vs {}", sell_return, buy);
    }

    #[test]
    fn test_large_quantities_no_overflow() {
        let b = 1_000_000_000_000u128; // 1000 SOL
        let q_yes = 500_000_000_000u128;
        let q_no = 500_000_000_000u128;
        let delta = 100_000_000_000u128; // 100 SOL worth of shares

        let cost = buy_cost_yes(b, q_yes, q_no, delta);
        assert!(cost.is_ok(), "Large quantity should not overflow");
    }

    #[test]
    fn test_symmetric_costs() {
        let b = 100_000_000_000u128;
        let q_yes = 50_000_000_000u128;
        let q_no = 50_000_000_000u128;

        let cost_yes = buy_cost_yes(b, q_yes, q_no, 1_000_000u128).unwrap();
        let cost_no = buy_cost_no(b, q_yes, q_no, 1_000_000u128).unwrap();

        // When pools are equal, buying YES and NO should cost the same
        let diff = if cost_yes > cost_no { cost_yes - cost_no } else { cost_no - cost_yes };
        assert!(diff < 1000, "Symmetric costs differ: {} vs {}", cost_yes, cost_no);
    }

    #[test]
    fn test_ln_scaled_zero_errors() {
        // ln(0) is undefined; must return an error, not garbage.
        assert!(matches!(
            ln_scaled(0),
            Err(SolPredictError::MathOverflow)
        ));
    }

    #[test]
    fn test_ln_scaled_one_is_zero() {
        // ln(1.0) == 0.0
        let result = ln_scaled(PRECISION).unwrap();
        assert!(
            result.abs() < PRECISION as i128 / 1000,
            "ln(1.0) should be ~0, got {}",
            result
        );
    }

    #[test]
    fn test_exp_scaled_large_negative_errors_not_clamps() {
        // |x| >= 209 in PRECISION units makes the Taylor terms overflow the
        // fixed-point accumulator; the implementation rejects rather than
        // silently returning a clamped positive quantity.
        let x = -300 * PRECISION as i128;
        assert!(matches!(
            exp_scaled(x),
            Err(SolPredictError::MathOverflow)
        ));
    }

    #[test]
    fn test_exp_scaled_large_positive_errors() {
        // Mirrors the negative-side boundary: |x| >= 209 overflows.
        let x = 300 * PRECISION as i128;
        assert!(matches!(
            exp_scaled(x),
            Err(SolPredictError::MathOverflow)
        ));
    }

    #[test]
    fn test_exp_negative_five() {
        // exp(-5) in fixed-point: exact is ~6,737,947 (vs diverging Taylor ~150M)
        let result = exp_scaled(-5 * PRECISION as i128).unwrap();
        let expected = 6_737_947u128;
        let diff = if result > expected { result - expected } else { expected - result };
        assert!(diff <= 100, "exp(-5) off: {} vs {}", result, expected);
    }

    #[test]
    fn test_exp_negative_ten() {
        // exp(-10) in fixed-point: exact is ~45,399 (vs diverging Taylor ~925B)
        let result = exp_scaled(-10 * PRECISION as i128).unwrap();
        let expected = 45_399u128;
        let diff = if result > expected { result - expected } else { expected - result };
        assert!(diff <= 10, "exp(-10) off: {} vs {}", result, expected);
    }

    #[test]
    fn test_exp_negative_twenty() {
        // exp(-20) in fixed-point: exact is ~2
        let result = exp_scaled(-20 * PRECISION as i128).unwrap();
        assert!(result == 2 || result == 1, "exp(-20) expected ~2, got {}", result);
    }

    #[test]
    fn test_exp_round_trip_consistency() {
        // exp(x) * exp(-x) ≈ 1 for various inputs
        for x_val in [1i128, 2i128, 5i128, 10i128] {
            let x = x_val * PRECISION as i128;
            let e_pos = exp_scaled(x).unwrap();
            let e_neg = exp_scaled(-x).unwrap();
            let prod = e_pos
                .checked_mul(e_neg)
                .unwrap()
                .checked_div(PRECISION)
                .unwrap();
            let diff = if prod > PRECISION { prod - PRECISION } else { PRECISION - prod };
            assert!(
                diff <= PRECISION / 100,
                "Round-trip failed for x={}: prod={}, diff={}",
                x_val,
                prod,
                diff
            );
        }
    }

    #[test]
    fn test_buy_zero_delta_costs_zero() {
        let b = 100_000_000_000u128;
        let q = 50_000_000_000u128;
        assert_eq!(buy_cost_yes(b, q, q, 0).unwrap(), 0);
        assert_eq!(buy_cost_no(b, q, q, 0).unwrap(), 0);
    }

    #[test]
    fn test_sell_more_than_held_is_insufficient_shares() {
        let b = 100_000_000_000u128;
        let q = 50_000_000_000u128;
        assert!(matches!(
            sell_return_yes(b, q, q, q + 1),
            Err(SolPredictError::InsufficientShares)
        ));
        assert!(matches!(
            sell_return_no(b, q, q, q + 1),
            Err(SolPredictError::InsufficientShares)
        ));
    }

    #[test]
    fn test_cost_function_zero_b_errors() {
        // Division by b=0 inside exp_scaled is a checked_div miss => error.
        let q = 50_000_000_000u128;
        assert!(cost_function(0, q, q).is_err());
    }

    #[test]
    fn test_empty_pools_default_half_probability() {
        let b = 100_000_000_000u128;
        assert_eq!(probability_yes_bps(b, 0, 0).unwrap(), 5000);
    }

    #[test]
    fn test_probability_bounds() {
        let b = 100_000_000_000u128;
        // Monotonic: YES probability must rise as the YES side is funded more.
        let p_low = probability_yes_bps(b, 10_000_000_000, 90_000_000_000).unwrap();
        let p_high = probability_yes_bps(b, 90_000_000_000, 10_000_000_000).unwrap();
        assert!(p_low < p_high, "{} should be < {}", p_low, p_high);
        assert!(p_low > 0 && p_low < 10_000, "YES bps out of range: {}", p_low);
    }
}