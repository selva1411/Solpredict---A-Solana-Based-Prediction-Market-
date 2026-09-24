#!/usr/bin/env bash
BASE="${BASE:-http://localhost:3001}"

echo "=============================="
echo " SolPredict Redesign Verifier"
echo " Base: $BASE"
echo "=============================="
echo ""

echo "--- HTTP STATUS ---"
for path in "/" "/markets" "/leaderboard" "/portfolio" "/create" "/proposals"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "${BASE}${path}" 2>/dev/null || echo "ERR")
  echo "  ${path}  ->  HTTP ${code}"
done

echo ""
echo "--- COLOR AUDIT (SSR HTML, amber should be 0) ---"
for path in "/" "/markets" "/leaderboard" "/portfolio"; do
  html=$(curl -s --max-time 12 "${BASE}${path}" 2>/dev/null)
  amber=$(echo "$html" | grep -oi "F2B84B" | wc -l | tr -d ' ')
  violet=$(echo "$html" | grep -oi "7C5CFC" | wc -l | tr -d ' ')
  teal=$(echo "$html" | grep -oi "00E5CC" | wc -l | tr -d ' ')
  magenta=$(echo "$html" | grep -oi "E040FB" | wc -l | tr -d ' ')
  if [ "$amber" -gt 0 ]; then status="FAIL"; else status="OK"; fi
  echo "  [$status] ${path}  -> amber:${amber}  violet:${violet}  teal:${teal}  magenta:${magenta}"
done

echo ""
echo "--- API HEALTH ---"
markets=$(curl -s --max-time 12 "${BASE}/api/markets/cached" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('markets',[])))" 2>/dev/null || echo "?")
echo "  /api/markets/cached  ->  ${markets} markets"

lb=$(curl -s --max-time 12 "${BASE}/api/leaderboard" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') else 'fail')" 2>/dev/null || echo "?")
echo "  /api/leaderboard  ->  ${lb}"

sol=$(curl -s --max-time 12 "${BASE}/api/market-data/sol-price" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('price','?'))" 2>/dev/null || echo "?")
echo "  /api/market-data/sol-price  ->  \$${sol}"

echo ""
echo "=============================="
echo " Done"
echo "=============================="
