from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import math
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

logger = logging.getLogger(__name__)


def _pool_net_apy(pool: dict) -> float:
    return float(pool.get("net_apy", pool.get("apy", 0)) or 0)


def _risk_penalty(pool: dict) -> float:
    risk = str(pool.get("risk_level", "Medium") or "Medium").lower()
    if risk == "low":
        return 0.0
    if risk == "high":
        return 3.0
    return 1.2


def _agent_score(pool: dict) -> float:
    net_apy = _pool_net_apy(pool)
    tvl = float(pool.get("tvl", 0) or 0)
    # Log-based TVL bonus rewards deeper liquidity while keeping scores bounded.
    tvl_bonus = max(0.0, min((math.log10(max(tvl, 1.0)) - 4.0) * 0.7, 2.5))
    return net_apy + tvl_bonus - _risk_penalty(pool)


def _strategy_action(current: dict, target: dict) -> str:
    apy_delta = _pool_net_apy(target) - _pool_net_apy(current)
    score_delta = _agent_score(target) - _agent_score(current)
    if apy_delta >= 0.25 and score_delta >= 0.35:
        return "migrate"
    if apy_delta >= 0.12 and score_delta >= 0.2:
        return "consider"
    return "hold"


def _build_reasoning(current: dict, target: dict, gas_gwei: float, action: str) -> list[str]:
    apy_delta = _pool_net_apy(target) - _pool_net_apy(current)
    current_tvl = float(current.get("tvl", 0) or 0)
    target_tvl = float(target.get("tvl", 0) or 0)
    reasons = [
        f"Net APY delta is {apy_delta:.2f}% ({target.get('protocol')} vs {current.get('protocol')}).",
        f"Liquidity comparison: current TVL ${current_tvl:,.0f}, target TVL ${target_tvl:,.0f}.",
        f"Current gas regime is {gas_gwei:.1f} gwei, already included in net yield computation.",
    ]
    if action == "hold":
        reasons.append("Expected gain does not clearly exceed migration friction threshold.")
    return reasons


def _projected_apy(pool: dict) -> float:
    net_apy = _pool_net_apy(pool)
    reward_apy = float(pool.get("reward_apy", 0) or 0)
    drift = min(reward_apy * 0.08, 0.8)
    return round(max(net_apy + drift, 0), 4)


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
        return {
            "pools": pool_data,
            "sources": {
                "apy": "DefiLlama",
                "tvl": "DefiLlama",
                "pool_list": "DefiLlama",
            },
        }
    except Exception as exc:
        logger.exception("/pools failed")
        raise HTTPException(status_code=502, detail=f"Failed to fetch pools: {exc}") from exc


# ──────────────────────────────────────────────
#  Gas Price
# ──────────────────────────────────────────────
@app.get("/gas")
async def gas():
    """Return current Ethereum gas price."""
    try:
        gas_data = await get_gas_price()
        return {
            **gas_data,
            "sources": {
                "gas": gas_data.get("source", "etherscan/rpc"),
            },
        }
    except Exception as exc:
        logger.exception("/gas failed")
        raise HTTPException(status_code=502, detail=f"Failed to fetch gas data: {exc}") from exc


# ──────────────────────────────────────────────
#  Token Prices
# ──────────────────────────────────────────────
@app.get("/prices")
async def prices():
    """Return current stablecoin and ETH prices."""
    price_data = await get_token_prices()
    return {
        **price_data,
        "sources": {
            "prices": price_data.get("source", "coingecko"),
        },
    }


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
        return {
            "pools": ranked,
            "deposit_amount": amount,
            "sources": {
                "apy": "DefiLlama",
                "tvl": "DefiLlama",
                "prices": price_data.get("source", "coingecko"),
                "gas": gas_data.get("source", "etherscan/rpc"),
            },
        }
    except Exception as exc:
        logger.exception("/net-yield failed")
        raise HTTPException(status_code=502, detail=f"Failed to compute net yield: {exc}") from exc


# ──────────────────────────────────────────────
#  AI Predictions
# ──────────────────────────────────────────────
@app.get("/predictions")
async def predictions(chain: str | None = None):
    """Return AI-predicted yields for the next 30 days."""
    try:
        pool_data = await fetch_all_pools(chain)
        historical = await get_historical_rates(chain)
        model = app.state.model
        preds = predict_yields(model, pool_data, historical)
        return {
            "predictions": preds,
            "sources": {
                "input_pools": "DefiLlama",
                "historical_apy": "DefiLlama",
                "model": "local-trained-model",
            },
        }
    except Exception as exc:
        logger.exception("/predictions failed")
        raise HTTPException(status_code=502, detail=f"Failed to generate predictions: {exc}") from exc


# ──────────────────────────────────────────────
#  Migration Recommendation
# ──────────────────────────────────────────────
@app.get("/migration")
async def migration(
    current_protocol: str = "aave",
    current_token: str = "USDC",
    amount: float = 10000.0,
    gas_threshold_gwei: float = 20.0,
    chain: str | None = None,
):
    """Get migration recommendation for a user's position."""
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    price_data = await get_token_prices()
    net_yields = compute_net_yields(pool_data, gas_data, price_data, amount)
    historical = await get_historical_rates(chain)
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
        gas_threshold_gwei=gas_threshold_gwei,
    )
    return recommendation


@app.get("/auto-rebalance")
async def auto_rebalance(
    current_protocol: str = "aave",
    current_token: str = "USDC",
    amount: float = 10000.0,
    gas_threshold_gwei: float = 20.0,
    trigger: bool = False,
    chain: str | None = None,
):
    """Return auto-rebalance recommendation based on APY delta and gas threshold."""
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    price_data = await get_token_prices()
    net_yields = compute_net_yields(pool_data, gas_data, price_data, amount)
    historical = await get_historical_rates(chain)
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
        gas_threshold_gwei=gas_threshold_gwei,
    )

    should_rebalance = bool(recommendation.get("auto_rebalance_recommended", False))
    trigger_status = "not_requested"
    if trigger and should_rebalance:
        # This backend is non-custodial: it can recommend, but does not hold user keys.
        trigger_status = "requires_user_signature"

    return {
        "enabled": True,
        "should_rebalance": should_rebalance,
        "trigger": trigger,
        "trigger_status": trigger_status,
        "recommendation": recommendation,
    }


# ──────────────────────────────────────────────
#  Historical Data
# ──────────────────────────────────────────────
@app.get("/historical")
async def historical(chain: str | None = None):
    """Return historical yield data for charts."""
    data = await get_historical_rates(chain)
    return {"historical": data}


# ──────────────────────────────────────────────
#  Leaderboard (top pools by net APY)
# ──────────────────────────────────────────────
@app.get("/leaderboard")
async def leaderboard(amount: float = 10000.0, limit: int = 10, chain: str | None = None):
    """Return top pools ranked by net APY."""
    try:
        pool_data = await fetch_all_pools(chain)
        gas_data = await get_gas_price()
        price_data = await get_token_prices()
        results = compute_net_yields(pool_data, gas_data, price_data, amount)
        ranked = rank_pools(results)
        return {"pools": ranked[:limit], "total": len(ranked)}
    except Exception as exc:
        logger.exception("/leaderboard failed")
        raise HTTPException(status_code=502, detail=f"Failed to build leaderboard: {exc}") from exc


# ──────────────────────────────────────────────
#  Stats Summary
# ──────────────────────────────────────────────
@app.get("/stats")
async def stats(chain: str | None = None):
    """Return aggregate platform stats."""
    try:
        pool_data = await fetch_all_pools(chain)
        gas_data = await get_gas_price()
        total_tvl = sum(float(p.get("tvl", 0) or 0) for p in pool_data)
        best_apy = max((float(p.get("apy", 0) or 0) for p in pool_data), default=0)
        protocols = len(set(p.get("protocol", "") for p in pool_data))
        tokens = len(set(p.get("token", "") for p in pool_data))
        return {
            "total_tvl": total_tvl,
            "best_apy": best_apy,
            "protocols": protocols,
            "tokens": tokens,
            "pools_count": len(pool_data),
            "gas": gas_data,
        }
    except Exception as exc:
        logger.exception("/stats failed")
        raise HTTPException(status_code=502, detail=f"Failed to compute stats: {exc}") from exc


# ──────────────────────────────────────────────
#  Portfolio Simulation
# ──────────────────────────────────────────────
@app.get("/portfolio")
async def portfolio(amount: float = 10000.0, chain: str | None = None):
    """Simulate portfolio allocation across top pools."""
    try:
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
    except Exception as exc:
        logger.exception("/portfolio failed")
        raise HTTPException(status_code=502, detail=f"Failed to compute portfolio: {exc}") from exc


# ──────────────────────────────────────────────
#  Autonomous AI Strategy Agent
# ──────────────────────────────────────────────
@app.get("/ai-agent/strategy")
async def ai_agent_strategy(
    current_protocol: str = "aave",
    current_token: str = "USDC",
    amount: float = 10000.0,
    chain: str | None = None,
):
    """Return autonomous strategy recommendation for stablecoin reallocation."""
    try:
        pool_data = await fetch_all_pools(chain)
        gas_data = await get_gas_price()
        price_data = await get_token_prices()
        net_yields = compute_net_yields(pool_data, gas_data, price_data, amount)
        ranked = rank_pools(net_yields)

        stable_ranked = [
            p
            for p in ranked
            if str(p.get("token", "")).upper() in {"USDC", "USDT", "DAI", "FRAX"}
        ]
        if not stable_ranked:
            raise HTTPException(status_code=404, detail="No stablecoin pools available for agent strategy")

        current_matches = [
            p
            for p in stable_ranked
            if str(p.get("protocol", "")).lower() == current_protocol.lower()
            and str(p.get("token", "")).upper() == current_token.upper()
        ]

        if current_matches:
            current_pool = max(current_matches, key=_agent_score)
        else:
            current_pool = min(stable_ranked, key=_agent_score)

        target_pool = max(stable_ranked, key=_agent_score)
        action = _strategy_action(current_pool, target_pool)
        score_delta = _agent_score(target_pool) - _agent_score(current_pool)
        confidence = int(max(52, min(97, round(58 + (score_delta * 18)))))
        projected_target_apy = _projected_apy(target_pool)
        projected_current_apy = _projected_apy(current_pool)

        expected_delta_30d = round(
            amount * ((projected_target_apy - projected_current_apy) / 100.0) * (30 / 365),
            2,
        )

        gas_gwei = float(gas_data.get("standard", 0) or 0)
        reasons = _build_reasoning(current_pool, target_pool, gas_gwei, action)

        return {
            "agent": {
                "name": "IQ Yield Strategy Agent",
                "framework": "iqai-compatible-fallback",
                "mode": "autonomous",
            },
            "action": action,
            "confidence": confidence,
            "current": current_pool,
            "recommended": target_pool,
            "predicted_net_apy_30d": projected_target_apy,
            "estimated_30d_delta_usd": expected_delta_30d,
            "reasoning": reasons,
            "onchain_trigger": {
                "supported": False,
                "method": "migrateStrategy(address)",
                "status": "router_method_unavailable",
            },
            "sources": {
                "input_pools": "DefiLlama",
                "prices": price_data.get("source", "coingecko"),
                "gas": gas_data.get("source", "etherscan/rpc"),
                "ranking": "internal-agent-score-v1",
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("/ai-agent/strategy failed")
        raise HTTPException(status_code=502, detail=f"Failed to compute AI agent strategy: {exc}") from exc


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
