from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from config import settings
from aggregator.fetch_pools import fetch_all_pools
from aggregator.fetch_gas import get_gas_price
from aggregator.price_feeds import get_token_prices
from aggregator.historical_data import get_historical_rates
from engine.net_yield import compute_net_yields
from engine.pool_ranker import rank_pools
from engine.migration_recommender import recommend_migration
from ai_engine.model_loader import load_model
from ai_engine.yield_predictor import predict_yields


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the AI model on startup."""
    app.state.model = load_model(settings.MODEL_PATH)
    yield


app = FastAPI(
    title="Gas-Aware Stablecoin Yield Optimizer",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
#  Health
# ──────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "Gas Aware Yield Optimizer API running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# ──────────────────────────────────────────────
#  Pool Data
# ──────────────────────────────────────────────
@app.get("/pools")
async def pools(chain: str | None = None):
    """Return live pool data from DeFi protocols."""
    try:
        pool_data = await fetch_all_pools(chain)
        return {"pools": pool_data}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch pools: {exc}") from exc


# ──────────────────────────────────────────────
#  Gas Price
# ──────────────────────────────────────────────
@app.get("/gas")
async def gas():
    """Return current Ethereum gas price."""
    try:
        gas_data = await get_gas_price()
        return gas_data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch gas data: {exc}") from exc


# ──────────────────────────────────────────────
#  Token Prices
# ──────────────────────────────────────────────
@app.get("/prices")
async def prices():
    """Return current stablecoin and ETH prices."""
    price_data = await get_token_prices()
    return price_data


# ──────────────────────────────────────────────
#  Net Yield (gas-aware)
# ──────────────────────────────────────────────
@app.get("/net-yield")
async def net_yield(amount: float = 10000.0, chain: str | None = None):
    """Calculate net APY after gas costs for all pools."""
    try:
        pool_data = await fetch_all_pools(chain)
        gas_data = await get_gas_price()
        price_data = await get_token_prices()
        results = compute_net_yields(pool_data, gas_data, price_data, amount)
        ranked = rank_pools(results)
        return {"pools": ranked, "deposit_amount": amount}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to compute net yield: {exc}") from exc


# ──────────────────────────────────────────────
#  AI Predictions
# ──────────────────────────────────────────────
@app.get("/predictions")
async def predictions(chain: str | None = None):
    """Return AI-predicted yields for the next 30 days."""
    try:
        pool_data = await fetch_all_pools(chain)
        historical = await get_historical_rates()
        model = app.state.model
        preds = predict_yields(model, pool_data, historical)
        return {"predictions": preds}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate predictions: {exc}") from exc


# ──────────────────────────────────────────────
#  Migration Recommendation
# ──────────────────────────────────────────────
@app.get("/migration")
async def migration(
    current_protocol: str = "aave",
    current_token: str = "USDC",
    amount: float = 10000.0,
    chain: str | None = None,
):
    """Get migration recommendation for a user's position."""
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    price_data = await get_token_prices()
    net_yields = compute_net_yields(pool_data, gas_data, price_data, amount)
    historical = await get_historical_rates()
    model = app.state.model
    preds = predict_yields(model, pool_data, historical)

    recommendation = recommend_migration(
        current_protocol=current_protocol,
        current_token=current_token,
        amount=amount,
        net_yields=net_yields,
        predictions=preds,
        gas_data=gas_data,
        price_data=price_data,
    )
    return recommendation


# ──────────────────────────────────────────────
#  Historical Data
# ──────────────────────────────────────────────
@app.get("/historical")
async def historical():
    """Return historical yield data for charts."""
    data = await get_historical_rates()
    return {"historical": data}


# ──────────────────────────────────────────────
#  Leaderboard (top pools by net APY)
# ──────────────────────────────────────────────
@app.get("/leaderboard")
async def leaderboard(amount: float = 10000.0, limit: int = 10, chain: str | None = None):
    """Return top pools ranked by net APY."""
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    price_data = await get_token_prices()
    results = compute_net_yields(pool_data, gas_data, price_data, amount)
    ranked = rank_pools(results)
    return {"pools": ranked[:limit], "total": len(ranked)}


# ──────────────────────────────────────────────
#  Stats Summary
# ──────────────────────────────────────────────
@app.get("/stats")
async def stats(chain: str | None = None):
    """Return aggregate platform stats."""
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    total_tvl = sum(p.get("tvlUsd", 0) for p in pool_data)
    best_apy = max((p.get("apy", 0) for p in pool_data), default=0)
    protocols = len(set(p.get("project", "") for p in pool_data))
    tokens = len(set(p.get("symbol", "") for p in pool_data))
    return {
        "total_tvl": total_tvl,
        "best_apy": best_apy,
        "protocols": protocols,
        "tokens": tokens,
        "pools_count": len(pool_data),
        "gas": gas_data,
    }


# ──────────────────────────────────────────────
#  Portfolio Simulation
# ──────────────────────────────────────────────
@app.get("/portfolio")
async def portfolio(amount: float = 10000.0, chain: str | None = None):
    """Simulate portfolio allocation across top pools."""
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    price_data = await get_token_prices()
    results = compute_net_yields(pool_data, gas_data, price_data, amount)
    ranked = rank_pools(results)
    top = ranked[0] if ranked else None
    avg_apy = sum(p.get("net_apy", p.get("apy", 0)) for p in ranked) / max(len(ranked), 1)
    return {
        "deposit_amount": amount,
        "best_pool": top,
        "avg_net_apy": round(avg_apy, 4),
        "estimated_30d": round(amount * (avg_apy / 100) * (30 / 365), 2) if avg_apy else 0,
        "pools_count": len(ranked),
    }


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
