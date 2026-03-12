"""
historical_data.py
──────────────────
Fetches historical APY data from DefiLlama for yield prediction
and chart rendering. Provides 30-day historical rates per pool.
"""

import time
import httpx
from config import settings

_cache: dict = {"data": None, "ts": 0}

# Longer cache for historical data (5 minutes)
HISTORICAL_CACHE_TTL = 300


async def get_historical_rates() -> list[dict]:
    """Fetch 30-day historical APY for major stablecoin pools."""
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < HISTORICAL_CACHE_TTL:
        return _cache["data"]

    # First get pool list to find IDs
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(settings.DEFILLAMA_YIELDS_URL)
        resp.raise_for_status()
        raw = resp.json()

    # Find top stablecoin pools on Ethereum
    target_protocols = {"aave-v3", "compound-v3", "curve-dex", "yearn-finance"}
    target_symbols = {"USDC", "DAI", "USDT"}
    pool_ids: list[dict] = []

    for p in raw.get("data", []):
        project = (p.get("project") or "").lower()
        symbol = (p.get("symbol") or "").upper()
        chain = (p.get("chain") or "").lower()

        if chain != "ethereum":
            continue

        matched_proto = None
        for tp in target_protocols:
            if tp in project:
                matched_proto = tp
                break
        if not matched_proto:
            continue

        matched_token = None
        for ts in target_symbols:
            if ts in symbol:
                matched_token = ts
                break
        if not matched_token:
            continue

        pool_ids.append(
            {
                "pool_id": p.get("pool", ""),
                "protocol": matched_proto,
                "token": matched_token,
            }
        )

        if len(pool_ids) >= 12:
            break

    # Fetch historical chart data for each pool
    historical: list[dict] = []
    async with httpx.AsyncClient(timeout=15) as client:
        for pool_info in pool_ids[:8]:
            try:
                url = f"https://yields.llama.fi/chart/{pool_info['pool_id']}"
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                chart_data = resp.json()
                data_points = chart_data.get("data", [])

                # Take last 30 data points
                recent = data_points[-30:] if len(data_points) >= 30 else data_points

                historical.append(
                    {
                        "pool_id": pool_info["pool_id"],
                        "protocol": pool_info["protocol"],
                        "token": pool_info["token"],
                        "history": [
                            {
                                "timestamp": dp.get("timestamp", ""),
                                "apy": round(float(dp.get("apy", 0)), 4),
                                "tvl": round(float(dp.get("tvlUsd", 0)), 2),
                            }
                            for dp in recent
                        ],
                    }
                )
            except Exception:
                continue

    _cache["data"] = historical
    _cache["ts"] = now
    return historical
