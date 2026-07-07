#!/usr/bin/env python3
"""anbaybot_healthcheck.py — Vérifie que le site anbaybot répond correctement.

Usage: python3 anbaybot_healthcheck.py
Exits with code 0 if all pages respond, 1 otherwise.
Logs results to stdout.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "https://cvlad97.github.io/anbaybot/"
PAGES = {
    "/": "Dashboard",
    "/#/wallets": "Portefeuilles",
    "/#/signals": "Signaux",
    "/#/earnings": "Revenus",
    "/#/subscriptions": "Souscriptions",
    "/#/monitoring": "Monitoring",
    "/#/traders": "Traders",
    "/#/strategies": "Stratégies",
}
LOG_DIR = os.path.expanduser("~/.hermes/cron/output/anbaybot")
os.makedirs(LOG_DIR, exist_ok=True)

results = []
all_ok = True

for path, label in PAGES.items():
    url = BASE_URL + path.lstrip("/")
    start = time.time()
    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "Hermes-AnbayBot-Monitor/1.0")
        resp = urllib.request.urlopen(req, timeout=15)
        elapsed = int((time.time() - start) * 1000)
        status = resp.getcode()
        ok = status == 200
        results.append({"page": label, "url": url, "status": status, "ms": elapsed, "ok": ok})
        if not ok:
            all_ok = False
        print(f"[{'OK' if ok else 'FAIL'}] {label} → {status} ({elapsed}ms)")
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        results.append({"page": label, "url": url, "status": 0, "ms": elapsed, "ok": False, "error": str(e)})
        all_ok = False
        print(f"[FAIL] {label} → ERROR: {e} ({elapsed}ms)")

# Calculate uptime
total = len(results)
passed = sum(1 for r in results if r["ok"])
uptime = (passed / total * 100) if total > 0 else 0

summary = {
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "total": total,
    "passed": passed,
    "failed": total - passed,
    "uptime_pct": round(uptime, 1),
    "all_ok": all_ok,
    "checks": results,
}

logfile = os.path.join(LOG_DIR, f"check_{time.strftime('%Y%m%d_%H%M%S')}.json")
with open(logfile, "w") as f:
    json.dump(summary, f, indent=2)

print(f"\n{'='*40}")
print(f"Total: {total} | OK: {passed} | FAIL: {total - passed} | Uptime: {uptime:.1f}%")
print(f"Log: {logfile}")

sys.exit(0 if all_ok else 1)