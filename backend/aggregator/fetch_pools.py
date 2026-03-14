"""Fetch and normalize live stablecoin pools from DefiLlama."""

import time
import logging
import re
import httpx
from typing import TypedDict
from config import settings

_cache: dict = {"data": None, "ts": 0}
logger = logging.getLogger(__name__)

TARGET_PROTOCOLS = {
    "aave",
    "compound",
    "curve",
    "yearn",
    "spark",
}
TARGET_SYMBOLS = {"USDC", "USDT", "DAI", "FRAX"}
POOL_CACHE_TTL_SECONDS = 300
TOP_POOL_LIMIT = 100

CHAIN_GAS_APY_DRAG = {
    "Ethereum": 0.25,
    "Arbitrum": 0.05,
    "Polygon": 0.03,
    "Base": 0.04,
}

# Chains we support — maps DefiLlama chain names (lowercase) to display names
SUPPORTED_CHAINS = {
    "ethereum": "Ethereum",
    "arbitrum": "Arbitrum",
    "polygon": "Polygon",
    "base": "Base",
}

# APY sanity rules to avoid showing unrealistic values from upstream spikes.
MAX_REASONABLE_APY = 200.0
DROP_OUTLIER_APY = 1000.0


class PoolData(TypedDict):
    pool_id: str
    protocol: str
    pool_name: str
    chain: str
    token: str
    tvl: float
    gross_apy: float
    reward_apy: float
    net_apy: float
    pool_address: str
    apy: float
    symbol: str
    pool_meta: str | None
    raw_apy: float
    apy_capped: bool
    suspicious: bool
    validation_note: str
    source: str


async def fetch_all_pools(chain: str | None = None) -> list[PoolData]:
    """Fetch and normalize pool data from DefiLlama.

    Returns normalized PoolData objects with:
    pool_id, protocol, chain, token, tvl, gross_apy, reward_apy, net_apy, pool_address
    """
    now = time.time()
    cache_key = chain or "all"
    if _cache.get(cache_key) and (now - _cache.get(f"{cache_key}_ts", 0)) < POOL_CACHE_TTL_SECONDS:
        return _cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(settings.DEFILLAMA_YIELDS_URL)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        if _cache.get(cache_key):
            logger.warning("DefiLlama pool fetch failed; serving stale cache: %s", exc)
            return _cache[cache_key]
        raise

    pools: list[PoolData] = []
    for p in raw.get("data", []):
        project = (p.get("project") or "").lower().strip()
        symbol = (p.get("symbol") or "").upper()
        pool_chain = (p.get("chain") or "").lower()

        # Only include supported chains
        if pool_chain not in SUPPORTED_CHAINS:
            continue

        # If caller specified a chain, filter to just that chain
        if chain and pool_chain != chain.lower():
            continue

        if not any(tp in project for tp in TARGET_PROTOCOLS):
            continue

        symbol_parts = {
            s.strip().upper()
            for s in symbol.replace("-", " ").replace("/", " ").split()
            if s.strip()
        }
        matched_tokens = symbol_parts.intersection(TARGET_SYMBOLS)
        if not matched_tokens:
            continue
        matched_token = sorted(matched_tokens)[0]

        apy = p.get("apy")
        tvl = p.get("tvlUsd")
        if apy is None or tvl is None:
            continue

        raw_apy = float(apy)
        if raw_apy > DROP_OUTLIER_APY:
            # Treat extreme values as likely transient data glitches.
            continue
        apy_capped = raw_apy > MAX_REASONABLE_APY
        gross_apy = min(raw_apy, MAX_REASONABLE_APY)
        reward_apy = float(p.get("apyReward") or 0)
        chain_name = SUPPORTED_CHAINS[pool_chain]
        gas_cost_estimate = CHAIN_GAS_APY_DRAG.get(chain_name, 0.08)
        net_apy = round(max(gross_apy - gas_cost_estimate, 0), 4)

        pool_id = p.get("pool", "")
        pool_name = _derive_pool_name(p, project, matched_token)
        pool_address = ""
        if isinstance(pool_id, str) and pool_id.startswith("0x"):
            pool_address = pool_id
        elif isinstance(pool_id, str) and ":" in pool_id:
            candidate = pool_id.split(":")[-1]
            if candidate.startswith("0x"):
                pool_address = candidate

        pools.append(
            {
                "pool_id": pool_id,
                "protocol": _normalize_protocol(project),
                "pool_name": pool_name,
                "token": matched_token,
                "symbol": symbol,
                "gross_apy": round(gross_apy, 4),
                "reward_apy": round(reward_apy, 4),
                "net_apy": net_apy,
                "apy": net_apy,
                "tvl": round(float(tvl), 2),
                "chain": chain_name,
                "pool_meta": p.get("poolMeta", ""),
                "pool_address": pool_address,
                "raw_apy": round(raw_apy, 4),
                "apy_capped": apy_capped,
                "suspicious": apy_capped,
                "validation_note": "APY capped at 200%" if apy_capped else "",
                "source": "DefiLlama",
            }
        )

    # Keep the largest pools for reliability and frontend performance.
    pools.sort(key=lambda x: x["tvl"], reverse=True)
    pools = pools[:TOP_POOL_LIMIT]

    _cache[cache_key] = pools
    _cache[f"{cache_key}_ts"] = now
    return pools


def _normalize_protocol(raw: str) -> str:
    lower = raw.lower()
    if "aave" in lower:
        return "Aave"
    if "compound" in lower:
        return "Compound"
    if "curve" in lower:
        return "Curve"
    if "yearn" in lower:
        return "Yearn"
    if "spark" in lower:
        return "Spark"
    return raw.title()


def _derive_pool_name(raw_pool: dict, project: str, matched_token: str) -> str:
    clean_project = _normalize_protocol(project)

    symbol = str(raw_pool.get("symbol") or "").strip()
    clean_symbol = _clean_symbol_label(symbol)
    if clean_symbol:
        return clean_symbol

    pool_meta = str(raw_pool.get("poolMeta") or "").strip()
    clean_meta = _clean_pool_meta(pool_meta, clean_project)
    if clean_meta:
        return clean_meta

    return matched_token


def _clean_symbol_label(symbol: str) -> str:
    s = (symbol or "").strip().upper()
    if not s:
        return ""
    s = re.sub(r"[^A-Z0-9/\-\s]", "", s)
    s = s.replace("/", "-")
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def _clean_pool_meta(pool_meta: str, protocol: str) -> str:
    meta = (pool_meta or "").strip()
    if not meta:
        return ""

    # Remove repeated protocol prefix (e.g. "Curve Curve USDC-...").
    meta = re.sub(rf"^\s*{re.escape(protocol)}\s+", "", meta, flags=re.IGNORECASE)
    meta = re.sub(rf"^\s*{re.escape(protocol)}\s+", "", meta, flags=re.IGNORECASE)
    meta = re.sub(r"\b(pool|vault|lending)\b", "", meta, flags=re.IGNORECASE)
    meta = re.sub(r"[^A-Za-z0-9/\-\s]", "", meta)
    meta = meta.replace("/", "-")
    meta = re.sub(r"\s+", "-", meta)
    meta = re.sub(r"-{2,}", "-", meta).strip("-")
    return meta.upper()
