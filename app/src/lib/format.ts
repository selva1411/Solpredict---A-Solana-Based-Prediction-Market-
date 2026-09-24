import BN from "bn.js";

/** Safety check for BigInt / u64 bounds */
export function assertBigIntSafe(val: bigint | number | string): bigint {
  try {
    const b = BigInt(val);
    if (b < 0n) throw new Error("Negative financial value");
    return b;
  } catch (e) {
    throw new Error(`Invalid financial BigInt value: ${val}`);
  }
}

/** Format basis points to percentage display string (e.g. 5000 -> "50.0%", null -> "—") */
export function formatBpsPct(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(1)}%`;
}

/** Convert basis points (0-10000) to percentage number (0-100) */
export function bpsToPct(bps: number | null | undefined): number | null {
  if (bps == null) return null;
  return bps / 100;
}

/** Convert BN / bigint lamports → human SOL string. e.g. 1000000000n → "1.000" */
export function formatSol(
  lamports: BN | bigint | number | null | undefined,
  decimals = 3
): string {
  if (lamports == null) return "0.000";
  let n: bigint;
  try {
    n = toBigIntLamports(lamports);
  } catch {
    return "0.000";
  }
  if (n < 0n) return "0.000";

  // Integer arithmetic only — converting a u64/bigint lamport value to a JS
  // number would silently lose precision above 2^53 (9e15 lamports ≈ 9M SOL).
  // Round half away from zero to match toFixed()'s rounding at the decimals.
  // NOTE: scale is built by repeated multiplication, NOT the `**` operator —
  // the root ts-mocha suite compiles with target es6, which transpiles `**`
  // into Math.pow() and crashes on bigint operands.
  const SOL = 1_000_000_000n;
  const d = Math.max(0, Math.min(Math.trunc(decimals) || 0, 18));
  let scale = 1n;
  for (let i = 0; i < d; i++) scale *= 10n;
  const scaled = (n * scale + SOL / 2n) / SOL;
  const intPart = scaled / scale;
  if (d === 0) return intPart.toString();
  const fracPart = scaled % scale;
  return `${intPart.toString()}.${fracPart.toString().padStart(d, "0")}`;
}

/** Convert lamports → number (SOL). Safe for math. */
export function lamportsToSol(
  lamports: BN | bigint | number | null | undefined
): number {
  if (lamports == null) return 0;
  // Below 2^53 a plain division is exact; above it, converting to number is
  // lossy by nature — callers needing exactness must use BigInt throughout.
  if (typeof lamports === "bigint") return Number(lamports) / 1_000_000_000;
  if (lamports instanceof BN)
    return Number(lamports.toString()) / 1_000_000_000;
  return Number(lamports) / 1_000_000_000;
}

/** Normalize any accepted lamport input to a bigint (throws on NaN/negative). */
function toBigIntLamports(lamports: BN | bigint | number): bigint {
  if (typeof lamports === "bigint") return lamports;
  if (BN.isBN(lamports)) return BigInt(lamports.toString());
  if (typeof lamports === "number" && Number.isFinite(lamports)) {
    return BigInt(Math.trunc(lamports));
  }
  throw new Error("Invalid lamports value");
}

export function bnToSol(lamports: BN | number | null | undefined): number {
  return lamportsToSol(lamports);
}

/** Convert BN → plain JS number */
export function bnToNum(value: BN | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (BN.isBN(value)) return value.toNumber();
  return Number(value);
}

/** Format large numbers with commas: 1234567 → "1,234,567" */
export function formatNumber(n: BN | number | null | undefined): string {
  if (n == null) return "0";
  return bnToNum(n).toLocaleString("en-US");
}

/** Converts display SOL amount (e.g. 1.5) to lamports BN */
export function solToLamports(solAmount: string | number): BN {
  const num = typeof solAmount === "string" ? parseFloat(solAmount) : solAmount;
  if (isNaN(num) || num < 0) return new BN(0);
  return new BN(Math.floor(num * 1_000_000_000));
}

/** Shortens a base58 address for display */
export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

export function calcYesPct(
  yesPool: BN | number | null | undefined,
  noPool: BN | number | null | undefined
): number {
  const yes = bnToNum(yesPool);
  const no = bnToNum(noPool);
  const total = yes + no;
  if (total === 0) return 50;
  return Math.round((yes / total) * 100);
}

export function calcNoPct(
  yesPool: BN | number | null | undefined,
  noPool: BN | number | null | undefined
): number {
  return 100 - calcYesPct(yesPool, noPool);
}

/** BN, number, ISO string, or Date → readable string "Jul 23, 2026, 02:30 PM" */
export function formatTs(
  ts: BN | number | string | Date | null | undefined,
  timeZone: string = "UTC"
): string {
  if (ts == null) return "—";
  let date: Date;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === "string") {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    } else {
      const n = Number(ts);
      if (Number.isNaN(n) || n === 0) return "—";
      date = new Date(n > 1e11 ? n : n * 1000);
    }
  } else {
    const t = bnToNum(ts as any);
    if (t === 0 || Number.isNaN(t)) return "—";
    date = new Date(t > 1e11 ? t : t * 1000);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** Returns time remaining until timestamp */
export function timeUntil(
  ts: BN | number | string | Date | null | undefined
): string {
  if (ts == null) return "—";
  let target = 0;
  if (ts instanceof Date) {
    target = ts.getTime();
  } else if (typeof ts === "string") {
    const parsed = new Date(ts).getTime();
    if (!Number.isNaN(parsed)) {
      target = parsed;
    } else {
      const n = Number(ts);
      if (!Number.isNaN(n) && n > 0) {
        target = n > 1e11 ? n : n * 1000;
      }
    }
  } else {
    const t = bnToNum(ts as any);
    if (!t || Number.isNaN(t)) return "—";
    target = t > 1e11 ? t : t * 1000;
  }
  if (!target || Number.isNaN(target)) return "—";
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** BN, number, ISO string, or Date → "2m ago", "1h ago", "yesterday", "just now" */
export function timeAgo(
  ts: BN | number | string | Date | null | undefined
): string {
  if (ts == null) return "—";
  let target = 0;
  if (ts instanceof Date) {
    target = ts.getTime();
  } else if (typeof ts === "string") {
    const parsed = new Date(ts).getTime();
    if (!Number.isNaN(parsed)) {
      target = parsed;
    } else {
      const n = Number(ts);
      if (!Number.isNaN(n) && n > 0) target = n > 1e11 ? n : n * 1000;
    }
  } else {
    const t = bnToNum(ts as any);
    if (!t || Number.isNaN(t)) return "—";
    target = t > 1e11 ? t : t * 1000;
  }
  if (!target || Number.isNaN(target)) return "—";

  const diff = Date.now() - target;
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatTimeLeft(ts: BN | number | null | undefined): string {
  if (ts == null) return "—";
  return timeUntil(ts);
}

export function isActive(
  ts: BN | number | string | Date | null | undefined
): boolean {
  if (ts == null) return false;
  let target = 0;
  if (ts instanceof Date) {
    target = ts.getTime();
  } else if (typeof ts === "string") {
    const parsed = new Date(ts).getTime();
    if (!Number.isNaN(parsed)) {
      target = parsed;
    } else {
      const n = Number(ts);
      if (!Number.isNaN(n) && n > 0) target = n > 1e11 ? n : n * 1000;
    }
  } else {
    const t = bnToNum(ts as any);
    if (!t || Number.isNaN(t)) return false;
    target = t > 1e11 ? t : t * 1000;
  }
  return target > Date.now();
}

/** Category name helper */
export function categoryName(idx: number): string {
  const cats = ["Crypto", "Sports", "Politics", "Tech", "Other"];
  return cats[idx] ?? "Other";
}

/** Category color helper */
export function categoryColor(idx: number): string {
  const colors = [
    "var(--color-crypto)",
    "var(--color-sports)",
    "var(--color-politics)",
    "var(--color-tech)",
    "var(--color-other)",
  ];
  return colors[idx] ?? "var(--color-other)";
}

/** Status label helper */
export function statusLabel(status: number): string {
  if (status === 0) return "Open";
  if (status === 1) return "Settled";
  if (status === 2) return "Cancelled";
  return "Unknown";
}

/** Outcome label helper */
export function outcomeLabel(winningOutcome: number): string {
  if (winningOutcome === 1) return "YES ✓";
  if (winningOutcome === 2) return "NO ✓";
  return "—";
}

/** Calculate expected payout helper for bet panel */
export function calcExpectedPayout(
  lamportsToBet: number,
  price: number,
  side: "yes" | "no",
  yesPoolLamports: number,
  noPoolLamports: number,
  feeBps = 0
) {
  if (!lamportsToBet || lamportsToBet <= 0) {
    return { tokens: 0, estimatedPayout: 0, roi: 0 };
  }
  const effectivePrice = Math.max(0.01, Math.min(0.99, price));
  const feePct = feeBps / 10000;
  const netBetLamports = lamportsToBet * (1 - feePct);
  const tokens = netBetLamports / (effectivePrice * 1e9);
  const estimatedPayoutSol = tokens;
  const betSol = lamportsToBet / 1e9;
  const roi = betSol > 0 ? ((estimatedPayoutSol - betSol) / betSol) * 100 : 0;
  return { tokens, estimatedPayout: estimatedPayoutSol, roi };
}
