import logging
import json
from typing import Sequence

try:
    from google import genai as _genai
except Exception:  # pragma: no cover - import failure fallback
    _genai = None

from config import settings

logger = logging.getLogger(__name__)

_model = None
_client = None


def _get_model():
    global _model, _client
    if _model is not None:
        return _model

    if not settings.GEMINI_API_KEY:
        return None

    if _genai is None:
        return None

    try:
        client_cls = getattr(_genai, "Client", None)
        if client_cls is None:
            logger.warning("Gemini SDK does not expose expected API; using fallback explainer")
            return None

        _client = client_cls(api_key=settings.GEMINI_API_KEY)
        _model = settings.GEMINI_MODEL
    except Exception:
        logger.exception("Failed to initialize Gemini model")
        _model = None
        _client = None

    return _model


def _fallback_explanation(
    protocol: str,
    pool: str,
    token: str,
    apy: float,
    tvl: float,
    confidence: int | None,
    reasoning: Sequence[str] | None,
) -> str:
    confidence_text = f" with {confidence}% confidence" if confidence is not None else ""
    base = (
        f"{protocol} {pool} ({token}) is currently preferred because it offers an estimated "
        f"{apy:.2f}% net APY{confidence_text} and approximately ${tvl:,.0f} in TVL, "
        "which generally indicates stronger liquidity for stablecoin execution."
    )
    if reasoning:
        details = " ".join(reasoning[:2])
        return f"{base} {details}"
    return base


def explain_strategy(
    protocol: str,
    pool: str,
    token: str,
    apy: float,
    tvl: float,
    chain: str | None = None,
    confidence: int | None = None,
    reasoning: Sequence[str] | None = None,
) -> str:
    model = _get_model()
    if model is None or _client is None:
        return _fallback_explanation(protocol, pool, token, apy, tvl, confidence, reasoning)

    prompt = f"""
You are an expert DeFi strategy analyst for a stablecoin yield optimizer.
Explain clearly in 3-4 concise sentences why this recommendation is sensible for a user.
Mention yield, liquidity (TVL), and gas/tradeoff considerations.
Avoid hype and avoid financial guarantees.

Protocol: {protocol}
Pool: {pool}
Token: {token}
Chain: {chain or 'unknown'}
Predicted Net APY: {apy:.4f}%
TVL: ${tvl:,.2f}
Confidence: {confidence if confidence is not None else 'n/a'}
Signals: {', '.join(reasoning) if reasoning else 'n/a'}
""".strip()

    try:
        response = _client.models.generate_content(model=model, contents=prompt)
        text = (getattr(response, "text", "") or "").strip()
        if text:
            return text
    except Exception:
        logger.exception("Gemini explanation generation failed")

    return _fallback_explanation(protocol, pool, token, apy, tvl, confidence, reasoning)


def _fallback_chat_answer(user_message: str) -> str:
    text = user_message.strip()
    if not text:
        return (
            "Ask me anything about stablecoin yield optimization. For example: "
            "'What is APY?', 'Should I migrate now?', or 'How does gas cost affect returns?'"
        )

    lower = text.lower()
    if "apy" in lower:
        return (
            "APY is your annual percentage yield. In this app, focus on net APY, which subtracts gas costs "
            "so you can compare real expected returns."
        )
    if "gas" in lower:
        return (
            "Gas is the transaction fee paid on-chain. High gas can wipe out small APY gains, so migration "
            "is best when expected net gain is clearly higher than migration cost."
        )
    if "migrate" in lower:
        return (
            "A migration can be good when the target pool has better net APY, enough TVL liquidity, and the "
            "30-day expected gain exceeds migration gas friction."
        )
    return (
        "I can help you with beginner DeFi questions. Try asking about APY, gas fees, risk levels, "
        "pool comparison, or when to migrate."
    )


def chat_with_gemini(
    user_message: str,
    pool_context: dict | None = None,
    chain: str | None = None,
    context: str | None = None,
) -> dict:
    """Return a concise, data-grounded response for DeFi copilot chat assistant."""
    context_obj = pool_context or {}
    pools = context_obj.get("pools", []) if isinstance(context_obj, dict) else []

    def _context_top_pool() -> dict:
        if not isinstance(pools, list) or not pools:
            return {}
        try:
            return max(
                pools,
                key=lambda p: float((p or {}).get("net_apy", 0) or 0),
            )
        except Exception:
            return pools[0] if pools else {}

    def _fallback_structured() -> dict:
        top = _context_top_pool()
        if top:
            protocol = str(top.get("protocol", "Unknown"))
            pool = str(top.get("pool", "Pool"))
            token = str(top.get("token", ""))
            net_apy = float(top.get("net_apy", 0) or 0)
            tvl = float(top.get("tvl", 0) or 0)
            risk = str(top.get("risk", "medium"))
            gas_impact = float(top.get("gas_impact", 0) or 0)

            answer = (
                f"Based on live platform data, {protocol} {pool} ({token}) currently looks strong "
                f"because its net APY is {net_apy:.2f}% with TVL around ${tvl:,.0f}."
            )
            reason = "Highest net APY among currently loaded pools with meaningful liquidity."
            risk_note = f"Risk level is {risk}."
            gas_note = f"Estimated gas impact is {gas_impact:.4f}% on your configured deposit context."
            return {
                "answer": answer,
                "recommended_pool": {
                    "protocol": protocol,
                    "pool": pool,
                    "token": token,
                    "net_apy": round(net_apy, 4),
                    "tvl": round(tvl, 2),
                    "risk": risk,
                    "gas_impact": round(gas_impact, 6),
                },
                "reason": reason,
                "risk": risk_note,
                "gas_impact": gas_note,
                "notes": [
                    "This response uses live pool context from the backend.",
                    "No profit is guaranteed; yields and gas can change quickly.",
                ],
            }

        return {
            "answer": _fallback_chat_answer(user_message),
            "recommended_pool": None,
            "reason": "No live pool context was available in this request.",
            "risk": "Risk depends on protocol maturity, TVL, and APY volatility.",
            "gas_impact": "Gas impact is lower on L2 and higher on Ethereum mainnet.",
            "notes": [
                "Try refreshing data and asking again for pool-specific guidance.",
            ],
        }

    model = _get_model()
    if model is None or _client is None:
        return _fallback_structured()

    prompt = f"""
You are YieldOptimizer DeFi Strategy Copilot.

You MUST answer using only the provided live pool context.
Do NOT invent pools, APY, TVL, gas impact, migration data, or strategy output.
If specific data is missing, say it is unavailable.

Style rules:
- Keep answer short (max 140 words).
- Explain in simple English for non-technical users.
- Never guarantee profits.
- If user asks for financial advice, provide educational guidance and risk caveat.
- If useful, provide 2-4 practical steps.

Return STRICT JSON only with keys:
answer,
recommended_pool (object or null with keys: protocol,pool,token,net_apy,tvl,risk,gas_impact),
reason,
risk,
gas_impact,
notes (array of short strings)

Context:
- Active chain: {chain or 'unknown'}
- App context: {context or 'none'}
- Pool context JSON: {json.dumps(context_obj, ensure_ascii=True)}

User question:
{user_message}
""".strip()

    try:
        response = _client.models.generate_content(model=model, contents=prompt)
        text = (getattr(response, "text", "") or "").strip()
        if text:
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict) and isinstance(parsed.get("answer"), str):
                    return parsed
            except Exception:
                pass

            # Best-effort JSON extraction if the model wraps output.
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                try:
                    parsed = json.loads(text[start : end + 1])
                    if isinstance(parsed, dict) and isinstance(parsed.get("answer"), str):
                        return parsed
                except Exception:
                    pass
    except Exception:
        logger.exception("Gemini chat generation failed")

    return _fallback_structured()
