#!/usr/bin/env python3
import json, time
from pathlib import Path
import requests

ROOT = Path("/opt/vlad/projects/ANBAYBOT")
REGISTRY = ROOT / "config/wallet-registry.public.json"
OUT = ROOT / "logs/wallet_audit_latest.json"

def rpc(url, method, params):
    r = requests.post(url, json={"jsonrpc":"2.0","id":1,"method":method,"params":params}, timeout=20)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data.get("result")

def evm_native(address, rpc_url, symbol):
    value = rpc(rpc_url, "eth_getBalance", [address, "latest"])
    return {"native_symbol": symbol, "native_balance": int(value, 16) / 1e18}

def solana(address):
    url = "https://api.mainnet-beta.solana.com"
    bal = rpc(url, "getBalance", [address, {"commitment":"confirmed"}])
    toks = rpc(url, "getTokenAccountsByOwner", [address, {"programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}, {"encoding":"jsonParsed"}])
    nonzero = []
    for row in toks.get("value", []):
        info = row["account"]["data"]["parsed"]["info"]
        amount = info["tokenAmount"].get("uiAmount") or 0
        if amount:
            nonzero.append({"mint":info["mint"],"amount":amount})
    return {"native_symbol":"SOL","native_balance":bal["value"]/1e9,"tokens":nonzero}

def bitcoin(address):
    r = requests.get(f"https://mempool.space/api/address/{address}", timeout=20)
    r.raise_for_status()
    d = r.json()
    funded = d["chain_stats"]["funded_txo_sum"]
    spent = d["chain_stats"]["spent_txo_sum"]
    return {"native_symbol":"BTC","native_balance":(funded-spent)/1e8}

def tron(address):
    r = requests.get(f"https://api.trongrid.io/v1/accounts/{address}", timeout=20)
    r.raise_for_status()
    d = r.json()
    row = (d.get("data") or [{}])[0]
    return {"native_symbol":"TRX","native_balance":row.get("balance",0)/1e6}

def audit_one(item):
    chain = item["chain"].upper()
    address = item["address"]
    if chain == "SOLANA":
        return solana(address)
    if chain == "BITCOIN":
        return bitcoin(address)
    if chain == "TRON":
        return tron(address)
    if chain in ("ETHEREUM","EVM"):
        return evm_native(address, "https://ethereum-rpc.publicnode.com", "ETH")
    if chain == "POLYGON":
        return evm_native(address, "https://polygon-bor-rpc.publicnode.com", "POL")
    if chain == "BASE":
        return evm_native(address, "https://base-rpc.publicnode.com", "ETH")
    return {"error":"unsupported_chain"}

def main():
    reg = json.loads(REGISTRY.read_text())
    rows = []
    for status in ("confirmed","candidates"):
        for item in reg.get(status, []):
            row = {**item, "status": status, "checked_at": int(time.time())}
            try:
                row.update(audit_one(item))
            except Exception as e:
                row["error"] = f"{type(e).__name__}: {e}"
            rows.append(row)
    result = {
        "generated_at": int(time.time()),
        "wallets": rows,
        "blocked": reg.get("blocked", [])
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
