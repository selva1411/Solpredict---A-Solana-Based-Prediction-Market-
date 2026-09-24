import { db } from "@/lib/db/client";
import { getPlatformStats } from "@/lib/data/platform";
import {
  marketsCache,
  trades,
  users,
  marketComments,
  userStats,
  auditLog,
  treasuryLedger,
  platformConfig,
  marketProposals,
  disputes,
  adminSettings,
} from "@/lib/db/schema";
import { sql, eq, desc, and } from "drizzle-orm";

/**
 * Admin-only aggregate queries. All admin API routes call these instead of
 * embedding SQL; the DB is the single read model.
 */

let inMemoryPaused = false;
let inMemoryPauseReason: string | null = null;
const inMemorySettings: Record<string, string> = {
  feeBps: "200",
  platformName: "SOLPredict",
  maintenanceMode: "false",
  maxMarketDuration: "2592000",
  minMarketDuration: "300",
};
const inMemoryAuditLogs: Array<{
  id: number;
  action: string;
  actor: string;
  resource: string | null;
  details: unknown;
  ip: string;
  createdAt: string;
}> = [
  {
    id: 1,
    action: "CONFIG_INIT",
    actor: process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
    resource: "platform_config",
    details: { feeBps: 200 },
    ip: "127.0.0.1",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 2,
    action: "MARKET_CREATE",
    actor: process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
    resource: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
    details: { question: "Will Solana reach $250 by end of month?" },
    ip: "127.0.0.1",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

export async function getAdminDashboard() {
  const platformStats = await getPlatformStats();
  if (!db) {
    return {
      stats: {
        markets: {
          total: platformStats.totalMarkets,
          open: platformStats.openMarkets,
          resolved: platformStats.settledMarkets,
          totalLiquidity: platformStats.totalLiquidity,
        },
        trades: {
          total: 42,
          volume24h: platformStats.volume24h,
          totalVolume: platformStats.totalVolume,
        },
        users: { total: platformStats.totalTraders },
        comments: { total: 18 },
        recentMarkets: [
          {
            marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
            question: "Will Solana reach $250 by end of month?",
            category: "Crypto",
            status: "open",
            totalVolume: 4200,
            createdAt: new Date().toISOString(),
          },
          {
            marketPubkey: "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
            question: "Will Bitcoin surpass $100k before Q4?",
            category: "Crypto",
            status: "open",
            totalVolume: 6800,
            createdAt: new Date().toISOString(),
          },
        ],
        recentTrades: [
          {
            id: 1,
            signature: "5K7...1b",
            marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
            trader: process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
            side: "yes",
            lamportsIn: 1000000000,
            blockTime: new Date(),
          },
        ],
        topTraders: [
          {
            wallet: process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
            username: "AdminMaster",
            volume: 450,
            pnl: 85.5,
            winRate: 0.75,
          },
          {
            wallet: "7Y2gCvbXqK1Z2MrF4tH9sPqN6B8aV3eW5xL0mJ4kL9",
            username: "SolWhale",
            volume: 320,
            pnl: 42.0,
            winRate: 0.68,
          },
        ],
        dailyVolume: [
          { date: "2026-09-15", volume: 45.2 },
          { date: "2026-09-16", volume: 62.8 },
          { date: "2026-09-17", volume: 55.1 },
          { date: "2026-09-18", volume: 78.4 },
          { date: "2026-09-19", volume: 92.0 },
          { date: "2026-09-20", volume: 110.5 },
          { date: "2026-09-21", volume: 125.4 },
        ],
        categoryBreakdown: [
          { category: "Crypto", count: 4 },
          { category: "Tech", count: 2 },
          { category: "Sports", count: 2 },
        ],
      },
    };
  }

  const [
    tradeStats,
    commentStats,
    recentMarkets,
    recentTrades,
    topTraders,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`COUNT(*)::int`,
      })
      .from(trades),

    db.select({ total: sql<number>`COUNT(*)::int` }).from(marketComments),

    db
      .select({
        marketPubkey: marketsCache.marketPubkey,
        question: marketsCache.question,
        category: marketsCache.category,
        status: marketsCache.status,
        totalVolume: marketsCache.totalVolume,
        createdAt: marketsCache.createdAt,
      })
      .from(marketsCache)
      .orderBy(desc(marketsCache.createdAt))
      .limit(5),

    db
      .select({
        id: trades.id,
        signature: trades.signature,
        marketPubkey: trades.marketPubkey,
        trader: trades.trader,
        side: trades.side,
        lamportsIn: trades.lamportsIn,
        blockTime: trades.blockTime,
      })
      .from(trades)
      .orderBy(desc(trades.blockTime))
      .limit(10),

    db
      .select({
        wallet: userStats.wallet,
        username: users.username,
        volume: userStats.totalVolume,
        pnl: userStats.realizedPnl,
        winRateBps: userStats.winRateBps,
      })
      .from(userStats)
      .leftJoin(users, eq(users.wallet, userStats.wallet))
      .orderBy(desc(sql`CAST(user_stats.total_volume AS NUMERIC)`))
      .limit(10),
  ]);

  const dailyVolumeResult = await db.execute(sql`
    SELECT to_char(DATE(block_time), 'YYYY-MM-DD') as date,
           COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as volume
    FROM trades
    WHERE block_time > NOW() - INTERVAL '30 days'
    GROUP BY DATE(block_time)
    ORDER BY date ASC
  `);

  const dailyVolume = (dailyVolumeResult.rows as Record<string, unknown>[]).map(
    (r) => ({
      date: String(r.date),
      volume: Number(r.volume || 0),
    })
  );

  const categoryBreakdown = await db
    .select({
      category: marketsCache.category,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(marketsCache)
    .groupBy(marketsCache.category);

  return {
    stats: {
      markets: {
        total: platformStats.totalMarkets,
        open: platformStats.openMarkets,
        resolved: platformStats.settledMarkets,
        totalLiquidity: platformStats.totalLiquidity,
      },
      trades: {
        total: tradeStats[0]?.total ?? 0,
        volume24h: platformStats.volume24h,
        totalVolume: platformStats.totalVolume,
      },
      users: { total: platformStats.totalTraders },
      comments: { total: commentStats[0]?.total ?? 0 },
      recentMarkets: recentMarkets.map((m) => ({
        ...m,
        totalVolume: Number(m.totalVolume ?? 0),
      })),
      recentTrades,
      topTraders: topTraders.map((t) => ({
        wallet: t.wallet,
        username: t.username,
        volume: Number(t.volume ?? 0),
        pnl: Number(t.pnl ?? 0),
        winRate: t.winRateBps != null ? t.winRateBps / 100 : null,
      })),
      dailyVolume,
      categoryBreakdown,
    },
  };
}

export async function getAdminStats() {
  const platformStats = await getPlatformStats();

  if (!db) {
    return {
      totalMarkets: platformStats.totalMarkets,
      openMarkets: platformStats.openMarkets,
      settledMarkets: platformStats.settledMarkets,
      totalTrades: 42,
      totalUsers: platformStats.totalTraders,
      totalVolume: platformStats.totalVolume,
      totalLiquidity: platformStats.totalLiquidity,
      avgWinRate: 0.68,
      totalComments: 18,
      dailyVolume: [
        { date: "2026-09-15", volume: 45.2 },
        { date: "2026-09-16", volume: 62.8 },
        { date: "2026-09-17", volume: 55.1 },
        { date: "2026-09-18", volume: 78.4 },
        { date: "2026-09-19", volume: 92.0 },
        { date: "2026-09-20", volume: 110.5 },
        { date: "2026-09-21", volume: 125.4 },
      ],
      categoryBreakdown: [
        { category: "Crypto", count: 4, volume: 8500 },
        { category: "Tech", count: 2, volume: 3200 },
        { category: "Sports", count: 2, volume: 2800 },
      ],
    };
  }

  const [tradeStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
    })
    .from(trades);

  const [userAgg] = await db
    .select({
      avgWinRate: sql<number>`COALESCE(AVG(win_rate_bps), 0) / 100`,
    })
    .from(userStats);

  const [commentStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(marketComments);

  const dailyVolumeResult = await db.execute(sql`
    SELECT to_char(DATE(block_time), 'YYYY-MM-DD') as date,
           COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as volume
    FROM trades
    WHERE block_time > NOW() - INTERVAL '30 days'
    GROUP BY DATE(block_time)
    ORDER BY date ASC
  `);

  const dailyVolume = (dailyVolumeResult.rows as Record<string, unknown>[]).map(
    (r) => ({
      date: String(r.date),
      volume: Number(r.volume || 0),
    })
  );

  const categoryBreakdown = await db
    .select({
      category: marketsCache.category,
      count: sql<number>`COUNT(*)::int`,
      volume: sql<number>`COALESCE(SUM(CAST(${marketsCache.totalVolume} AS NUMERIC)), 0)`,
    })
    .from(marketsCache)
    .groupBy(marketsCache.category);

  return {
    totalMarkets: platformStats.totalMarkets,
    openMarkets: platformStats.openMarkets,
    settledMarkets: platformStats.settledMarkets,
    totalTrades: tradeStats?.total || 0,
    totalUsers: platformStats.totalTraders,
    totalVolume: platformStats.totalVolume,
    totalLiquidity: platformStats.totalLiquidity,
    avgWinRate: Number(userAgg?.avgWinRate || 0),
    totalComments: commentStats?.total || 0,
    dailyVolume,
    categoryBreakdown,
  };
}

export async function getAuditLog(page = 1, limit = 50) {
  if (!db) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const paged = inMemoryAuditLogs.slice(offset, offset + limit);
    return {
      logs: paged,
      pagination: {
        page,
        limit,
        total: inMemoryAuditLogs.length,
        totalPages: Math.ceil(inMemoryAuditLogs.length / limit) || 1,
      },
    };
  }
  const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(auditLog),
  ]);

  const total = countRows[0]?.count ?? 0;
  return {
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor,
      resource: r.resource,
      details: r.details,
      ip: r.ip,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAdminUsers() {
  if (!db) {
    return [
      {
        wallet: process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
        username: "AdminMaster",
        avatarUrl: null,
        bio: "Lead Platform Admin",
        twitterHandle: "@solpredict",
        role: "admin",
        isBanned: false,
        totalWagered: 450,
        totalProfit: 85.5,
        winRate: 0.75,
        marketsTraded: 12,
        lastActive: new Date(),
        createdAt: new Date(Date.now() - 86400000 * 30),
      },
      {
        wallet: "7Y2gCvbXqK1Z2MrF4tH9sPqN6B8aV3eW5xL0mJ4kL9",
        username: "SolWhale",
        avatarUrl: null,
        bio: "Crypto & Prediction Market Whale",
        twitterHandle: "@solwhale",
        role: "user",
        isBanned: false,
        totalWagered: 320,
        totalProfit: 42.0,
        winRate: 0.68,
        marketsTraded: 9,
        lastActive: new Date(Date.now() - 3600000 * 2),
        createdAt: new Date(Date.now() - 86400000 * 20),
      },
      {
        wallet: "9xQeWvK7tL3mN5pP2rS8tU1vW4yZ6aB0cD3eF5gH7jK",
        username: "DegenTrader",
        avatarUrl: null,
        bio: "Trading yes on tech",
        twitterHandle: null,
        role: "user",
        isBanned: false,
        totalWagered: 180,
        totalProfit: -12.4,
        winRate: 0.44,
        marketsTraded: 15,
        lastActive: new Date(Date.now() - 3600000 * 5),
        createdAt: new Date(Date.now() - 86400000 * 15),
      },
    ];
  }

  const rows = await db
    .select({
      wallet: users.wallet,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      twitterHandle: users.twitterHandle,
      role: users.role,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
      lastActive: users.lastActive,
      totalVolume: userStats.totalVolume,
      realizedPnl: userStats.realizedPnl,
      winRateBps: userStats.winRateBps,
      marketsTraded: userStats.marketsTraded,
    })
    .from(users)
    .leftJoin(userStats, eq(userStats.wallet, users.wallet))
    .orderBy(
      desc(sql`CAST(COALESCE(${userStats.totalVolume}, '0') AS NUMERIC)`)
    )
    .limit(100);

  return rows.map((u) => ({
    wallet: u.wallet,
    username: u.username,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    twitterHandle: u.twitterHandle,
    role: u.role,
    isBanned: u.isBanned,
    totalWagered: Number(u.totalVolume || 0),
    totalProfit: Number(u.realizedPnl || 0),
    winRate: u.winRateBps != null ? u.winRateBps / 100 : 0,
    marketsTraded: u.marketsTraded || 0,
    lastActive: u.lastActive,
    createdAt: u.createdAt,
  }));
}

export interface TreasuryQuery {
  page: number;
  limit: number;
  kind?: string;
  direction?: "in" | "out";
}

/** Set global paused state in platform_config (upsert single row). */
export async function setPlatformPaused(
  paused: boolean,
  pauseReason: string | null
) {
  if (!db) {
    inMemoryPaused = paused;
    inMemoryPauseReason = pauseReason;
    return;
  }
  const existing = await db.select().from(platformConfig).limit(1);
  if (existing.length === 0) {
    await db.insert(platformConfig).values({ paused, pauseReason });
  } else {
    await db
      .update(platformConfig)
      .set({ paused, pauseReason, updatedAt: new Date() })
      .where(eq(platformConfig.id, existing[0].id));
  }
}

/** Set a single market's status (used by per-market emergency pause/unpause). */
export async function setMarketStatus(marketPubkey: string, status: string) {
  if (!db) return;
  await db
    .update(marketsCache)
    .set({ status, updatedAt: new Date() })
    .where(eq(marketsCache.marketPubkey, marketPubkey));
}

export interface ProposalReviewInput {
  idOrPubkey: string;
  status: "approved" | "rejected";
  reviewer: string;
  note: string;
}

/** Approve or reject a pending market proposal. */
export async function reviewProposal(input: ProposalReviewInput) {
  if (!db) {
    return {
      proposal: {
        id: Number(input.idOrPubkey) || 1,
        status: input.status,
        reviewer: input.reviewer,
        reviewNote: input.note,
        rejectionReason: input.status === "rejected" ? input.note : null,
        reviewedAt: new Date(),
      },
    };
  }
  const id = Number(input.idOrPubkey);

  let proposal;
  if (!Number.isNaN(id)) {
    [proposal] = await db
      .select()
      .from(marketProposals)
      .where(eq(marketProposals.id, id))
      .limit(1);
  } else {
    [proposal] = await db
      .select()
      .from(marketProposals)
      .where(eq(marketProposals.proposalPubkey, input.idOrPubkey))
      .limit(1);
  }
  if (!proposal) return null;
  if (proposal.status !== "pending")
    return { error: `Proposal is already ${proposal.status}` };

  const [updated] = await db
    .update(marketProposals)
    .set({
      status: input.status,
      reviewer: input.reviewer,
      reviewNote: input.note,
      rejectionReason: input.status === "rejected" ? input.note : null,
      reviewedAt: new Date(),
    })
    .where(eq(marketProposals.id, proposal.id))
    .returning();

  return { proposal: updated };
}

export interface DisputeResolution {
  disputeId: number;
  action: "upheld" | "rejected";
  winningOutcome?: string;
  note: string;
  resolver: string;
}

/**
 * Resolve a settlement dispute. Upheld: refund bond + update market outcome.
 * Rejected: forfeit bond to treasury. Both restore market status to settled.
 */
export async function resolveDisputeAdmin(input: DisputeResolution) {
  if (!db) {
    return { action: input.action, winningOutcome: input.winningOutcome || "yes" };
  }

  const [dispute] = await db
    .select()
    .from(disputes)
    .where(eq(disputes.id, input.disputeId))
    .limit(1);
  if (!dispute) return null;
  if (dispute.status !== "open" && dispute.status !== "pending") {
    return { error: `Dispute is already ${dispute.status}` };
  }

  const resolutionNote = input.note || `Dispute ${input.action} by admin`;
  const bondLamports = dispute.bondLamports ?? 100_000_000; // 0.1 SOL

  await db
    .update(disputes)
    .set({
      status: input.action === "upheld" ? "upheld" : "rejected",
      resolution: resolutionNote,
      resolutionNote,
      resolver: input.resolver,
      resolvedBy: input.resolver,
      resolvedAt: new Date(),
    })
    .where(eq(disputes.id, input.disputeId));

  if (input.action === "upheld") {
    const finalOutcome = (
      input.winningOutcome ||
      dispute.claimedOutcome ||
      "YES"
    ).toLowerCase();
    await db
      .update(marketsCache)
      .set({
        status: "settled",
        winningOutcome: finalOutcome,
        updatedAt: new Date(),
      })
      .where(eq(marketsCache.marketPubkey, dispute.marketPubkey));

    await db.insert(treasuryLedger).values({
      direction: "out",
      kind: "bond_forfeit", // refund to disputer
      amount: bondLamports,
      marketPubkey: dispute.marketPubkey,
      actor: dispute.disputer,
      note: `Dispute upheld: bond refunded + reward issued for market ${dispute.marketPubkey}`,
    });

    return { action: "upheld", winningOutcome: finalOutcome };
  }

  await db
    .update(marketsCache)
    .set({ status: "settled", updatedAt: new Date() })
    .where(eq(marketsCache.marketPubkey, dispute.marketPubkey));

  await db.insert(treasuryLedger).values({
    direction: "in",
    kind: "bond_forfeit",
    amount: bondLamports,
    marketPubkey: dispute.marketPubkey,
    actor: dispute.disputer,
    note: `Dispute rejected: bond forfeited to treasury for market ${dispute.marketPubkey}`,
  });

  return { action: "rejected" };
}

export async function getAdminSettings() {
  if (!db) {
    return {
      settings: inMemorySettings,
      structured: {
        feeBps: Number(inMemorySettings.feeBps || 200),
        adminWallet: inMemorySettings.adminWallet || process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
        platformName: inMemorySettings.platformName || "SOLPredict",
        maintenanceMode: inMemorySettings.maintenanceMode === "true",
        maxMarketDuration: Number(inMemorySettings.maxMarketDuration || 2592000),
        minMarketDuration: Number(inMemorySettings.minMarketDuration || 300),
      },
    };
  }
  const rows = await db.select().from(adminSettings);
  const settingsMap: Record<string, string> = {};
  rows.forEach((r) => {
    settingsMap[r.key] = r.value;
  });

  return {
    settings: settingsMap,
    structured: {
      feeBps: Number(settingsMap.feeBps || 200),
      adminWallet: settingsMap.adminWallet || process.env.ADMIN_WALLET || "",
      platformName: settingsMap.platformName || "SOLPredict",
      maintenanceMode: settingsMap.maintenanceMode === "true",
      maxMarketDuration: Number(settingsMap.maxMarketDuration || 2592000),
      minMarketDuration: Number(settingsMap.minMarketDuration || 300),
    },
  };
}

/** Upsert one adminSettings key/value pair. */
export async function upsertAdminSetting(
  key: string,
  value: string,
  updatedBy: string
) {
  if (!db) {
    inMemorySettings[key] = value;
    return;
  }
  const existing = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.key, key))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(adminSettings)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(adminSettings.key, key));
  } else {
    await db
      .insert(adminSettings)
      .values({ key, value, updatedBy, updatedAt: new Date() });
  }
}

export async function logAuditEntry(
  action: string,
  actor: string,
  resource: string,
  details: unknown,
  ip: string
) {
  if (!db) {
    inMemoryAuditLogs.unshift({
      id: inMemoryAuditLogs.length + 1,
      action,
      actor,
      resource,
      details,
      ip,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  await db.insert(auditLog).values({ action, actor, resource, details, ip });
}

export async function getTreasuryOverview(query: TreasuryQuery) {
  const treasuryAddress =
    process.env.ADMIN_WALLET || "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf";

  if (!db) {
    const mockLedger = [
      {
        id: 1,
        ts: new Date(Date.now() - 3600000 * 3).toISOString(),
        signature: "4K7m9X...1a",
        direction: "in" as const,
        kind: "fee_collected",
        amountLamports: 250000000,
        amountSol: 0.25,
        marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
        actor: treasuryAddress,
        note: "Protocol trading fee (2%)",
      },
      {
        id: 2,
        ts: new Date(Date.now() - 3600000 * 12).toISOString(),
        signature: "5mX8pL...2b",
        direction: "in" as const,
        kind: "fee_collected",
        amountLamports: 180000000,
        amountSol: 0.18,
        marketPubkey: "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
        actor: "7Y2gCvbXqK1Z2M...4kL9",
        note: "Protocol trading fee (2%)",
      },
    ];

    return {
      treasuryWallet: treasuryAddress,
      ledger: {
        items: mockLedger,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: mockLedger.length,
          totalPages: 1,
        },
      },
      ledgerTotals: {
        totalInLamports: 430000000,
        totalOutLamports: 0,
        netLedgerSol: 0.43,
      },
      marketFees: [
        {
          marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
          question: "Will Solana reach $250 by end of month?",
          status: "open",
          feeLamports: 250000000,
          feeSol: 0.25,
        },
        {
          marketPubkey: "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
          question: "Will Bitcoin surpass $100k before Q4?",
          status: "open",
          feeLamports: 180000000,
          feeSol: 0.18,
        },
      ],
    };
  }

  const { page, limit, kind, direction } = query;
  const offset = (page - 1) * limit;

  const [config] = await db.select().from(platformConfig).limit(1);
  const configuredTreasury =
    config?.treasuryWallet || process.env.ADMIN_WALLET || "";

  const conditions: any[] = [];
  if (kind) conditions.push(eq(treasuryLedger.kind, kind));
  if (direction) conditions.push(eq(treasuryLedger.direction, direction));
  const whereClause =
    conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

  const [ledgerRows, countRows, ledgerSum] = await Promise.all([
    db
      .select()
      .from(treasuryLedger)
      .where(whereClause)
      .orderBy(desc(treasuryLedger.ts))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(treasuryLedger)
      .where(whereClause),
    db
      .select({
        totalIn: sql<string>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)::text`,
        totalOut: sql<string>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::text`,
      })
      .from(treasuryLedger),
  ]);

  const totalLedgerInLamports = Number(ledgerSum[0]?.totalIn || 0);
  const totalLedgerOutLamports = Number(ledgerSum[0]?.totalOut || 0);

  const marketFees = await db
    .select({
      marketPubkey: marketsCache.marketPubkey,
      question: marketsCache.question,
      feeCollectedLamports: marketsCache.feeCollectedLamports,
      status: marketsCache.status,
    })
    .from(marketsCache)
    .where(sql`COALESCE(fee_collected_lamports, 0) > 0`)
    .limit(50);

  return {
    treasuryWallet: configuredTreasury,
    ledger: {
      items: ledgerRows.map((r) => ({
        id: r.id,
        ts: r.ts?.toISOString() ?? new Date().toISOString(),
        signature: r.signature,
        direction: r.direction,
        kind: r.kind,
        amountLamports: r.amount,
        amountSol: Number((r.amount / 1e9).toFixed(4)),
        marketPubkey: r.marketPubkey,
        actor: r.actor,
        note: r.note,
      })),
      pagination: {
        page,
        limit,
        total: countRows[0]?.count ?? 0,
        totalPages: Math.ceil((countRows[0]?.count ?? 0) / limit),
      },
    },
    ledgerTotals: {
      totalInLamports: totalLedgerInLamports,
      totalOutLamports: totalLedgerOutLamports,
      netLedgerSol: (totalLedgerInLamports - totalLedgerOutLamports) / 1e9,
    },
    marketFees: marketFees.map((m) => ({
      marketPubkey: m.marketPubkey,
      question: m.question,
      status: m.status,
      feeLamports: m.feeCollectedLamports ?? 0,
      feeSol: Number(((m.feeCollectedLamports ?? 0) / 1e9).toFixed(4)),
    })),
  };
}
