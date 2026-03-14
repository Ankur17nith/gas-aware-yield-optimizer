import logging
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
    chain: str | None = None,
    context: str | None = None,
) -> str:
    """Return a concise beginner-friendly answer for dashboard chat assistant."""
    model = _get_model()
    if model is None or _client is None:
        return _fallback_chat_answer(user_message)

    prompt = f"""
You are YieldOptimizer Assistant, a beginner-friendly DeFi tutor inside a stablecoin yield optimizer app.

Style rules:
- Keep answer short (max 120 words).
- Explain in simple English for non-technical users.
- Never guarantee profits.
- If user asks for financial advice, provide educational guidance and risk caveat.
- If useful, provide 2-4 practical steps.

Context:
- Active chain: {chain or 'unknown'}
- App context: {context or 'none'}

User question:
{user_message}
""".strip()

    try:
        response = _client.models.generate_content(model=model, contents=prompt)
        text = (getattr(response, "text", "") or "").strip()
        if text:
            return text
    except Exception:
        logger.exception("Gemini chat generation failed")

    return _fallback_chat_answer(user_message)
