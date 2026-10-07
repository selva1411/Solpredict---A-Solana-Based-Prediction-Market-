use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::LpRewardsClaimed;
use crate::state::{LiquidityPosition, Market};

#[derive(Accounts)]
pub struct ClaimLpRewards<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// LP reward vault — source of lamports for LP payouts.
    /// CHECK: Validated by seeds. Data-less system account.
    #[account(
        mut,
        seeds = [LP_REWARD_VAULT_SEED, market.key().as_ref()],
        bump,
    )]
    pub lp_reward_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [LP_SEED, market.key().as_ref(), provider.key().as_ref()],
        bump = liquidity_position.bump,
        constraint = liquidity_position.owner  == provider.key() @ SolPredictError::Unauthorized,
        constraint = liquidity_position.market == market.key()   @ SolPredictError::Unauthorized,
    )]
    pub liquidity_position: Account<'info, LiquidityPosition>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimLpRewards>) -> Result<()> {
    let lp     = &ctx.accounts.liquidity_position;
    let market = &ctx.accounts.market;

    let total_claimable = calculate_pending_lp_rewards(
        lp.lp_tokens,
        lp.fee_debt,
        market.cumulative_fee_per_lp,
        lp.lp_rewards_earned,
    )?;

    require!(total_claimable > 0, SolPredictError::NothingToClaim);

    // Vault solvency check.
    let vault_balance = ctx.accounts.lp_reward_vault.lamports();
    let rent_min      = Rent::get()?.minimum_balance(0);
    let spendable     = vault_balance.saturating_sub(rent_min);
    require!(spendable >= total_claimable, SolPredictError::TreasuryInsufficient);

    let market_key  = market.key();
    let market_id   = market.market_id;
    let provider_key = ctx.accounts.provider.key();

    // Checks-effects-interactions: update state BEFORE the transfer.
    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    let lp = &mut ctx.accounts.liquidity_position;
    lp.fee_debt          = ctx.accounts.market.cumulative_fee_per_lp;
    lp.lp_rewards_earned = 0;
    lp.updated_at        = Clock::get()?.unix_timestamp;

    let market = &mut ctx.accounts.market;
    market.lp_fee_pool = market.lp_fee_pool.saturating_sub(total_claimable);

    // Vault signer seeds.
    let vault_bump   = ctx.bumps.lp_reward_vault;
    let vault_seeds  = &[LP_REWARD_VAULT_SEED, market_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[&vault_seeds[..]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.lp_reward_vault.to_account_info(),
                to:   ctx.accounts.provider.to_account_info(),
            },
            signer_seeds,
        ),
        total_claimable,
    )?;

    market.reentrancy_lock.release();

    emit!(LpRewardsClaimed { market_id, provider: provider_key, amount: total_claimable });

    Ok(())
}

/// Calculate total pending LP rewards.
pub fn calculate_pending_lp_rewards(
    lp_tokens: u64,
    fee_debt: u128,
    cumulative_fee_per_lp: u128,
    lp_rewards_earned: u64,
) -> Result<u64> {
    let acc_diff = cumulative_fee_per_lp.checked_sub(fee_debt).unwrap_or(0);

    let pending_from_acc = (lp_tokens as u128)
        .checked_mul(acc_diff)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128)
        .ok_or(SolPredictError::MathOverflow)? as u64;

    lp_rewards_earned
        .checked_add(pending_from_acc)
        .ok_or(error!(SolPredictError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lp_rewards_zero_when_no_fees() {
        let pending = calculate_pending_lp_rewards(10_000_000, 0, 0, 0).unwrap();
        assert_eq!(pending, 0);
    }

    #[test]
    fn test_single_lp_earns_all_fees() {
        let total_lp_tokens: u64 = 100_000_000_000; // 100 LP tokens
        let lp_fee: u64 = 5_000_000_000; // 5 SOL fee

        // Market updates accumulator:
        let delta = (lp_fee as u128) * (PRECISION as u128) / (total_lp_tokens as u128);
        let cumulative_fee_per_lp = delta;

        let pending = calculate_pending_lp_rewards(
            total_lp_tokens,
            0,
            cumulative_fee_per_lp,
            0,
        ).unwrap();

        assert_eq!(pending, lp_fee);
    }

    #[test]
    fn test_multiple_lps_pro_rata_split() {
        let lp_a_tokens: u64 = 70_000_000_000; // 70%
        let lp_b_tokens: u64 = 30_000_000_000; // 30%
        let total_lp_tokens: u64 = lp_a_tokens + lp_b_tokens; // 100%

        let lp_fee: u64 = 10_000_000_000; // 10 SOL fee
        let delta = (lp_fee as u128) * (PRECISION as u128) / (total_lp_tokens as u128);
        let cumulative = delta;

        let pending_a = calculate_pending_lp_rewards(lp_a_tokens, 0, cumulative, 0).unwrap();
        let pending_b = calculate_pending_lp_rewards(lp_b_tokens, 0, cumulative, 0).unwrap();

        assert_eq!(pending_a, 7_000_000_000);
        assert_eq!(pending_b, 3_000_000_000);
        assert_eq!(pending_a + pending_b, lp_fee);
    }

    #[test]
    fn test_snapshotting_accumulates_across_trades() {
        let lp_tokens: u64 = 50_000_000_000;
        let total_lp_tokens: u64 = 100_000_000_000;

        // Trade 1 fee: 2 SOL
        let fee_1: u64 = 2_000_000_000;
        let delta_1 = (fee_1 as u128) * (PRECISION as u128) / (total_lp_tokens as u128);
        let mut cumulative = delta_1;

        // LP snapshots rewards (e.g., partial withdrawal or add)
        let pending_1 = calculate_pending_lp_rewards(lp_tokens, 0, cumulative, 0).unwrap();
        assert_eq!(pending_1, 1_000_000_000); // 50% of 2 SOL

        let fee_debt = cumulative;
        let lp_rewards_earned = pending_1;

        // Trade 2 fee: 4 SOL
        let fee_2: u64 = 4_000_000_000;
        let delta_2 = (fee_2 as u128) * (PRECISION as u128) / (total_lp_tokens as u128);
        cumulative += delta_2;

        // Total claimable should be Trade 1 earned (1 SOL) + Trade 2 earned (2 SOL) = 3 SOL
        let total_claimable = calculate_pending_lp_rewards(
            lp_tokens,
            fee_debt,
            cumulative,
            lp_rewards_earned,
        ).unwrap();

        assert_eq!(total_claimable, 3_000_000_000);
    }
}
