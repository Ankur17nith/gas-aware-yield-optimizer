"""
fetch_gas.py
────────────
Fetches real-time Ethereum gas prices.
Primary: Etherscan Gas Oracle API.
Fallback: Direct RPC eth_gasPrice call.
"""

import time
import httpx
from config import settings

_cache: dict = {"data": None, "ts": 0}


async def get_gas_price() -> dict:
    """Return current gas prices in gwei with safe/standard/fast tiers."""
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < settings.CACHE_TTL_SECONDS:
        return _cache["data"]

    gas_data = await _fetch_from_etherscan()
    if not gas_data:
        gas_data = await _fetch_from_rpc()

    _cache["data"] = gas_data
    _cache["ts"] = now
    return gas_data


async def _fetch_from_etherscan() -> dict | None:
    """Fetch gas from Etherscan Gas Oracle."""
    if not settings.ETHERSCAN_API_KEY:
        return None

    params = {
        "module": "gastracker",
        "action": "gasoracle",
        "apikey": settings.ETHERSCAN_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(settings.ETHERSCAN_GAS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "1":
            return None

        result = data["result"]
        return {
            "safe": float(result.get("SafeGasPrice", 0)),
            "standard": float(result.get("ProposeGasPrice", 0)),
            "fast": float(result.get("FastGasPrice", 0)),
            "base_fee": float(result.get("suggestBaseFee", 0)),
            "unit": "gwei",
            "source": "etherscan",
        }
    except Exception:
        return None


async def _fetch_from_rpc() -> dict:
    """Fallback: fetch gas price via JSON-RPC."""
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_gasPrice",
        "params": [],
        "id": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(settings.RPC_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()

        gas_wei = int(data["result"], 16)
        gas_gwei = round(gas_wei / 1e9, 2)
        return {
            "safe": round(gas_gwei * 0.85, 2),
            "standard": gas_gwei,
            "fast": round(gas_gwei * 1.2, 2),
            "base_fee": gas_gwei,
            "unit": "gwei",
            "source": "rpc",
        }
    except Exception:
        return {
            "safe": 15,
            "standard": 20,
            "fast": 30,
            "base_fee": 18,
            "unit": "gwei",
            "source": "fallback",
        }
