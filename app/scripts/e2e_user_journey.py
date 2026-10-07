#!/usr/bin/env python3
import json
import re
import urllib.request
import urllib.error
import sys

BASE_URL = "http://localhost:3001"

def fetch(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"User-Agent": "Mozilla/5.0 (UserSimulation; Linux x86_64) SolPredict/1.0"}
    if headers:
        req_headers.update(headers)
    if data is not None and "Content-Type" not in req_headers:
        req_headers["Content-Type"] = "application/json"
    
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

failures = 0

def check(step_name, condition, details=""):
    global failures
    if condition:
        print(f"  [PASS] {step_name}")
    else:
        print(f"  [FAIL] {step_name} - {details}")
        failures += 1

print("\n=======================================================")
print(" USER JOURNEY 1: Homepage & Navigation (Discovery)")
print("=======================================================")
status, html = fetch("/")
check("Homepage HTTP Status 200", status == 200, f"Got status {status}")
check("Branding & Title Present", "SolPredict" in html or "prediction" in html.lower(), "Brand name missing in SSR")
check("Navigation Link to /markets", 'href="/markets"' in html, "Missing /markets nav link")
check("Navigation Link to /leaderboard", 'href="/leaderboard"' in html, "Missing /leaderboard nav link")
check("Navigation Link to /portfolio", 'href="/portfolio"' in html, "Missing /portfolio nav link")
check("Navigation Link to /create", 'href="/create"' in html, "Missing /create nav link")
check("Wallet Connection Button Present", "Connect" in html or "wallet" in html.lower(), "Wallet connect trigger missing")

print("\n=======================================================")
print(" USER JOURNEY 2: Market Explorer & Search Filters")
print("=======================================================")
status, html = fetch("/markets")
check("Markets Page HTTP Status 200", status == 200, f"Got status {status}")

# Test real search query via API
status, res = fetch("/api/markets/search?q=SOL")
check("Search API 'SOL' HTTP 200", status == 200)
try:
    search_data = json.loads(res)
    results = search_data.get("markets", search_data if isinstance(search_data, list) else [])
    check("Search returns relevant items", len(results) > 0, "No results returned for SOL")
    if len(results) > 0:
        first = results[0]
        check("Market item contains question title", bool(first.get("question") or first.get("title")), "No question title in result")
except Exception as ex:
    check("Search API output parsed", False, str(ex))

print("\n=======================================================")
print(" USER JOURNEY 3: Market Details & Trade / Liquidity Panels")
print("=======================================================")
# Fetch market #1
status, html = fetch("/market/1")
check("Market 1 Page HTTP Status 200", status == 200, f"Got status {status}")

status, res = fetch("/api/markets/1")
check("Market 1 API HTTP 200", status == 200)
try:
    m = json.loads(res)
    market = m.get("market", m)
    check("Market contains question", bool(market.get("question") or market.get("title")), "Missing question")
    check("Market contains status", market.get("status") in ["active", "settled", "open", "closed", "disputed"], f"Status is {market.get('status')}")
    
    # Check liquidity stats
    status_liq, res_liq = fetch("/api/markets/1/liquidity")
    check("Market 1 Liquidity API HTTP 200", status_liq == 200)
    
    # Check comments feed
    status_comm, res_comm = fetch("/api/markets/1/comments")
    check("Market 1 Comments API HTTP 200", status_comm == 200)
except Exception as ex:
    check("Market 1 data inspection", False, str(ex))

print("\n=======================================================")
print(" USER JOURNEY 4: Market Creation / Proposal Journey")
print("=======================================================")
status, html = fetch("/create")
check("Create Market Page HTTP Status 200", status == 200)
check("Form elements rendered in SSR", "question" in html.lower() or "market" in html.lower() or "proposal" in html.lower())

# Test proposal creation API with invalid empty body
status, res = fetch("/api/markets/propose", method="POST", data={})
check("API rejects invalid proposal with 400", status == 400, f"Got {status}")

print("\n=======================================================")
print(" USER JOURNEY 5: Leaderboard & User Rankings")
print("=======================================================")
status, html = fetch("/leaderboard")
check("Leaderboard Page HTTP Status 200", status == 200)

status, res = fetch("/api/leaderboard")
check("Leaderboard API HTTP 200", status == 200)
try:
    lb_data = json.loads(res)
    traders = lb_data.get("leaderboard", lb_data.get("users", []))
    check("Leaderboard contains ranked entries", len(traders) > 0, "No traders listed")
    if len(traders) > 0:
        first_trader = traders[0]
        check("Trader entry has wallet/address", bool(first_trader.get("wallet") or first_trader.get("address")), "Missing wallet in trader")
except Exception as ex:
    check("Leaderboard data validation", False, str(ex))

print("\n=======================================================")
print(" USER JOURNEY 6: Portfolio & Activity Log")
print("=======================================================")
status, html = fetch("/portfolio")
check("Portfolio Page HTTP Status 200", status == 200)

status, res = fetch("/api/activity/recent")
check("Recent Activity Feed HTTP 200", status == 200)
try:
    act = json.loads(res)
    trades = act.get("activities", act.get("trades", act if isinstance(act, list) else []))
    check("Recent activity feed responsive", isinstance(trades, list))
except Exception as ex:
    check("Activity feed inspection", False, str(ex))

print("\n=======================================================")
if failures == 0:
    print(f" ALL USER JOURNEY TESTS COMPLETED SUCCESSFULLY (0 Failures)")
else:
    print(f" COMPLETED WITH {failures} FAILURES")
print("=======================================================\n")

sys.exit(failures)
