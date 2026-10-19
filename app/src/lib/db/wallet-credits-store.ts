/**
 * Singleton store for tracking accumulated fee credits per wallet.
 * Ensures that fees withdrawn from platform markets permanently credit the user's balance
 * and are reflected consistently across on-chain balance queries, page reloads, and manual refreshes.
 * Persists to disk so Next.js HMR or server restarts never lose wallet credits.
 */

import fs from "fs";
import path from "path";

const PERSIST_PATH = path.join(process.cwd(), ".wallet-credits.json");

function loadFromDisk(): Record<string, number> {
  try {
    if (typeof fs !== "undefined" && fs.existsSync && fs.existsSync(PERSIST_PATH)) {
      const data = fs.readFileSync(PERSIST_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return {};
}

function saveToDisk(map: Map<string, number>) {
  try {
    if (typeof fs !== "undefined" && fs.writeFileSync) {
      const obj = Object.fromEntries(map.entries());
      fs.writeFileSync(PERSIST_PATH, JSON.stringify(obj, null, 2), "utf-8");
    }
  } catch {
    // ignore
  }
}

const g = globalThis as unknown as {
  __solpredict_wallet_credits?: Map<string, number>;
};

if (!g.__solpredict_wallet_credits) {
  const initial = new Map<string, number>();
  const diskData = loadFromDisk();
  for (const [k, v] of Object.entries(diskData)) {
    if (typeof v === "number" && !isNaN(v)) {
      initial.set(k, v);
    }
  }
  g.__solpredict_wallet_credits = initial;
}

const walletCreditsMap = g.__solpredict_wallet_credits;

export function getWalletCredit(wallet: string): number {
  if (!wallet) return 0;
  // If in-memory is 0, double-check disk in case another process wrote it
  const current = walletCreditsMap.get(wallet) ?? 0;
  if (current === 0) {
    const disk = loadFromDisk();
    if (typeof disk[wallet] === "number" && disk[wallet] > 0) {
      walletCreditsMap.set(wallet, disk[wallet]);
      return disk[wallet];
    }
  }
  return current;
}

export function addWalletCredit(wallet: string, lamports: number): number {
  if (!wallet || !lamports || lamports <= 0) return getWalletCredit(wallet);
  const current = getWalletCredit(wallet);
  const updated = current + lamports;
  walletCreditsMap.set(wallet, updated);
  saveToDisk(walletCreditsMap);
  return updated;
}

export function setWalletCredit(wallet: string, lamports: number): void {
  if (!wallet) return;
  const val = Math.max(0, lamports);
  walletCreditsMap.set(wallet, val);
  saveToDisk(walletCreditsMap);
}

export function getAllWalletCredits(): Record<string, number> {
  return Object.fromEntries(walletCreditsMap.entries());
}
