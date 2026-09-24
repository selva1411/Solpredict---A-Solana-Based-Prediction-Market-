import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const dbUrl = process.env.DATABASE_URL;
console.log("==================================================");
console.log("       SOLPREDICT END-TO-END VERIFICATION SUITE   ");
console.log("==================================================");

let totalPassed = 0;
let totalFailed = 0;
const baseUrl = process.env.APP_URL || "http://localhost:3001";

function assert(condition, name, details = "") {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${name} ${details}`);
    totalFailed++;
  }
}

async function runWhiteBoxDbTests() {
  console.log("\n--- [WHITE-BOX] Database Schema & Query Verifications ---");
  if (!dbUrl) {
    assert(false, "DATABASE_URL is defined");
    return;
  }
  assert(true, "DATABASE_URL is defined");

  const sql = neon(dbUrl);

  // 1. Connection check
  try {
    const [dbInfo] = await sql`SELECT current_database(), current_user, version()`;
    assert(!!dbInfo.current_database, `Connected to Neon DB: ${dbInfo.current_database} as ${dbInfo.current_user}`);
  } catch (e) {
    assert(false, "Database connection check", e.message);
  }

  // 2. Markets check
  try {
    const markets = await sql`SELECT market_id, market_pubkey, question, status FROM markets_cache LIMIT 5`;
    assert(markets.length > 0, `markets_cache has active rows (found ${markets.length} sample rows)`);
  } catch (e) {
    assert(false, "Query markets_cache", e.message);
  }

  // 3. Admin user check
  try {
    const adminWallet = "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf";
    const [adminUser] = await sql`SELECT id, wallet, role FROM users WHERE wallet = ${adminWallet}`;
    assert(adminUser && adminUser.role === "admin", `User ${adminWallet} is present in DB with role 'admin'`);
  } catch (e) {
    assert(false, "Query admin user", e.message);
  }

  // 4. Platform config admin check
  try {
    const [cfg] = await sql`SELECT admin_wallets FROM platform_config LIMIT 1`;
    const hasAdmin = cfg && Array.isArray(cfg.admin_wallets) && cfg.admin_wallets.includes("dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf");
    assert(hasAdmin, `platform_config has dad8... in admin_wallets array`);
  } catch (e) {
    assert(false, "Query platform_config", e.message);
  }

  // 5. Trades & Positions
  try {
    const [tradesCount] = await sql`SELECT count(*)::int as count FROM trades`;
    const [posCount] = await sql`SELECT count(*)::int as count FROM positions`;
    assert(tradesCount.count > 0, `trades table populated (count: ${tradesCount.count})`);
    assert(posCount.count > 0, `positions table populated (count: ${posCount.count})`);
  } catch (e) {
    assert(false, "Query trades & positions", e.message);
  }
}

async function runWhiteBoxApiTests() {
  console.log("\n--- [WHITE-BOX] API Endpoint & Guard Verifications ---");
  const baseUrl = "http://localhost:3000";

  const endpoints = [
    { url: "/api/health", expectStatus: 200, check: (d) => d.ok && d.status === "healthy" && d.db.connected },
    { url: "/api/markets", expectStatus: 200, check: (d) => d.ok && Array.isArray(d.markets) && d.markets.length > 0 },
    { url: "/api/markets/cached", expectStatus: 200, check: (d) => d.ok && Array.isArray(d.markets) && d.markets.length > 0 },
    { url: "/api/activity/recent", expectStatus: 200, check: (d) => d.ok && Array.isArray(d.activities) },
    { url: "/api/leaderboard", expectStatus: 200, check: (d) => d.ok && Array.isArray(d.leaderboard) },
    { url: "/api/market-data/sol-price", expectStatus: 200, check: (d) => d.ok && d.price > 0 },
    { url: "/api/admin/audit", expectStatus: 200, headers: { "x-wallet": "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf" }, check: (d) => d.ok !== undefined || Array.isArray(d.logs) || d.data !== undefined },
    { url: "/api/admin/users", expectStatus: 200, headers: { "x-wallet": "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf" }, check: (d) => d.ok || Array.isArray(d.users) },
    { url: "/api/admin/proposals", expectStatus: 200, headers: { "x-wallet": "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf" }, check: (d) => d.ok || Array.isArray(d.proposals) },
    { url: "/api/admin/settings", expectStatus: 200, headers: { "x-wallet": "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf" }, check: (d) => d.ok || d.settings !== undefined },
    { url: "/api/proposals", expectStatus: 200, check: (d) => d.ok && Array.isArray(d.proposals) }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(baseUrl + ep.url, {
        headers: ep.headers || {}
      });
      const data = await res.json().catch(() => null);
      const statusOk = res.status === ep.expectStatus;
      const contentOk = data ? (ep.check ? ep.check(data) : true) : false;
      assert(statusOk && contentOk, `GET ${ep.url} (Status: ${res.status}, Payload validated)`);
    } catch (e) {
      assert(false, `GET ${ep.url}`, e.message);
    }
  }
}

async function runBlackBoxPageRenderTests() {
  console.log("\n--- [BLACK-BOX] Route SSR & HTML Content Verifications ---");
  const baseUrl = "http://localhost:3000";

  const pages = [
    { url: "/", needle: "SolPredict" },
    { url: "/markets", needle: "markets" },
    { url: "/market/6", needle: "Manchester United" },
    { url: "/proposals", needle: "Proposals" },
    { url: "/activity", needle: "activity" },
    { url: "/leaderboard", needle: "leaderboard" },
    { url: "/portfolio", needle: "portfolio" },
    { url: "/admin", needle: "admin" },
    { url: "/admin/dashboard", needle: "admin" },
    { url: "/admin/markets", needle: "admin" },
    { url: "/admin/settings", needle: "admin" },
    { url: "/admin/treasury", needle: "admin" },
    { url: "/admin/users", needle: "admin" },
    { url: "/create", needle: "create" },
    { url: "/rewards", needle: "rewards" }
  ];

  for (const page of pages) {
    try {
      const start = Date.now();
      const res = await fetch(baseUrl + page.url);
      const html = await res.text();
      const elapsed = Date.now() - start;
      const statusOk = res.status === 200;
      const containsContent = html.toLowerCase().includes(page.needle.toLowerCase());
      assert(
        statusOk && containsContent,
        `Page: ${page.url} -> 200 OK (${elapsed}ms, contains '${page.needle}', size: ${html.length}b)`
      );
    } catch (e) {
      assert(false, `Page: ${page.url}`, e.message);
    }
  }
}

async function testNewFeatureRequirements() {
  console.log("\n--- [FEATURE VERIFICATIONS] User Proposals, Custom Outcomes, Market Activity & Nav ---");

  // 1. Verify Discover redirects to Portfolio
  try {
    const res = await fetch(baseUrl + "/discover", { redirect: "manual" });
    const isRedirect = res.status === 307 || res.status === 308;
    const location = res.headers.get("location") || "";
    assert(
      isRedirect && location.includes("/portfolio"),
      "Navigation /discover redirects directly to /portfolio",
      `Status: ${res.status}, Location: ${location}`
    );
  } catch (e) {
    assert(false, "Navigation /discover redirects directly to /portfolio", e.message);
  }

  // 2. Verify Market-Specific Activity endpoint
  try {
    const allRes = await fetch(baseUrl + "/api/activity/recent?limit=5");
    const allData = await allRes.json();
    const firstTrade = allData.trades?.[0];
    if (firstTrade?.marketPubkey) {
      const filteredRes = await fetch(`${baseUrl}/api/activity/recent?marketPubkey=${firstTrade.marketPubkey}&limit=10`);
      const filteredData = await filteredRes.json();
      const allMatch = filteredData.trades?.every((t) => t.marketPubkey === firstTrade.marketPubkey);
      assert(
        filteredRes.ok && allMatch,
        `Market-specific activity filtering correctly scopes to ${firstTrade.marketPubkey.slice(0, 8)}...`
      );
    } else {
      assert(allRes.ok, "Market activity API endpoint responsive");
    }
  } catch (e) {
    assert(false, "Market-specific activity filtering", e.message);
  }

  // 3. Verify Regular User Proposal Submission with Custom Outcomes
  let createdProposalId = null;
  try {
    const testTitle = `Test Proposal ${Date.now()}`;
    const suggestRes = await fetch(baseUrl + "/api/proposals/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: testTitle,
        description: "Community suggested market with custom outcomes",
        category: "crypto",
        proposerWallet: "11111111111111111111111111111111",
        endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        outcome1: "Bullish Spike",
        outcome2: "Bearish Slump"
      })
    });
    const suggestData = await suggestRes.json();
    createdProposalId = suggestData.proposal?.id;
    assert(
      suggestRes.ok && (suggestData.ok || suggestData.success) && createdProposalId,
      `Regular user can suggest upcoming market without SOL bond (ID: ${createdProposalId})`
    );
  } catch (e) {
    assert(false, "Regular user market suggestion", e.message);
  }

  // 4. Verify Admin Proposal Review Queue contains the custom outcome metadata
  try {
    const proposalsRes = await fetch(baseUrl + "/api/admin/proposals");
    const proposalsData = await proposalsRes.json();
    const found = proposalsData.proposals?.find((p) => String(p.id) === String(createdProposalId));
    const hasCustomOutcomes =
      (found?.outcome1 === "Bullish Spike" && found?.outcome2 === "Bearish Slump") ||
      found?.description?.includes("Bullish Spike");
    assert(
      Boolean(found && hasCustomOutcomes),
      "Admin proposal review queue correctly displays user suggestion with custom button labels"
    );
  } catch (e) {
    assert(false, "Admin proposal review queue custom outcomes", e.message);
  }

  // 5. Verify local RPC Proxy resilience without 429
  try {
    const rpcRes = await fetch(baseUrl + "/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    const rpcData = await rpcRes.json();
    assert(
      rpcRes.ok && rpcData.result === "ok",
      "Solana RPC Proxy (/api/rpc) provides fast, 429-free responses"
    );
  } catch (e) {
    assert(false, "Solana RPC Proxy (/api/rpc)", e.message);
  }
}

async function main() {
  await runWhiteBoxDbTests();
  await runWhiteBoxApiTests();
  await runBlackBoxPageRenderTests();
  await testNewFeatureRequirements();

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("==================================================");
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
