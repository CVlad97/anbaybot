#!/usr/bin/env python3
"""Run a public-data-only spot simulation, with an atomic public status report."""
import datetime as dt
import fcntl
import json
import math
import os
from pathlib import Path
import sqlite3
import tempfile
import urllib.request

SYMBOL = "BTCUSDT"
INITIAL_CASH = 1000.0
ORDER_SIZE = 100.0
FEE = 0.001
SLIPPAGE = 0.0005

def fetch(path):
    request = urllib.request.Request("https://api.mexc.com/api/v3/" + path,
                                     headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.load(response)

def market():
    candles = fetch("klines?symbol=" + SYMBOL + "&interval=1m&limit=32")
    book = fetch("ticker/bookTicker?symbol=" + SYMBOL)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    closed = [row for row in candles if float(row[6]) / 1000 < now]
    closes = [float(row[4]) for row in closed]
    bid, ask = float(book["bidPrice"]), float(book["askPrice"])
    stamp = float(closed[-1][6]) / 1000
    if len(closes) < 20 or now - stamp > 180:
        raise ValueError("Market candles are missing or stale")
    if not all(math.isfinite(x) and x > 0 for x in closes + [bid, ask]) or ask < bid:
        raise ValueError("Invalid market prices")
    return closes, bid, ask, stamp

def decide(position, closes, bid, ask, now):
    fast = sum(closes[-5:]) / 5
    slow = sum(closes[-20:]) / 20
    if position:
        change = bid / position["entry"] - 1
        age = now.timestamp() - position["opened_at"]
        if change <= -0.004:
            return "SELL", "stop_loss"
        if change >= 0.006:
            return "SELL", "take_profit"
        opened = dt.datetime.fromtimestamp(position["opened_at"], dt.timezone.utc)
        if age >= 3600 or opened.date() != now.date() or (now.hour == 23 and now.minute >= 55):
            return "SELL", "intraday_time_exit"
        if fast < slow:
            return "SELL", "moving_average_exit"
    elif now.hour != 23 or now.minute < 55:
        if fast > slow * 1.003 and closes[-1] > fast and (ask - bid) / ask < 0.001:
            return "BUY", "moving_average_entry"
    return "WAIT", "waiting_for_signal"

def run(state_dir, report_path):
    state_dir.mkdir(parents=True, exist_ok=True)
    with (state_dir / "worker.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        db = sqlite3.connect(state_dir / "paper.sqlite")
        db.row_factory = sqlite3.Row
        db.executescript("""
          CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1), cash REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS position(id INTEGER PRIMARY KEY CHECK(id=1), entry REAL, qty REAL, opened_at REAL);
          CREATE TABLE IF NOT EXISTS fills(id INTEGER PRIMARY KEY, at TEXT, side TEXT, price REAL, qty REAL, fee REAL, reason TEXT);
        """)
        db.execute("INSERT OR IGNORE INTO account VALUES(1,?)", (INITIAL_CASH,))
        db.commit()
        now = dt.datetime.now(dt.timezone.utc)
        report = {"mode": "PAPER", "liveExecution": False, "symbol": SYMBOL,
                  "checkedAt": now.isoformat(), "initialCash": INITIAL_CASH,
                  "feeRate": FEE, "slippageRate": SLIPPAGE,
                  "strategy": "SMA 5/20, threshold 0.3%, stop 0.4%, target 0.6%, maximum 60 min",
                  "currency": "USDT fictifs"}
        try:
            closes, bid, ask, stamp = market()
            with db:
                position_row = db.execute("SELECT * FROM position WHERE id=1").fetchone()
                position = dict(position_row) if position_row else None
                cash = db.execute("SELECT cash FROM account WHERE id=1").fetchone()[0]
                action, reason = decide(position, closes, bid, ask, now)
                if action == "BUY" and cash >= ORDER_SIZE:
                    price = ask * (1 + SLIPPAGE)
                    qty = ORDER_SIZE / (price * (1 + FEE))
                    fee = price * qty * FEE
                    cash -= ORDER_SIZE
                    db.execute("INSERT INTO position VALUES(1,?,?,?)", (price, qty, now.timestamp()))
                elif action == "SELL" and position:
                    price, qty = bid * (1 - SLIPPAGE), position["qty"]
                    fee = price * qty * FEE
                    cash += price * qty - fee
                    db.execute("DELETE FROM position WHERE id=1")
                else:
                    action = "WAIT"
                if action != "WAIT":
                    db.execute("UPDATE account SET cash=? WHERE id=1", (cash,))
                    db.execute("INSERT INTO fills(at,side,price,qty,fee,reason) VALUES(?,?,?,?,?,?)",
                               (now.isoformat(), action, price, qty, fee, reason))
                row = db.execute("SELECT * FROM position WHERE id=1").fetchone()
                position = dict(row) if row else None
                equity = cash + (position["qty"] * bid * (1 - SLIPPAGE) * (1 - FEE) if position else 0)
                report.update(status="ok", source="MEXC public", marketAt=dt.datetime.fromtimestamp(stamp, dt.timezone.utc).isoformat(),
                              bid=bid, ask=ask, cash=cash, equity=equity, pnl=equity-INITIAL_CASH,
                              position=position, decision=action, reason=reason)
        except Exception as error:
            report.update(status="degraded", decision="WAIT", error=type(error).__name__,
                          cash=db.execute("SELECT cash FROM account WHERE id=1").fetchone()[0])
        report["fills"] = [dict(row) for row in db.execute("SELECT at,side,price,qty,fee,reason FROM fills ORDER BY id DESC LIMIT 30")]
        db.close()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp = tempfile.mkstemp(dir=report_path.parent)
        with os.fdopen(fd, "w") as output:
            json.dump(report, output, allow_nan=False)
        os.chmod(temp, 0o644)
        os.replace(temp, report_path)
        print(json.dumps({"status": report["status"], "decision": report["decision"], "mode": report["mode"]}))
        return report["status"] == "ok"

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    raise SystemExit(0 if run(args.state_dir, args.report) else 1)
