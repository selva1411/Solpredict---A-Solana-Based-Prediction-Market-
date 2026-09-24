import http from "http";
import { neon } from "@neondatabase/serverless";

const BASE_URL = "http://localhost:3000";
const DB_URL = "postgresql://neondb_owner:npg_tKygU4jeO6Im@ep-flat-queen-azs0qug7-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const ADMIN_WALLET = "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const res = await fetch(url.toString(), options);
  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function runAudit() {
  console.log("==================================================");
  console.log("    SOLPREDICT DEEP END-TO-END AUDIT & TEST SUITE   ");
  console.log("==================================================\n");

  // 1. WHITE-BOX: Database & Direct Schema Verifications
  console.log("--- 1. WHITE-BOX: Database & Schema Audit ---");
  const sql = neon(DB_URL);
  const [dbTest] = await sql`SELECT current_database() as db, current_user as usr`;
  assert(dbTest.db === "neondb", `Connected to Neon database: ${dbTest.db}`);

  const [adminRow] = await sql`SELECT wallet, role FROM users WHERE wallet = ${ADMIN_WALLET}`;
  assert(adminRow && adminRow.role === "admin", `Admin wallet ${ADMIN_WALLET} has role 'admin'`);

  const markets = await sql`SELECT market_pubkey, question, status FROM markets_cache LIMIT 5`;
  assert(markets.length > 0, `markets_cache active rows verified (found ${markets.length})`);

  const [tradeCount] = await sql`SELECT count(*)::int as cnt FROM trades`;
  assert(tradeCount.cnt > 0, `trades table verified (total rows: ${tradeCount.cnt})`);

  const [posCount] = await sql`SELECT count(*)::int as cnt FROM positions`;
  assert(posCount.cnt > 0, `positions table verified (total rows: ${posCount.cnt})`);

  // 2. WHITE-BOX: Solana RPC Proxy & Rate Limiting Audit
  console.log("\n--- 2. WHITE-BOX: Solana RPC Proxy & Method Audit ---");
  const rpcVersion = await request("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getVersion", params: [] }),
  });
  assert(rpcVersion.status === 200 && rpcVersion.data?.result, "RPC proxy getVersion returns valid response");

  const rpcSlot = await request("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "getSlot", params: [] }),
  });
  assert(rpcSlot.status === 200 && typeof rpcSlot.data?.result === "number", "RPC proxy getSlot returns number");

  const rpcAirdrop = await request("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "requestAirdrop", params: [ADMIN_WALLET, 1000000000] }),
  });
  assert(rpcAirdrop.status === 200 && rpcAirdrop.data?.result, "RPC proxy localnet requestAirdrop credits successfully");

  // 3. BLACK-BOX: Core API Endpoints & Contracts
  console.log("\n--- 3. BLACK-BOX: Core API Endpoints & Contracts ---");
  const health = await request("/api/health");
  assert(health.status === 200 && health.data?.ok, "GET /api/health responds 200 OK with health status");

  const marketsList = await request("/api/markets/cached");
  assert(marketsList.status === 200 && Array.isArray(marketsList.data?.markets), "GET /api/markets/cached returns market array");

  const activity = await request("/api/activity/recent?limit=10");
  assert(activity.status === 200 && Array.isArray(activity.data?.activities), "GET /api/activity/recent returns activity entries");

  const leaderboard = await request("/api/leaderboard");
  assert(leaderboard.status === 200 && Array.isArray(leaderboard.data?.leaderboard), "GET /api/leaderboard returns ranked traders");

  const positions = await request(`/api/user/positions?wallet=${ADMIN_WALLET}`);
  assert(positions.status === 200 && positions.data?.ok, `GET /api/user/positions returns positions for ${ADMIN_WALLET}`);

  // 4. USER FLOW: Suggest Market -> Admin Review & Approve -> View Live Market
  console.log("\n--- 4. USER & ADMIN FLOW: Community Market Suggestion & Approval ---");
  const uniqueTitle = `Will Arsenal win the Champions League in 2027? (${Date.now().toString().slice(-4)})`;
  const suggestRes = await request("/api/proposals/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: uniqueTitle,
      description: "Community proposal test with custom buttons",
      category: "Sports",
      outcome1: "YES (Gunners)",
      outcome2: "NO (Other)",
      proposer: ADMIN_WALLET,
    }),
  });
  assert((suggestRes.status === 200 || suggestRes.status === 201) && suggestRes.data?.ok, `User successfully suggested market: "${uniqueTitle}"`);
  const proposalId = suggestRes.data?.proposal?.id || suggestRes.data?.id;

  const adminProposals = await request("/api/admin/proposals", {
    headers: { "x-wallet": ADMIN_WALLET },
  });
  const foundInQueue = adminProposals.data?.proposals?.find((p) => String(p.id) === String(proposalId));
  assert(foundInQueue, `Admin proposal review queue contains suggested market (ID: ${proposalId})`);
  assert(foundInQueue?.outcome1 === "YES (Gunners)" && foundInQueue?.outcome2 === "NO (Other)", `Custom buttons retained: "${foundInQueue?.outcome1}" vs "${foundInQueue?.outcome2}"`);

  // Admin approves proposal
  const approveRes = await request("/api/admin/proposals", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-wallet": ADMIN_WALLET },
    body: JSON.stringify({
      id: proposalId,
      action: "approve",
      outcome1: "YES (Gunners)",
      outcome2: "NO (Other)",
    }),
  });
  assert(approveRes.status === 200 && approveRes.data?.ok, `Admin successfully approved proposal (Market Pubkey: ${approveRes.data?.approvedMarketPubkey})`);
  const createdMarketPubkey = approveRes.data?.approvedMarketPubkey;

  // Verify the newly approved market is now live in markets_cache
  if (createdMarketPubkey) {
    const marketDetail = await request(`/api/markets/${createdMarketPubkey}`);
    assert(marketDetail.status === 200 && marketDetail.data?.market, `Newly approved market is live and readable at /api/markets/${createdMarketPubkey}`);

    // Verify market comments can be read and posted
    const commentsGet = await request(`/api/markets/${createdMarketPubkey}/comments`);
    assert(commentsGet.status === 200 && Array.isArray(commentsGet.data?.comments), "Market comments thread returns 200 OK");

    const commentPost = await request(`/api/markets/${createdMarketPubkey}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wallet": ADMIN_WALLET },
      body: JSON.stringify({
        authorWallet: ADMIN_WALLET,
        authorUsername: "admin_user",
        content: "Excited for this new market! Let's trade.",
      }),
    });
    assert((commentPost.status === 200 || commentPost.status === 201) && commentPost.data?.ok, "Post comment on newly approved market succeeds with 200/201 OK");
  }

  // 5. BLACK-BOX: Market Status Sync Without 400 Errors
  console.log("\n--- 5. BLACK-BOX: Market Status Sync Endpoint ---");
  const syncTest = await request("/api/sync/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
      marketId: 0,
      question: "Will SOL trade above $250 by Dec 31, 2026?",
      status: "open",
      category: "Crypto",
    }),
  });
  assert(syncTest.status === 200 && syncTest.data?.ok, "POST /api/sync/market succeeds with 200 OK (no 400 Bad Request error)");

  // 6. REALTIME SYNCHRONIZATION: Cross-Page Refresh Endpoint
  console.log("\n--- 6. REALTIME SYNCHRONIZATION: WebSocket Refresh ---");
  const refreshRes = await request("/api/realtime/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: ADMIN_WALLET }),
  });
  assert(refreshRes.status === 200 && refreshRes.data?.ok, "POST /api/realtime/refresh triggers WS push successfully");

  // 7. BLACK-BOX: SSR HTML Verification across Key Views
  console.log("\n--- 7. BLACK-BOX: Route SSR & HTML Content Verification ---");
  const routesToTest = [
    { path: "/", expectedText: "SolPredict" },
    { path: "/markets", expectedText: "markets" },
    { path: "/portfolio", expectedText: "portfolio" },
    { path: "/activity", expectedText: "activity" },
    { path: "/leaderboard", expectedText: "leaderboard" },
    { path: "/proposals", expectedText: "Proposals" },
    { path: "/admin", expectedText: "admin" },
  ];

  for (const r of routesToTest) {
    const res = await request(r.path);
    assert(res.status === 200 && typeof res.data === "string" && res.data.toLowerCase().includes(r.expectedText.toLowerCase()), `Route ${r.path} returns 200 OK and valid HTML`);
  }

  console.log("\n==================================================");
  console.log(`AUDIT SUMMARY: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
