"""Fetch real-time chain-aware gas prices with 24h per-chain history."""

import time
import logging
from datetime import datetime
import httpx
from config import settings

logger = logging.getLogger(__name__)

DEFAULT_SAFE_GWEI = 15.0
DEFAULT_STANDARD_GWEI = 20.0
DEFAULT_FAST_GWEI = 28.0
SNAPSHOT_INTERVAL_SECONDS = 300
HISTORY_RETENTION_SECONDS = 24 * 60 * 60

SUPPORTED_CHAINS = {"ethereum", "arbitrum", "polygon", "base"}
ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc"
BASE_RPC_URL = "https://mainnet.base.org"
POLYGON_RPC_URL = "https://polygon-rpc.com"
POLYGON_GAS_STATION_URL = "https://gasstation.polygon.technology/v2"

_chain_cache: dict[str, dict] = {}
_chain_history: dict[str, list[dict]] = {chain: [] for chain in SUPPORTED_CHAINS}


def normalize_chain(chain: str | None) -> str:
    value = (chain or "ethereum").strip().lower()
    aliases = {
        "eth": "ethereum",
        "mainnet": "ethereum",
        "arb": "arbitrum",
        "matic": "polygon",
    }
    value = aliases.get(value, value)
    return value if value in SUPPORTED_CHAINS else "ethereum"


def get_supported_chains() -> list[str]:
    return sorted(SUPPORTED_CHAINS)


async def get_gas_price(chain: str | None = None) -> dict:
    """Return current gas prices in gwei for a specific chain."""
    chain_key = normalize_chain(chain)
    now = time.time()
    cached = _chain_cache.get(chain_key)
    if cached and (now - float(cached.get("ts", 0) or 0)) < settings.CACHE_TTL_SECONDS:
        return cached["data"]

    gas_data = await _fetch_for_chain(chain_key)
    if not gas_data:
        logger.warning("Gas fetch failed for %s; using fallback gas values", chain_key)
        gas_data = _default_gas_fallback(chain_key)

    _record_gas_snapshot(
        chain=chain_key,
        gas_price_gwei=float(gas_data.get("standard", DEFAULT_STANDARD_GWEI) or DEFAULT_STANDARD_GWEI),
    )

    _chain_cache[chain_key] = {"data": gas_data, "ts": now}
    return gas_data


async def _fetch_for_chain(chain: str) -> dict | None:
    if chain == "ethereum":
        gas_data = await _fetch_from_etherscan()
        if gas_data:
            return gas_data
        logger.warning("Etherscan fetch failed; falling back to Ethereum RPC")
        return await _fetch_from_rpc(settings.RPC_URL, chain="ethereum")

    if chain == "polygon":
        gas_data = await _fetch_from_polygon_gas_station()
        if gas_data:
            return gas_data
        logger.warning("Polygon gas station fetch failed; falling back to Polygon RPC")
        return await _fetch_from_rpc(POLYGON_RPC_URL, chain="polygon")

    if chain == "arbitrum":
        return await _fetch_from_rpc(ARBITRUM_RPC_URL, chain="arbitrum")

    if chain == "base":
        return await _fetch_from_rpc(BASE_RPC_URL, chain="base")

    return None


def _record_gas_snapshot(chain: str, gas_price_gwei: float) -> None:
    now = int(time.time())
    history = _chain_history.setdefault(chain, [])
    if history and (now - int(history[-1]["timestamp"])) < SNAPSHOT_INTERVAL_SECONDS:
        return

    history.append(
        {
            "chain": chain,
            "timestamp": now,
            "gas_price": float(gas_price_gwei),
        }
    )
    _prune_history(chain=chain, now_ts=now)


def _prune_history(chain: str, now_ts: int | None = None) -> None:
    now = now_ts or int(time.time())
    min_ts = now - HISTORY_RETENTION_SECONDS
    history = _chain_history.setdefault(chain, [])
    while history and int(history[0]["timestamp"]) < min_ts:
        history.pop(0)


def get_gas_history(chain: str | None = None, hours: int = 24) -> list[dict]:
    """Return gas snapshots for the last N hours."""
    chain_key = normalize_chain(chain)
    now = int(time.time())
    _prune_history(chain=chain_key, now_ts=now)
    min_ts = now - max(1, int(hours)) * 3600
    history = _chain_history.setdefault(chain_key, [])
    return [entry for entry in history if int(entry["timestamp"]) >= min_ts]


def get_gas_history_summary(chain: str | None = None, hours: int = 24) -> dict:
    """Return daily and hourly gas averages from in-memory snapshot history."""
    chain_key = normalize_chain(chain)
    history = get_gas_history(chain=chain_key, hours=hours)
    if not history:
        return {
            "chain": chain_key,
            "daily_average": DEFAULT_STANDARD_GWEI,
            "hourly_averages": [],
            "samples": [],
            "sample_count": 0,
        }

    daily_average = sum(float(x["gas_price"]) for x in history) / len(history)

    buckets: dict[int, list[float]] = {}
    for entry in history:
        hour = datetime.utcfromtimestamp(int(entry["timestamp"])).hour
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
        "chain": chain_key,
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
            "chain": "ethereum",
        }
    except Exception as exc:
        logger.exception("Etherscan gas fetch exception: %s", exc)
        return None


async def _fetch_from_rpc(rpc_url: str, chain: str) -> dict | None:
    """Fetch gas price via JSON-RPC for chain that supports eth_gasPrice."""
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_gasPrice",
        "params": [],
        "id": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(rpc_url, json=payload)
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
            "chain": chain,
        }
    except Exception as exc:
        logger.exception("RPC gas fetch exception: %s", exc)
        return None


async def _fetch_from_polygon_gas_station() -> dict | None:
    """Fetch Polygon gas from official gas station endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(POLYGON_GAS_STATION_URL)
            resp.raise_for_status()
            data = resp.json()

        standard = float((data.get("standard") or {}).get("maxFee", 0) or 0)
        safe = float((data.get("safeLow") or {}).get("maxFee", 0) or 0)
        fast = float((data.get("fast") or {}).get("maxFee", 0) or 0)
        if standard <= 0:
            return None

        return {
            "safe": safe or round(standard * 0.9, 2),
            "standard": standard,
            "fast": fast or round(standard * 1.15, 2),
            "base_fee": float((data.get("estimatedBaseFee") or 0) or standard),
            "unit": "gwei",
            "source": "polygon_gas_station",
            "chain": "polygon",
        }
    except Exception as exc:
        logger.exception("Polygon gas station fetch exception: %s", exc)
        return None


def _default_gas_fallback(chain: str) -> dict:
    return {
        "safe": DEFAULT_SAFE_GWEI,
        "standard": DEFAULT_STANDARD_GWEI,
        "fast": DEFAULT_FAST_GWEI,
        "base_fee": DEFAULT_STANDARD_GWEI,
        "unit": "gwei",
        "source": "default_fallback",
        "chain": chain,
    }
