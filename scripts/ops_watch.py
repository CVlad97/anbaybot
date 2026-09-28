#!/usr/bin/env python3
"""Read-only Anbaybot checks: standard library, no model calls, no orders."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import time
import urllib.request
from datetime import datetime, timezone

BASE = "https://lmfwtiytqwedrazxjnwu.supabase.co/functions/v1/anbaybot-public?path="
ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / "logs" / "autopilot"

def read(path):
    started = time.monotonic()
    try:
        request = urllib.request.Request(BASE + path, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=12) as response:
            data = json.load(response)
        return {"ok": True, "seconds": round(time.monotonic() - started, 2), "data": data}
    except Exception as exc:
        return {"ok": False, "seconds": round(time.monotonic() - started, 2), "error": type(exc).__name__}

def main():
    os.umask(0o077)
    LOGS.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        checks = dict(zip(["health", "readiness", "portfolio"], pool.map(read, ["health", "readiness", "portfolio"])))
    issues = []
    for key, result in checks.items():
        if not result["ok"]:
            issues.append(key + "_unavailable")
    ready = checks["readiness"].get("data", {})
    scan = ready.get("latestScanAt")
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(scan.replace("Z", "+00:00"))).total_seconds()
        if age < 0 or age > 1800:
            issues.append("scan_stale")
    except (AttributeError, ValueError, TypeError):
        issues.append("scan_missing")
    portfolio = checks["portfolio"].get("data", {})
    if checks["portfolio"]["ok"] and (portfolio.get("complete") is False or any(w.get("error") for w in portfolio.get("wallets", []))):
        issues.append("portfolio_partial")
    exchanges = [{"exchange": row.get("exchange"), "status": row.get("connection_status")} for row in ready.get("exchanges", [])]
    if any(row["status"] in ("NOT_CONFIGURED", "ERROR") for row in exchanges):
        issues.append("exchange_not_ready")
    disk = shutil.disk_usage("/")
    disk_pct = round(disk.used / disk.total * 100, 1)
    if disk_pct >= 90:
        issues.append("disk_above_90_pct")
    state = {"status": "DEGRADED" if issues else "OK", "issues": sorted(issues),
             "kill_switch": ready.get("killSwitch"), "live_enabled": ready.get("liveEnabled"),
             "scan_at": scan, "exchanges": exchanges, "mode": "READ_ONLY", "funds_moved": False}
    report = {**state, "checked_at": datetime.now(timezone.utc).isoformat(), "disk_used_pct": disk_pct,
              "requests": {k: {"ok": v["ok"], "seconds": v["seconds"]} for k, v in checks.items()}}
    digest = hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest()
    previous = LOGS / "watch-state.sha256"
    old = previous.read_text().strip() if previous.exists() else ""
    latest = LOGS / "latest.json"
    pending = LOGS / "latest.tmp"
    pending.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    pending.replace(latest)
    if old != digest:
        print(json.dumps(report, ensure_ascii=False))
        previous.write_text(digest)
    return report

if __name__ == "__main__":
    main()
