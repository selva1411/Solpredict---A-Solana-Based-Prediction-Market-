import { Connection, PublicKey } from "@solana/web3.js";
import { EventParser, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";

export interface ParsedTxEvents {
  signature: string;
  blockTime: number | null;
  slot: number;
  events: anchor.Event[];
}

export async function fetchProgramTransactions(
  connection: Connection,
  address: PublicKey,
  limit = 30
): Promise<ParsedTxEvents[]> {
  const sigs = await connection.getSignaturesForAddress(
    address,
    { limit },
    "confirmed"
  );

  const txs = await Promise.all(
    sigs.map(async (sig) => {
      try {
        return await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
      } catch {
        return null;
      }
    })
  );

  return sigs
    .map((sig, idx) => ({ sig, tx: txs[idx] }))
    .filter(
      (
        pair
      ): pair is { sig: (typeof sigs)[0]; tx: NonNullable<(typeof txs)[0]> } =>
        Boolean(pair.tx?.meta?.logMessages)
    )
    .map(({ sig, tx }) => ({
      signature: sig.signature,
      blockTime: sig.blockTime ?? null,
      slot: sig.slot,
      events: [] as anchor.Event[],
      _logs: tx!.meta!.logMessages!,
    }));
}

export function parseTransactionEvents(
  program: Program,
  txs: Array<ParsedTxEvents & { _logs?: string[] }>
): ParsedTxEvents[] {
  const eventParser = new EventParser(program.programId, program.coder);

  return txs.map((tx) => {
    const events = eventParser.parseLogs(tx._logs ?? []);
    const { _logs, ...rest } = tx;
    return { ...rest, events: [...events] };
  });
}

export function formatEventTime(
  blockTime: number | string | Date | null | undefined,
  timeZone: string = "UTC"
): string {
  if (!blockTime) return "—";
  let date: Date;
  if (blockTime instanceof Date) {
    date = blockTime;
  } else if (typeof blockTime === "string") {
    const parsed = new Date(blockTime);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    } else {
      const n = Number(blockTime);
      if (Number.isNaN(n) || n === 0) return "—";
      date = new Date(n > 1e11 ? n : n * 1000);
    }
  } else {
    const n = Number(blockTime);
    if (Number.isNaN(n) || n === 0) return "—";
    date = new Date(n > 1e11 ? n : n * 1000);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return (
    date.toLocaleDateString("en-US", { timeZone }) +
    " " +
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })
  );
}

export function findMarketQuestion(
  marketId: anchor.BN,
  markets: Array<{ account: { marketId?: anchor.BN | null; question: string } }>
): string {
  const id = marketId?.toNumber?.() ?? -1;
  const match = markets.find((m) => m.account.marketId?.toNumber?.() === id);
  return match ? match.account.question : `Market #${id}`;
}

export type MarketStatus = "Open" | "Ended" | "Settled" | "Cancelled";

export interface AnchorMarketStatus {
  open?: Record<string, never>;
  settled?: Record<string, never>;
  cancelled?: Record<string, never>;
}

export function getMarketStatusString(
  status: AnchorMarketStatus | string | null | undefined,
  endTs?: number | string | anchor.BN | Date | null
): MarketStatus {
  if (!status) return "Open";

  const statusStr = typeof status === "string" ? status.toLowerCase() : "";
  const isSettled =
    statusStr === "settled" || Boolean((status as AnchorMarketStatus)?.settled);
  const isCancelled =
    statusStr === "cancelled" ||
    Boolean((status as AnchorMarketStatus)?.cancelled);
  const isOpen =
    statusStr === "open" ||
    statusStr === "ended" ||
    Boolean((status as AnchorMarketStatus)?.open);

  if (isSettled) return "Settled";
  if (isCancelled) return "Cancelled";

  if (isOpen) {
    if (endTs != null) {
      const now = Math.floor(Date.now() / 1000);
      let endSecs = 0;
      if (typeof endTs === "number") {
        endSecs = endTs > 1e11 ? Math.floor(endTs / 1000) : endTs;
      } else if (typeof endTs === "string") {
        const parsed = new Date(endTs).getTime();
        if (!Number.isNaN(parsed)) {
          endSecs = Math.floor(parsed / 1000);
        } else {
          const n = Number(endTs);
          if (!Number.isNaN(n) && n > 0)
            endSecs = n > 1e11 ? Math.floor(n / 1000) : n;
        }
      } else if (endTs instanceof Date) {
        endSecs = Math.floor(endTs.getTime() / 1000);
      } else if (
        typeof endTs === "object" &&
        endTs !== null &&
        "toNumber" in endTs
      ) {
        const n = (endTs as anchor.BN).toNumber();
        endSecs = n > 1e11 ? Math.floor(n / 1000) : n;
      }

      if (endSecs > 0 && now >= endSecs) {
        return "Ended";
      }
    }
    return "Open";
  }
  return "Open";
}
