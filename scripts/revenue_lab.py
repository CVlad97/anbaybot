#!/usr/bin/env python3
"""ANBAYBOT revenue laboratory: deterministic PAPER/scenario calculations only."""
from __future__ import annotations
from dataclasses import dataclass, asdict
from math import pow
from typing import Optional

@dataclass(frozen=True)
class Scenario:
    strategy: str
    capital: float
    horizon_days: float
    gross_pnl: float
    costs: Optional[float]
    net_pnl: Optional[float]
    roi_pct: Optional[float]
    evidence: str
    note: str = ""


def _result(strategy: str, capital: float, days: float, gross: float, costs: Optional[float], evidence: str, note: str = "") -> Scenario:
    net = None if costs is None else gross - costs
    roi = None if net is None else ((net / capital * 100.0) if capital else 0.0)
    return Scenario(strategy, capital, days, gross, costs, net, roi, evidence, note)

def earn_scenario(capital: float, apy_pct: float, days: float, fees: float = 0.0, evidence: str = "UNVERIFIED") -> Scenario:
    gross = capital * (pow(1.0 + apy_pct / 100.0, days / 365.0) - 1.0)
    return _result("EARN", capital, days, gross, fees, evidence, "APY projection; provider default/depeg/lock risk excluded.")


def funding_capture_scenario(capital: float, funding_rates: list[float], fees: Optional[float] = None, borrow_cost: Optional[float] = None, slippage: Optional[float] = None, evidence: str = "HISTORICAL_VERIFIED") -> Scenario:
    gross = capital * sum(funding_rates)
    days = len(funding_rates) / 3.0
    parts = (fees, borrow_cost, slippage)
    costs = None if any(x is None for x in parts) else sum(float(x) for x in parts)
    return _result("FUNDING_CAPTURE", capital, days, gross, costs, evidence, "Gross funding verified; net remains unknown until fees, borrow cost and slippage are supplied.")


def farming_scenario(capital: float, apr_pct: float, days: float, fees: float = 0.0, impermanent_loss_pct: float = 0.0, token_decay_pct: float = 0.0, evidence: str = "UNVERIFIED") -> Scenario:
    rewards = capital * (apr_pct / 100.0) * (days / 365.0)
    drag = capital * ((impermanent_loss_pct + token_decay_pct) / 100.0)
    return _result("FARMING", capital, days, rewards, fees + drag, evidence, "APR alone is insufficient: IL, token price, gas and protocol risk matter.")


def prediction_scenario(stake: float, market_price: float, estimated_probability: float, fee_pct: float = 0.0, evidence: str = "UNVERIFIED") -> Scenario:
    if not (0.0 < market_price < 1.0 and 0.0 <= estimated_probability <= 1.0):
        raise ValueError("market_price must be in (0,1) and probability in [0,1]")
    shares = stake / market_price
    expected_payout = shares * estimated_probability
    fees = stake * fee_pct / 100.0
    return _result("PREDICTION", stake, 0.0, expected_payout - stake, fees, evidence, "Expected value only; not a realized profit.")

def capped_kelly_fraction(market_price: float, estimated_probability: float, cap: float = 0.05) -> float:
    if estimated_probability <= market_price:
        return 0.0
    b = (1.0 - market_price) / market_price
    q = 1.0 - estimated_probability
    raw = (b * estimated_probability - q) / b
    return max(0.0, min(cap, raw))


def futures_scenario(margin: float, entry: float, exit_price: float, leverage: float = 1.0, side: str = "LONG", fee_bps_round_trip: float = 0.0, funding_cost: float = 0.0, evidence: str = "PAPER") -> Scenario:
    if margin <= 0 or entry <= 0 or exit_price <= 0 or leverage <= 0:
        raise ValueError("positive margin/prices/leverage required")
    notional = margin * leverage
    raw_return = (exit_price - entry) / entry
    if side.upper() == "SHORT":
        raw_return = -raw_return
    gross = notional * raw_return
    fees = notional * fee_bps_round_trip / 10000.0 + funding_cost
    return _result("FUTURES_DIRECTIONAL", margin, 0.0, gross, fees, evidence, "Directional leverage magnifies both gains and losses; liquidation risk is not modeled.")


def required_daily_return(capital: float, target_profit: float, days: float) -> float:
    if capital <= 0 or target_profit < 0 or days <= 0:
        raise ValueError("capital>0, target>=0, days>0 required")
    return (pow((capital + target_profit) / capital, 1.0 / days) - 1.0) * 100.0

def self_test() -> None:
    e = earn_scenario(1000, 10, 365, 0, "HYPOTHETICAL")
    assert abs(e.gross_pnl - 100.0) < 1e-9
    p = prediction_scenario(60, 0.60, 0.70, 0, "HYPOTHETICAL")
    assert p.net_pnl > 0
    assert capped_kelly_fraction(0.60, 0.70) == 0.05
    f = futures_scenario(100, 100, 102, leverage=2, side="LONG")
    assert abs(f.gross_pnl - 4.0) < 1e-9
    assert required_daily_return(1000, 1000, 7) > 10


def demo() -> list[dict]:
    btc_rates = [
        0.00004542,0.00008180,0.00009029,0.00004876,0.00009012,0.00004815,0.00003562,0.00007869,0.00007199,0.00003006,
        0.00006122,0.00003593,0.00006093,0.00004334,0.00005169,0.00004788,0.00005390,0.00006450,0.00007157,0.00008037,
        0.00004220,0.00003563,0.00006188,0.00009812,0.00003951,0.00002788,0.00005258,0.00009351,0.00003310,0.00008505,
    ]
    scenarios = [
        funding_capture_scenario(1000, btc_rates, evidence="HISTORICAL_VERIFIED"),
        prediction_scenario(100, 0.60, 0.70, 0, "HYPOTHETICAL"),
        farming_scenario(1000, 20, 30, impermanent_loss_pct=2, evidence="HYPOTHETICAL"),
    ]
    return [asdict(x) for x in scenarios]

if __name__ == "__main__":
    import json
    self_test()
    print(json.dumps(demo(), indent=2, ensure_ascii=False))
