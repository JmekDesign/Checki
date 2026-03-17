#!/usr/bin/env bash
set -euo pipefail

# 1) wait container running
for i in $(seq 1 120); do
  st="$(docker inspect -f '{{.State.Status}}' checki-checki-api-1 2>/dev/null || echo "")"
  if [ "$st" = "running" ]; then
    echo "STATE OK: running"
    break
  fi
  sleep 0.25
done

# 2) wait /api/health
docker compose exec -T checki-api python3 - <<'PY'
import time, urllib.request
last=None
for i in range(300):  # 60 sec
    try:
        body = urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=2).read().decode()
        print("HEALTH OK:", body)
        break
    except Exception as e:
        last = e
        time.sleep(0.2)
else:
    raise SystemExit(f"HEALTH FAILED: {last}")
PY
