/**
 * In-memory store for tracking fee withdrawal state per market.
 * Decoupled from PostgreSQL schema so queries to markets_cache
 * never fail if a fee_withdrawn column has not been migrated.
 */

const feeWithdrawnSet = new Set<string>();

export function isFeeWithdrawn(marketPubkey: string): boolean {
  if (!marketPubkey) return false;
  return feeWithdrawnSet.has(marketPubkey);
}

export function markFeeWithdrawn(marketPubkey: string): void {
  if (!marketPubkey) return;
  feeWithdrawnSet.add(marketPubkey);
}
