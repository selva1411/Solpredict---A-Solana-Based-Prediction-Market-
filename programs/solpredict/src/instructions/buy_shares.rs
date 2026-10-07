use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::SharesPurchased;
use crate::state::{EmergencyPause, Market, MarketStatus, Side, UserPosition};
use crate::utils::{amm_math, check_not_paused, payout_math};

#[derive(Accounts)]
pub struct BuyShares<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    /// LP reward vault — receives LP_FEE_SHARE_BPS of every trade fee.
    /// CHECK: Validated by seeds constraint.
    #[account(
        mut,
        seeds = [LP_REWARD_VAULT_SEED, market.key().as_ref()],
        bump,
    )]
    pub lp_reward_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [YES_MINT_SEED, market.key().as_ref()],
        bump,
        constraint = yes_mint.key() == market.yes_mint @ SolPredictError::InvalidMint,
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [NO_MINT_SEED, market.key().as_ref()],
        bump,
        constraint = no_mint.key() == market.no_mint @ SolPredictError::InvalidMint,
    )]
    pub no_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = yes_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_yes_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = no_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_no_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = UserPosition::LEN,
        seeds = [POSITION_SEED, market.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        seeds = [PAUSE_SEED],
        bump = emergency_pause.bump,
    )]
    pub emergency_pause: Option<Account<'info, EmergencyPause>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<BuyShares>,
    side: Side,
    quantity: u64,
    max_cost_lamports: u64,
) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    let market = &ctx.accounts.market;

    require!(market.status == MarketStatus::Open, SolPredictError::MarketNotOpen);

    let clock = Clock::get()?;
    require!(clock.unix_timestamp < market.end_ts, SolPredictError::MarketExpired);
    require!(quantity > 0 && quantity <= MAX_SHARES_PER_TX, SolPredictError::InvalidQuantity);

    let pool_yes = market.yes_pool_lamports as u128;
    let pool_no = market.no_pool_lamports as u128;
    let dy_out = (quantity as u128) * (market.share_price_lamports as u128);
    let fee_bps = market.fee_bps;

    let cost_u128 = if dy_out == 0 || pool_yes == 0 || pool_no == 0 {
        payout_math::calculate_cost_with_fee(quantity, market.share_price_lamports, fee_bps)?
    } else {
        match side {
            Side::Yes => amm_math::get_buy_cost_in(pool_yes, pool_no, dy_out, fee_bps),
            Side::No  => amm_math::get_buy_cost_in(pool_no, pool_yes, dy_out, fee_bps),
        }.map_err(|_| error!(SolPredictError::MathOverflow))?
    };
    let cost = u64::try_from(cost_u128).map_err(|_| error!(SolPredictError::MathOverflow))?;

    require!(cost <= max_cost_lamports, SolPredictError::SlippageExceeded);

    // -------------------------------------------------------------------------
    // LP fee split:
    //   base_cost  = cost * (10_000 - fee_bps) / 10_000
    //   total_fee  = cost - base_cost
    //   lp_fee     = total_fee * LP_FEE_SHARE_BPS / 10_000  → lp_reward_vault
    //   admin_fee  = total_fee - lp_fee                      → stays in treasury
    // -------------------------------------------------------------------------
    let base_cost = (cost as u128)
        .checked_mul(10_000u128.checked_sub(fee_bps as u128).ok_or(SolPredictError::MathOverflow)?)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)? as u64;

    let total_fee = cost.checked_sub(base_cost).ok_or(SolPredictError::MathOverflow)?;

    let lp_fee = (total_fee as u128)
        .checked_mul(LP_FEE_SHARE_BPS as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)? as u64;

    let treasury_amount = cost.checked_sub(lp_fee).ok_or(SolPredictError::MathOverflow)?;

    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    // Transfer trade cost minus LP fee → treasury.
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        treasury_amount,
    )?;

    // Transfer LP fee portion → lp_reward_vault.
    if lp_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.lp_reward_vault.to_account_info(),
                },
            ),
            lp_fee,
        )?;
    }

    let mint_amount = (quantity as u128)
        .checked_mul(BASE_UNITS_PER_SHARE as u128)
        .ok_or(SolPredictError::MathOverflow)?;
    let mint_amount_u64 = u64::try_from(mint_amount).map_err(|_| error!(SolPredictError::MathOverflow))?;

    let (mint_account, ata_account) = match side {
        Side::Yes => (ctx.accounts.yes_mint.to_account_info(), ctx.accounts.buyer_yes_ata.to_account_info()),
        Side::No  => (ctx.accounts.no_mint.to_account_info(), ctx.accounts.buyer_no_ata.to_account_info()),
    };

    let market_id_bytes = ctx.accounts.market.market_id.to_le_bytes();
    let market_bump = ctx.accounts.market.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[MARKET_SEED, market_id_bytes.as_ref(), &[market_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo { mint: mint_account, to: ata_account, authority: ctx.accounts.market.to_account_info() },
            signer_seeds,
        ),
        mint_amount_u64,
    )?;

    let buyer_key = ctx.accounts.buyer.key();
    let market_key = ctx.accounts.market.key();
    let rent = Rent::get()?;
    let treasury_min = rent.minimum_balance(0);

    let market = &mut ctx.accounts.market;

    match side {
        Side::Yes => {
            market.yes_pool_lamports = market.yes_pool_lamports.checked_add(treasury_amount).ok_or(SolPredictError::MathOverflow)?;
            market.yes_supply = market.yes_supply.checked_add(mint_amount_u64).ok_or(SolPredictError::MathOverflow)?;
        }
        Side::No => {
            market.no_pool_lamports = market.no_pool_lamports.checked_add(treasury_amount).ok_or(SolPredictError::MathOverflow)?;
            market.no_supply = market.no_supply.checked_add(mint_amount_u64).ok_or(SolPredictError::MathOverflow)?;
        }
    }

    // Update global LP reward accumulator.
    if lp_fee > 0 {
        market.lp_fee_pool = market.lp_fee_pool.checked_add(lp_fee).ok_or(SolPredictError::MathOverflow)?;

        if market.total_lp_tokens > 0 {
            let delta = (lp_fee as u128)
                .checked_mul(PRECISION as u128)
                .ok_or(SolPredictError::MathOverflow)?
                .checked_div(market.total_lp_tokens as u128)
                .ok_or(SolPredictError::MathOverflow)?;

            market.cumulative_fee_per_lp = market.cumulative_fee_per_lp
                .checked_add(delta)
                .ok_or(SolPredictError::MathOverflow)?;
        }
    }

    let position = &mut ctx.accounts.user_position;
    if position.owner == Pubkey::default() {
        position.owner = buyer_key;
        position.market = market_key;
        position.bump = ctx.bumps.user_position;
    }
    match side {
        Side::Yes => { position.yes_amount = position.yes_amount.checked_add(mint_amount_u64).ok_or(SolPredictError::MathOverflow)?; }
        Side::No  => { position.no_amount = position.no_amount.checked_add(mint_amount_u64).ok_or(SolPredictError::MathOverflow)?; }
    }
    position.total_spent_lamports = position.total_spent_lamports.checked_add(cost).ok_or(SolPredictError::MathOverflow)?;

    let new_yes_pool = market.yes_pool_lamports;
    let new_no_pool = market.no_pool_lamports;
    let market_id = market.market_id;

    let treasury_after = ctx.accounts.treasury.lamports();
    require!(treasury_after >= treasury_min || treasury_after == 0, SolPredictError::TreasuryInsufficient);

    ctx.accounts.market.reentrancy_lock.release();

    emit!(SharesPurchased { market_id, buyer: buyer_key, side, quantity, cost, new_yes_pool, new_no_pool });

    Ok(())
}
