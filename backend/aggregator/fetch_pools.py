"""
fetch_pools.py
──────────────
Fetches live stablecoin pool data from DefiLlama Yields API.
Filters for USDC, DAI, USDT pools on major protocols.
Implements TTL caching to avoid rate limits.
"""

import time
import httpx
from config import settings

_cache: dict = {"data": None, "ts": 0}

TARGET_PROTOCOLS = {
    "aave-v3",
    "compound-v3",
    "curve-dex",
    "yearn-finance",
    "spark",
    "morpho-aavev3",
}
TARGET_SYMBOLS = {"USDC", "DAI", "USDT"}

# Chains we support — maps DefiLlama chain names (lowercase) to display names
SUPPORTED_CHAINS = {
    "ethereum": "Ethereum",
    "arbitrum": "Arbitrum",
    "polygon": "Polygon",
    "base": "Base",
}


async def fetch_all_pools(chain: str | None = None) -> list[dict]:
    """Fetch and normalize pool data from DefiLlama.

    Args:
        chain: Optional chain filter (e.g. 'ethereum', 'arbitrum').
               If None, returns pools from all supported chains.
    """
    now = time.time()
    # Use chain-specific cache keys so switching chains doesn't serve stale data
    cache_key = chain or "all"
    if _cache.get(cache_key) and (now - _cache.get(f"{cache_key}_ts", 0)) < settings.CACHE_TTL_SECONDS:
        return _cache[cache_key]

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(settings.DEFILLAMA_YIELDS_URL)
        resp.raise_for_status()
        raw = resp.json()

    pools: list[dict] = []
    for p in raw.get("data", []):
        project = (p.get("project") or "").lower()
        symbol = (p.get("symbol") or "").upper()
        pool_chain = (p.get("chain") or "").lower()

        # Only include supported chains
        if pool_chain not in SUPPORTED_CHAINS:
            continue

        # If caller specified a chain, filter to just that chain
        if chain and pool_chain != chain.lower():
            continue

        matched_protocol = None
        for tp in TARGET_PROTOCOLS:
            if tp in project:
                matched_protocol = tp
                break
        if not matched_protocol:
            continue

        # Check if symbol contains any target stablecoin
        matched_token = None
        for ts in TARGET_SYMBOLS:
            if ts in symbol:
                matched_token = ts
                break
        if not matched_token:
            continue

        apy = p.get("apy")
        tvl = p.get("tvlUsd")
        if apy is None or tvl is None:
            continue

        pools.append(
            {
                "pool_id": p.get("pool", ""),
                "protocol": _normalize_protocol(matched_protocol),
                "token": matched_token,
                "symbol": symbol,
                "apy": round(float(apy), 4),
                "tvl": round(float(tvl), 2),
                "chain": SUPPORTED_CHAINS[pool_chain],
                "pool_meta": p.get("poolMeta", ""),
            }
        )

    # Sort by APY descending
    pools.sort(key=lambda x: x["apy"], reverse=True)

    _cache[cache_key] = pools
    _cache[f"{cache_key}_ts"] = now
    return pools


def _normalize_protocol(raw: str) -> str:
    mapping = {
        "aave-v3": "Aave V3",
        "compound-v3": "Compound V3",
        "curve-dex": "Curve",
        "yearn-finance": "Yearn",
        "spark": "Spark",
        "morpho-aavev3": "Morpho Aave",
    }
    return mapping.get(raw, raw.title())
