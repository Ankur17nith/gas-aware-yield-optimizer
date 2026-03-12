"""
price_feeds.py
──────────────
Fetches real-time token prices from DefiLlama price API (free, no key).
Covers ETH, USDC, DAI, USDT.
"""

import time
import httpx
from config import settings

_cache: dict = {"data": None, "ts": 0}

# DefiLlama price API uses "chain:address" format
_PRICE_KEYS = {
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

    coin_ids = ",".join(_PRICE_KEYS.values())
    url = f"{settings.DEFILLAMA_PRICES_URL}/{coin_ids}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        coins = data.get("coins", {})
        prices = {}
        for label, key in _PRICE_KEYS.items():
            coin_data = coins.get(key, {})
            prices[label] = {
                "price": coin_data.get("price", 1.0 if label != "ETH" else 3000.0),
                "symbol": coin_data.get("symbol", label),
                "confidence": coin_data.get("confidence", 0),
            }

        result = {"prices": prices, "source": "defillama"}
    except Exception:
        result = {
            "prices": {
                "ETH": {"price": 3000.0, "symbol": "ETH", "confidence": 0},
                "USDC": {"price": 1.0, "symbol": "USDC", "confidence": 0},
                "DAI": {"price": 1.0, "symbol": "DAI", "confidence": 0},
                "USDT": {"price": 1.0, "symbol": "USDT", "confidence": 0},
            },
            "source": "fallback",
        }

    _cache["data"] = result
    _cache["ts"] = now
    return result
