import logging
from typing import Sequence

import google.generativeai as genai

from config import settings

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model

    if not settings.GEMINI_API_KEY:
        return None

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel(settings.GEMINI_MODEL)
    except Exception:
        logger.exception("Failed to initialize Gemini model")
        _model = None

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
    if model is None:
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
        response = model.generate_content(prompt)
        text = (getattr(response, "text", "") or "").strip()
        if text:
            return text
    except Exception:
        logger.exception("Gemini explanation generation failed")

    return _fallback_explanation(protocol, pool, token, apy, tvl, confidence, reasoning)
