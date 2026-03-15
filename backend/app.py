from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager, suppress
import asyncio
import logging
import math
import json
import time
import os
import subprocess
from pathlib import Path
import uvicorn

from config import settings
from aggregator.fetch_pools import fetch_all_pools
from aggregator.fetch_gas import get_gas_price, get_gas_history_summary
from aggregator.price_feeds import get_token_prices
from aggregator.historical_data import get_historical_rates
from engine.net_yield import compute_net_yields
from engine.pool_ranker import rank_pools
from engine.migration_recommender import recommend_migration
from ai_engine.model_loader import load_model
from ai_engine.yield_predictor import predict_yields
from services.gemini_explainer import explain_strategy, chat_with_gemini

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[1]
MIGRATION_GAS_USED = 200000

_scheduled_migrations: list[dict] = []
_gas_alerts: list[dict] = []


class AiChatRequest(BaseModel):
    message: str
    chain: str | None = None
    context: str | None = None
    amount: float = 10000.0
    current_protocol: str = "aave"
    current_token: str = "USDC"


class ScheduleMigrationRequest(BaseModel):
    wallet_address: str
    target_pool: str
    gas_threshold: float


class GasAlertRequest(BaseModel):
    wallet_address: str
    gas_threshold: float


async def _build_assistant_context(
    amount: float,
    chain: str | None,
    current_protocol: str,
    current_token: str,
    pool_limit: int = 15,
) -> dict:
    pool_data = await fetch_all_pools(chain)
    gas_data = await get_gas_price()
    price_data = await get_token_prices()
    net_yields = compute_net_yields(pool_data, gas_data, price_data, amount)
    ranked = rank_pools(net_yields)

    migration = recommend_migration(
        current_protocol=current_protocol,
        current_token=current_token,
        amount=amount,
        net_yields=net_yields,
        predictions=[],
        gas_data=gas_data,
        price_data=price_data,
        gas_threshold_gwei=20.0,
    )

    stable_ranked = [
        p
        for p in ranked
        if str(p.get("token", "")).upper() in {"USDC", "USDT", "DAI", "FRAX"}
    ]
    top_strategy_pool = stable_ranked[0] if stable_ranked else (ranked[0] if ranked else None)

    pool_items: list[dict] = []
    for p in ranked[:pool_limit]:
        clean_pool_name = p.get("pool_name") or p.get("pool_meta") or p.get("pool_id", "")
        pool_items.append(
            {
                "protocol": p.get("protocol", ""),
                "pool_name": clean_pool_name,
                "pool": clean_pool_name,
                "token": p.get("token", ""),
                "gross_apy": round(float(p.get("gross_apy", p.get("apy", 0)) or 0), 4),
                "net_apy": round(float(p.get("net_apy", 0) or 0), 4),
                "tvl": round(float(p.get("tvl", 0) or 0), 2),
                "risk": str(p.get("risk_level", "Medium")).lower(),
                "risk_score": round(float(p.get("risk_score", 0) or 0), 2),
                "gas_impact": round(float(p.get("gas_impact_pct", 0) or 0), 6),
                "gas_cost_usd": round(float(p.get("gas_cost_usd", 0) or 0), 2),
                "rank": int(p.get("rank", 0) or 0),
            }
        )

    strategy_summary = None
    if top_strategy_pool:
        strategy_summary = {
            "action_hint": "migrate"
            if migration.get("recommendation") == "migrate"
            else "consider"
            if migration.get("recommendation") == "consider"
            else "hold",
            "recommended_protocol": top_strategy_pool.get("protocol", ""),
            "recommended_pool": top_strategy_pool.get("pool_name")
            or top_strategy_pool.get("pool_meta")
            or top_strategy_pool.get("pool_id", ""),
            "recommended_token": top_strategy_pool.get("token", ""),
            "reasoning": [
                f"Top net APY candidate: {float(top_strategy_pool.get('net_apy', 0) or 0):.2f}%",
                f"TVL: ${float(top_strategy_pool.get('tvl', 0) or 0):,.0f}",
                f"Risk level: {top_strategy_pool.get('risk_level', 'Medium')}",
            ],
        }

    gas_timing = _build_gas_timing_payload(gas_data=gas_data, price_data=price_data)

    return {
        "chain": chain or "ethereum",
        "amount": amount,
        "gas": {
            "safe": gas_data.get("safe"),
            "standard": gas_data.get("standard"),
            "fast": gas_data.get("fast"),
        },
        "prices": {
            "ETH": (price_data.get("prices", {}).get("ETH", {}) or {}).get("price"),
        },
        "pools": pool_items,
        "migration_recommendation": migration,
        "ai_strategy_output": strategy_summary,
        "gas_timing": gas_timing,
    }


def _estimate_wait_time(current_gas: float, avg_gas: float, hourly_averages: list[dict]) -> str:
    if current_gas <= avg_gas:
        return "Now"

    # Prefer the next hourly window below daily average if one exists.
    if hourly_averages:
        current_hour = int(time.gmtime().tm_hour)
        for offset in range(1, 25):
            hour = (current_hour + offset) % 24
            match = next((h for h in hourly_averages if int(h.get("hour", -1)) == hour), None)
            if match and float(match.get("average_gas", 0) or 0) <= avg_gas:
                # Include half-hour fractional precision for better timing guidance.
                frac_hours = max(0.5, offset - 0.5)
                return f"{frac_hours:.1f} hours"

    pressure = max((current_gas - avg_gas) / max(avg_gas, 1.0), 0)
    fallback_hours = max(0.5, min(8.0, round(pressure * 4, 1)))
    return f"{fallback_hours:.1f} hours"


def _build_gas_timing_payload(
    gas_data: dict,
    price_data: dict,
) -> dict:
    current_gas = float(gas_data.get("standard", 0) or 0)
    eth_price = float(((price_data.get("prices", {}).get("ETH", {}) or {}).get("price", 0)) or 0)

    summary = get_gas_history_summary(hours=24)
    avg_gas = float(summary.get("daily_average", current_gas) or current_gas)

    current_cost = (MIGRATION_GAS_USED * current_gas * eth_price) / 1e9
    avg_cost = (MIGRATION_GAS_USED * avg_gas * eth_price) / 1e9
    status = "HIGH" if current_gas > avg_gas else "LOW"

    recommended_action = "Wait before migrating" if status == "HIGH" else "Good time to migrate"
    wait_time = _estimate_wait_time(current_gas, avg_gas, summary.get("hourly_averages", []))
    expected_savings = max(current_cost - avg_cost, 0)

    return {
        "current_gas": round(current_gas, 2),
        "daily_average": round(avg_gas, 2),
        "average_gas": round(avg_gas, 2),
        "status": status,
        "recommended_action": recommended_action,
        "recommended_wait_time": wait_time,
        "estimated_current_cost": round(current_cost, 2),
        "estimated_average_cost": round(avg_cost, 2),
        "estimated_optimal_cost": round(avg_cost, 2),
        "expected_savings": round(expected_savings, 2),
        "gas_used": MIGRATION_GAS_USED,
        "eth_price": round(eth_price, 2),
        "data_source": (
            "Etherscan Gas Tracker"
            if str(gas_data.get("source", "")).lower() == "etherscan"
            else "Ethereum RPC"
        ),
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "hourly_averages": summary.get("hourly_averages", []),
        "history": summary.get("samples", []),
    }


async def _gas_history_sampler() -> None:
    """Background task that captures gas snapshots every 5 minutes."""
    while True:
        try:
            await get_gas_price()
        except Exception as exc:
            logger.warning("Gas history sampler tick failed: %s", exc)
        await asyncio.sleep(300)


def _run_adk_strategy(
    current_protocol: str,
    current_token: str,
    amount: float,
    chain: str | None,
) -> dict | None:
    """Execute the ADK-TS strategy runner and return parsed JSON response."""
    agent_script = ROOT_DIR / "agents" / "adkYieldWorkflow.mjs"
    if not agent_script.exists():
        logger.warning("ADK strategy script not found at %s", agent_script)
        return None

    payload = {
        "currentProtocol": current_protocol,
        "currentToken": current_token,
        "amountUsd": amount,
        "chain": chain or "ethereum",
        "apiBaseUrl": settings.ADK_API_BASE_URL or f"http://127.0.0.1:{settings.PORT}",
    }

    cmd = ["node", str(agent_script), "--input", json.dumps(payload)]
    env = os.environ.copy()
    if settings.GEMINI_API_KEY and not env.get("GOOGLE_API_KEY"):
        env["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY
    env.setdefault("ADK_MODEL", settings.ADK_MODEL)

    try:
        run = subprocess.run(
            cmd,
            cwd=str(ROOT_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=65,
            check=False,
        )
    except Exception as exc:
        logger.warning("ADK strategy subprocess failed to execute: %s", exc)
        return None

    if run.returncode != 0:
        logger.warning("ADK strategy exited non-zero: %s", (run.stderr or "").strip())
        return None

    out = (run.stdout or "").strip()
    if not out:
        logger.warning("ADK strategy returned empty stdout")
        return None

    last_line = out.splitlines()[-1]
    try:
        parsed = json.loads(last_line)
        if isinstance(parsed, dict):
            runtime_status = str(
                ((parsed.get("meta") or {}).get("runtime_status") or "").strip().lower()
            )
            if runtime_status and runtime_status != "ok":
                logger.warning("ADK strategy runtime degraded (%s), using fallback", runtime_status)
                return None
            return parsed
    except Exception as exc:
        logger.warning("ADK strategy output parse failure: %s", exc)

    return None


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
    sampler_task = asyncio.create_task(_gas_history_sampler())
    try:
        yield
    finally:
        sampler_task.cancel()
        with suppress(asyncio.CancelledError):
            await sampler_task


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


@app.get("/gas-timing")
async def gas_timing():
    """Return gas timing recommendation for migration windows."""
    try:
        gas_data = await get_gas_price()
        price_data = await get_token_prices()
        payload = _build_gas_timing_payload(gas_data=gas_data, price_data=price_data)
        return payload
    except Exception as exc:
        logger.exception("/gas-timing failed")
        raise HTTPException(status_code=502, detail=f"Failed to compute gas timing: {exc}") from exc


@app.post("/schedule-migration")
async def schedule_migration(payload: ScheduleMigrationRequest):
    """Store migration schedule intent until gas drops below user threshold."""
    gas_data = await get_gas_price()
    current_gas = float(gas_data.get("standard", 0) or 0)

    schedule = {
        "wallet_address": payload.wallet_address,
        "target_pool": payload.target_pool,
        "gas_threshold": payload.gas_threshold,
        "current_gas": current_gas,
        "scheduled": current_gas > payload.gas_threshold,
    }
    _scheduled_migrations.append(schedule)

    return {
        **schedule,
        "message": (
            "Migration condition met now; you can migrate immediately."
            if current_gas <= payload.gas_threshold
            else "Migration scheduled. We will trigger notification when gas is below threshold."
        ),
    }


@app.post("/gas-alert")
async def gas_alert(payload: GasAlertRequest):
    """Store user gas alert threshold."""
    alert = {
        "wallet_address": payload.wallet_address,
        "gas_threshold": payload.gas_threshold,
    }
    _gas_alerts.append(alert)
    return {
        **alert,
        "message": "Gas alert registered.",
    }


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


@app.get("/recommendation")
async def recommendation(
    current_protocol: str = "aave",
    current_token: str = "USDC",
    amount: float = 10000.0,
    gas_threshold_gwei: float = 20.0,
    chain: str | None = None,
):
    """Compatibility alias for migration recommendation endpoint."""
    return await migration(
        current_protocol=current_protocol,
        current_token=current_token,
        amount=amount,
        gas_threshold_gwei=gas_threshold_gwei,
        chain=chain,
    )


@app.get("/compare")
async def compare(
    amount: float = 10000.0,
    chain: str | None = None,
    token: str | None = None,
    limit: int = 5,
):
    """Return side-by-side pool comparison data ranked by net APY."""
    try:
        pool_data = await fetch_all_pools(chain)
        gas_data = await get_gas_price()
        price_data = await get_token_prices()
        net_yields = compute_net_yields(pool_data, gas_data, price_data, amount)
        ranked = rank_pools(net_yields)

        if token:
            ranked = [p for p in ranked if str(p.get("token", "")).upper() == token.upper()]

        compared: list[dict] = []
        for p in ranked[: max(limit, 1)]:
            compared.append(
                {
                    "protocol": p.get("protocol", ""),
                    "pool_name": p.get("pool_name") or p.get("pool_meta") or p.get("pool_id", ""),
                    "token": p.get("token", ""),
                    "gross_apy": round(float(p.get("gross_apy", p.get("apy", 0)) or 0), 4),
                    "net_apy": round(float(p.get("net_apy", 0) or 0), 4),
                    "tvl": round(float(p.get("tvl", 0) or 0), 2),
                    "risk": p.get("risk_level", "Medium"),
                    "gas_impact": round(float(p.get("gas_impact_pct", 0) or 0), 6),
                }
            )

        return {
            "token_filter": token.upper() if token else None,
            "amount": amount,
            "count": len(compared),
            "pools": compared,
            "sources": {
                "apy": "DefiLlama",
                "tvl": "DefiLlama",
                "prices": price_data.get("source", "coingecko"),
                "gas": gas_data.get("source", "etherscan/rpc"),
            },
        }
    except Exception as exc:
        logger.exception("/compare failed")
        raise HTTPException(status_code=502, detail=f"Failed to compare pools: {exc}") from exc


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
#  Gemini Strategy Explainer
# ──────────────────────────────────────────────
@app.get("/ai/explain-strategy")
async def ai_explain_strategy(
    protocol: str,
    pool: str,
    token: str,
    apy: float,
    tvl: float,
    chain: str | None = None,
    confidence: int | None = None,
):
    """Generate a human-readable Gemini explanation for a strategy recommendation."""
    try:
        explanation = explain_strategy(
            protocol=protocol,
            pool=pool,
            token=token,
            apy=apy,
            tvl=tvl,
            chain=chain,
            confidence=confidence,
            reasoning=None,
        )
        return {"explanation": explanation}
    except Exception as exc:
        logger.exception("/ai/explain-strategy failed")
        raise HTTPException(status_code=502, detail=f"Failed to generate strategy explanation: {exc}") from exc


@app.post("/ai/chat")
async def ai_chat(payload: AiChatRequest):
    """Chat assistant endpoint for beginner-friendly Gemini guidance."""
    try:
        assistant_context = await _build_assistant_context(
            amount=payload.amount,
            chain=payload.chain,
            current_protocol=payload.current_protocol,
            current_token=payload.current_token,
            pool_limit=15,
        )

        msg = (payload.message or "").lower()
        if any(
            term in msg
            for term in ["when should i migrate", "when to migrate", "why is gas high", "how much will gas cost", "gas timing"]
        ):
            # Explicitly source gas timing analysis from the dedicated endpoint flow.
            assistant_context["gas_timing"] = await gas_timing()

        chat_payload = chat_with_gemini(
            user_message=payload.message,
            pool_context=assistant_context,
            chain=payload.chain,
            context=payload.context,
        )
        return {
            **chat_payload,
            "context_used": {
                "pools_count": len(assistant_context.get("pools", [])),
                "chain": assistant_context.get("chain"),
            },
        }
    except Exception as exc:
        logger.exception("/ai/chat failed")
        raise HTTPException(status_code=502, detail=f"Failed to generate chat response: {exc}") from exc


@app.get("/assistant/context")
async def assistant_context(
    amount: float = 10000.0,
    chain: str | None = None,
    current_protocol: str = "aave",
    current_token: str = "USDC",
):
    """Return live assistant context used for DeFi copilot grounding."""
    try:
        context_payload = await _build_assistant_context(
            amount=amount,
            chain=chain,
            current_protocol=current_protocol,
            current_token=current_token,
            pool_limit=25,
        )
        return context_payload
    except Exception as exc:
        logger.exception("/assistant/context failed")
        raise HTTPException(status_code=502, detail=f"Failed to build assistant context: {exc}") from exc


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
        adk_response = _run_adk_strategy(current_protocol, current_token, amount, chain)
        if adk_response:
            if not adk_response.get("explanation"):
                recommended = adk_response.get("recommended") or {}
                adk_response["explanation"] = explain_strategy(
                    protocol=str(recommended.get("protocol", "Unknown")),
                    pool=str(recommended.get("pool_name") or recommended.get("pool_meta") or "Pool"),
                    token=str(recommended.get("token", "")),
                    apy=float(adk_response.get("predicted_net_apy_30d", 0) or 0),
                    tvl=float(recommended.get("tvl", 0) or 0),
                    chain=str(recommended.get("chain") or chain or ""),
                    confidence=int(adk_response.get("confidence", 0) or 0),
                    reasoning=adk_response.get("reasoning") if isinstance(adk_response.get("reasoning"), list) else None,
                )
            return adk_response

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
        explanation = explain_strategy(
            protocol=str(target_pool.get("protocol", "Unknown")),
            pool=str(target_pool.get("pool_name") or target_pool.get("pool_meta") or "Pool"),
            token=str(target_pool.get("token", "")),
            apy=projected_target_apy,
            tvl=float(target_pool.get("tvl", 0) or 0),
            chain=str(target_pool.get("chain") or chain or ""),
            confidence=confidence,
            reasoning=reasons,
        )

        return {
            "agent": {
                "name": "IQ Yield Strategy Agent",
                "framework": "internal-fallback-no-adk",
                "mode": "autonomous",
            },
            "action": action,
            "confidence": confidence,
            "current": current_pool,
            "recommended": target_pool,
            "predicted_net_apy_30d": projected_target_apy,
            "estimated_30d_delta_usd": expected_delta_30d,
            "reasoning": reasons,
            "explanation": explanation,
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
