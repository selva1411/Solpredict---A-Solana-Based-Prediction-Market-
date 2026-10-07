#!/usr/bin/env python3
import json
import time
import urllib.request
import urllib.error
import sys

BASE_URL = "http://localhost:3001"

def request(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    
    payload = None
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            elapsed = (time.perf_counter() - start) * 1000
            body = resp.read().decode("utf-8")
            try:
                parsed = json.loads(body)
            except Exception:
                parsed = body
            return resp.status, parsed, elapsed
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - start) * 1000
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return e.code, parsed, elapsed
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return 0, str(e), elapsed

tests = []
passed = 0
failed = 0

def test(name, path, method="GET", data=None, headers=None, expected_status=[200], validator=None):
    global passed, failed
    status, body, elapsed = request(path, method, data, headers)
    ok = (status in expected_status)
    val_msg = ""
    if ok and validator:
        try:
            val_ok, msg = validator(body)
            if not val_ok:
                ok = False
                val_msg = f" (Validation failed: {msg})"
        except Exception as ex:
            ok = False
            val_msg = f" (Validator exception: {ex})"

    res = {
        "name": name,
        "path": path,
        "method": method,
        "status": status,
        "expected": expected_status,
        "elapsed_ms": round(elapsed, 2),
        "pass": ok,
        "val_msg": val_msg,
    }
    tests.append(res)
    if ok:
        passed += 1
        print(f"  ✓ [{status}] {name} ({elapsed:.1f}ms)")
    else:
        failed += 1
        print(f"  ✗ [{status}] {name} (expected {expected_status}){val_msg} ({elapsed:.1f}ms)")
        if isinstance(body, dict):
            print(f"      Response: {json.dumps(body)[:200]}")
        else:
            print(f"      Response: {str(body)[:200]}")

print("==================================================")
print(" 1. PUBLIC HEALTH & DATA ENDPOINTS")
print("==================================================")
test("Health check", "/api/health", expected_status=[200], validator=lambda b: (b.get("status") in ["ok", "healthy"], f"status is {b.get('status')}"))
test("Database Health check", "/api/health/db", expected_status=[200, 503], validator=lambda b: ("status" in b or "ok" in b or "error" in b, "unknown db health response"))
test("SOL Price Feed", "/api/market-data/sol-price", expected_status=[200], validator=lambda b: ("price" in b and float(b["price"]) > 0, "invalid sol price"))
test("Cached Markets", "/api/markets/cached", expected_status=[200], validator=lambda b: ("markets" in b and len(b["markets"]) > 0, "no markets returned"))
test("Markets Stats", "/api/markets/stats", expected_status=[200], validator=lambda b: ("totalMarkets" in b or "stats" in b or "ok" in b, "no stats"))
test("Trending Markets", "/api/markets/trending", expected_status=[200])
test("Market Search (empty query)", "/api/markets/search?q=", expected_status=[200, 400])
test("Market Search (valid query 'SOL')", "/api/markets/search?q=SOL", expected_status=[200])
test("Market Search (special chars SQL injection test)", "/api/markets/search?q=%27%20OR%201=1--", expected_status=[200])
test("Leaderboard API", "/api/leaderboard", expected_status=[200], validator=lambda b: (b.get("ok") is True or "leaderboard" in b or "users" in b, "no leaderboard data"))
test("Recent Activity API", "/api/activity/recent", expected_status=[200])
test("Proposals API (public list)", "/api/proposals", expected_status=[200])

print("\n==================================================")
print(" 2. USER & PORTFOLIO ENDPOINTS")
print("==================================================")
test("User Positions (missing wallet)", "/api/user/positions", expected_status=[400, 200])
test("User Positions (valid demo wallet)", "/api/user/positions?wallet=dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf", expected_status=[200])
test("User Profile (demo wallet)", "/api/user/profile/dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf", expected_status=[200, 404])
test("User Achievements", "/api/user/achievements?wallet=dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf", expected_status=[200])
test("User Notifications (unauthenticated protected)", "/api/user/notifications?wallet=dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf", expected_status=[401])
test("User Reclaimable (unauthenticated protected)", "/api/user/reclaimable?wallet=dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf", expected_status=[401])
test("User Rewards (unauthenticated protected)", "/api/user/rewards?wallet=dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf", expected_status=[401])

print("\n==================================================")
print(" 3. SINGLE MARKET & SUB-RESOURCES")
print("==================================================")
# Fetch a real market ID from cached markets first
_, cached_data, _ = request("/api/markets/cached")
market_id = "1"
if isinstance(cached_data, dict) and "markets" in cached_data and len(cached_data["markets"]) > 0:
    market_id = str(cached_data["markets"][0].get("id", "1"))
    print(f"  (Using active market ID: {market_id})")

test(f"Market Detail ({market_id})", f"/api/markets/{market_id}", expected_status=[200])
test(f"Market Liquidity ({market_id})", f"/api/markets/{market_id}/liquidity", expected_status=[200])
test(f"Market Comments ({market_id})", f"/api/markets/{market_id}/comments", expected_status=[200])
test(f"Market Disputes ({market_id})", f"/api/markets/{market_id}/disputes", expected_status=[200])
test("Nonexistent Market Detail", "/api/markets/99999999-invalid", expected_status=[404, 400, 200])

print("\n==================================================")
print(" 4. SECURITY & ADMIN GUARD TESTS (UNAUTHORIZED)")
print("==================================================")
test("Admin Dashboard (unauthorized)", "/api/admin/dashboard", expected_status=[401, 403])
test("Admin Stats (unauthorized)", "/api/admin/stats", expected_status=[401, 403])
test("Admin Markets (unauthorized)", "/api/admin/markets", expected_status=[401, 403])
test("Admin Treasury (unauthorized)", "/api/admin/treasury", expected_status=[401, 403])
test("Admin Users (unauthorized)", "/api/admin/users", expected_status=[401, 403])
test("Admin Audit (unauthorized)", "/api/admin/audit", expected_status=[401, 403])
test("Admin Settings (unauthorized)", "/api/admin/settings", expected_status=[401, 403])
test("Admin Emergency Pause (unauthorized POST)", "/api/admin/emergency/pause", method="POST", data={"reason": "test"}, expected_status=[401, 403])
test("Admin Proposals List (unauthorized)", "/api/admin/proposals", expected_status=[401, 403])
test("Admin Upgrade Program (unauthorized POST)", "/api/admin/upgrade-program", method="POST", data={}, expected_status=[401, 403])

print("\n==================================================")
print(" 5. MUTATION & INPUT VALIDATION TESTS")
print("==================================================")
test("Web Vitals Monitoring (valid POST)", "/api/monitor/web-vitals", method="POST", data={"name": "LCP", "value": 1200, "rating": "good", "delta": 100, "id": "v1-test"}, expected_status=[200, 204])
test("Web Vitals Monitoring (invalid payload)", "/api/monitor/web-vitals", method="POST", data={"bad": "payload"}, expected_status=[200, 400, 204])
test("Watchlist Toggle (empty payload)", "/api/watchlist", method="POST", data={}, expected_status=[400, 401])
test("Proposal Submission (missing fields)", "/api/markets/propose", method="POST", data={}, expected_status=[400, 422])
test("Airdrop Request (empty body)", "/api/airdrop", method="POST", data={}, expected_status=[400, 422])

print("\n==================================================")
print(f" Summary: {passed} PASSED, {failed} FAILED across {len(tests)} endpoints tested.")
print("==================================================")

with open("/tmp/blackbox_api_results.json", "w") as f:
    json.dump({"total": len(tests), "passed": passed, "failed": failed, "results": tests}, f, indent=2)

if failed > 0:
    sys.exit(1)
sys.exit(0)
