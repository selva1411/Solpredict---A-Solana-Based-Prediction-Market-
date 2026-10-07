ALTER TABLE markets_cache
    ADD COLUMN IF NOT EXISTS lp_fee_pool_lamports BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_lp_tokens      BIGINT NOT NULL DEFAULT 0;

ALTER TABLE liquidity_positions
    ADD COLUMN IF NOT EXISTS lp_rewards_earned   BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lp_rewards_claimed  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fee_debt            NUMERIC(39, 0) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lp_positions_rewards_earned
    ON liquidity_positions (lp_rewards_earned)
    WHERE lp_rewards_earned > 0;
