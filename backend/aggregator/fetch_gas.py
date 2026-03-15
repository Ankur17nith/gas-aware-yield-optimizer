"""
fetch_gas.py
────────────
Fetches real-time Ethereum gas prices.
Primary: Etherscan Gas Oracle API.
Fallback: Direct RPC eth_gasPrice call.
"""

import time
import logging
from datetime import datetime
import httpx
from config import settings

_cache: dict = {"data": None, "ts": 0}
logger = logging.getLogger(__name__)

DEFAULT_SAFE_GWEI = 15.0
DEFAULT_STANDARD_GWEI = 20.0
DEFAULT_FAST_GWEI = 28.0
SNAPSHOT_INTERVAL_SECONDS = 300
HISTORY_RETENTION_SECONDS = 24 * 60 * 60

_gas_history: list[dict] = []


async def get_gas_price() -> dict:
    """Return current gas prices in gwei with safe/standard/fast tiers."""
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < settings.CACHE_TTL_SECONDS:
        return _cache["data"]

    gas_data = await _fetch_from_etherscan()
    if not gas_data:
        logger.warning("Etherscan gas fetch failed; falling back to RPC")
        gas_data = await _fetch_from_rpc()
    if not gas_data:
        logger.warning("RPC gas fetch also failed; using default safe fallback gas values")
        gas_data = _default_gas_fallback()

    _record_gas_snapshot(float(gas_data.get("standard", DEFAULT_STANDARD_GWEI) or DEFAULT_STANDARD_GWEI))

    _cache["data"] = gas_data
    _cache["ts"] = now
    return gas_data


def _record_gas_snapshot(gas_price_gwei: float) -> None:
    now = int(time.time())
    if _gas_history and (now - int(_gas_history[-1]["timestamp"])) < SNAPSHOT_INTERVAL_SECONDS:
        return

    _gas_history.append(
        {
            "timestamp": now,
            "gas_price": float(gas_price_gwei),
        }
    )
    _prune_history(now)


def _prune_history(now_ts: int | None = None) -> None:
    now = now_ts or int(time.time())
    min_ts = now - HISTORY_RETENTION_SECONDS
    while _gas_history and int(_gas_history[0]["timestamp"]) < min_ts:
        _gas_history.pop(0)


def get_gas_history(hours: int = 24) -> list[dict]:
    """Return gas snapshots for the last N hours."""
    now = int(time.time())
    _prune_history(now)
    min_ts = now - max(1, int(hours)) * 3600
    return [entry for entry in _gas_history if int(entry["timestamp"]) >= min_ts]


def get_gas_history_summary(hours: int = 24) -> dict:
    """Return daily and hourly gas averages from in-memory snapshot history."""
    history = get_gas_history(hours=hours)
    if not history:
        return {
            "daily_average": DEFAULT_STANDARD_GWEI,
            "hourly_averages": [],
            "samples": [],
            "sample_count": 0,
        }

    daily_average = sum(float(x["gas_price"]) for x in history) / len(history)

    buckets: dict[int, list[float]] = {}
    for entry in history:
        hour = datetime.utcfromtimestamp(int(entry["timestamp"])) .hour
        buckets.setdefault(hour, []).append(float(entry["gas_price"]))

    hourly_averages = [
        {
            "hour": hour,
            "average_gas": round(sum(values) / len(values), 2),
            "count": len(values),
        }
        for hour, values in sorted(buckets.items(), key=lambda item: item[0])
    ]

    return {
        "daily_average": round(daily_average, 2),
        "hourly_averages": hourly_averages,
        "samples": history,
        "sample_count": len(history),
    }


async def _fetch_from_etherscan() -> dict | None:
    """Fetch gas from Etherscan Gas Oracle."""
    if not settings.ETHERSCAN_API_KEY:
        logger.warning("ETHERSCAN_API_KEY missing; skipping Etherscan gas fetch")
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
            logger.warning("Etherscan returned non-success gas response: %s", data)
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
    except Exception as exc:
        logger.exception("Etherscan gas fetch exception: %s", exc)
        return None


async def _fetch_from_rpc() -> dict | None:
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
    except Exception as exc:
        logger.exception("RPC gas fetch exception: %s", exc)
        return None


def _default_gas_fallback() -> dict:
    return {
        "safe": DEFAULT_SAFE_GWEI,
        "standard": DEFAULT_STANDARD_GWEI,
        "fast": DEFAULT_FAST_GWEI,
        "base_fee": DEFAULT_STANDARD_GWEI,
        "unit": "gwei",
        "source": "default_fallback",
    }
