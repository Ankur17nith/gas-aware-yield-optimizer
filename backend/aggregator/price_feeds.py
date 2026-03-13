"""
price_feeds.py
──────────────
Fetches real-time token prices from trusted public sources.
Primary: CoinGecko API
Fallback: DefiLlama prices API
"""

import time
import httpx
from config import settings

_cache: dict = {"data": None, "ts": 0}

COINGECKO_IDS = {
    "ETH": "ethereum",
    "USDC": "usd-coin",
    "DAI": "dai",
    "USDT": "tether",
}

# DefiLlama price API uses "chain:address" or "coingecko:<id>" format
DEFILLAMA_KEYS = {
    "ETH": "coingecko:ethereum",
    "USDC": f"ethereum:{settings.STABLECOINS['USDC']}",
    "DAI": f"ethereum:{settings.STABLECOINS['DAI']}",
    "USDT": f"ethereum:{settings.STABLECOINS['USDT']}",
}


async def get_token_prices() -> dict:
    """Return current prices for ETH and supported stablecoins."""
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < settings.CACHE_TTL_SECONDS:
        return _cache["data"]

    result = await _fetch_from_coingecko()
    if result is None:
        result = await _fetch_from_defillama()
    if result is None:
        raise RuntimeError("Unable to fetch token prices from CoinGecko or DefiLlama")

    _cache["data"] = result
    _cache["ts"] = now
    return result


async def _fetch_from_coingecko() -> dict | None:
    ids = ",".join(COINGECKO_IDS.values())
    params = {
        "ids": ids,
        "vs_currencies": "usd",
        "include_last_updated_at": "true",
    }
    headers = {}
    if settings.COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = settings.COINGECKO_API_KEY

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(settings.COINGECKO_PRICE_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        prices = {}
        for label, cg_id in COINGECKO_IDS.items():
            entry = data.get(cg_id)
            if not entry or "usd" not in entry:
                return None
            prices[label] = {
                "price": float(entry["usd"]),
                "symbol": label,
                "confidence": 1,
            }

        return {"prices": prices, "source": "coingecko"}
    except Exception:
        return None


async def _fetch_from_defillama() -> dict | None:
    coin_ids = ",".join(DEFILLAMA_KEYS.values())
    url = f"{settings.DEFILLAMA_PRICES_URL}/{coin_ids}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        coins = data.get("coins", {})
        prices = {}
        for label, key in DEFILLAMA_KEYS.items():
            coin_data = coins.get(key)
            if not coin_data or "price" not in coin_data:
                return None
            prices[label] = {
                "price": float(coin_data.get("price")),
                "symbol": coin_data.get("symbol", label),
                "confidence": coin_data.get("confidence", 0),
            }

        return {"prices": prices, "source": "defillama"}
    except Exception:
        return None
