import logging
import json
import re
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


def _is_recommendation_request(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False

    explicit_phrases = [
        "which pool should i use",
        "what pool is best",
        "best pool for",
        "should i migrate",
        "which protocol has the best yield",
        "which pool should i migrate to",
        "what is the best pool",
        "recommend a pool",
    ]
    if any(phrase in text for phrase in explicit_phrases):
        return True

    # Allow concise recommendation intents like "best usdc pool".
    if re.search(r"\b(best|recommend|migrate)\b", text) and re.search(
        r"\b(pool|protocol|apy|yield|usdc|usdt|dai|frax)\b", text
    ):
        return True

    return False


def _classify_question_type(message: str) -> str:
    text = (message or "").strip().lower()
    if not text:
        return "educational"
    if _is_recommendation_request(text):
        return "strategy"
    if re.search(r"\b(this platform|dashboard|how do you calculate|net apy|risk level|gas impact)\b", text):
        return "platform"
    if re.search(
        r"\b(ethereum|bitcoin|blockchain|smart contract|wallet|private key|public key|layer 2|l2|consensus|defi)\b",
        text,
    ):
        return "blockchain"
    return "educational"


def _fallback_non_strategy_answer(user_message: str, question_type: str) -> dict:
    text = (user_message or "").strip().lower()

    if question_type == "platform":
        if "net apy" in text:
            answer = (
                "Net APY is your realistic return after costs. In this platform, we estimate it as:\n"
                "Net APY = Gross APY - Gas Impact - Protocol Fees.\n\n"
                "Example: if Gross APY is 8.0%, Gas Impact is 0.4%, and fees are 0.2%, Net APY is 7.4%.\n\n"
                "This helps you compare pools based on what you may actually keep, not headline APY."
            )
        elif "risk" in text:
            answer = (
                "Risk level is a simple way to show how uncertain a pool may be.\n\n"
                "Low risk usually means deeper liquidity and more stable behavior. High risk can mean bigger APY swings, lower liquidity, or newer protocols.\n\n"
                "Risk affects strategy because a slightly lower APY with lower risk can be safer for beginners."
            )
        else:
            answer = (
                "This platform compares DeFi pools using live data, then adjusts returns for costs.\n\n"
                "Definition: it is a gas-aware yield optimizer, so it focuses on net APY rather than only gross APY.\n"
                "Example: a pool with lower gross APY can still win if gas costs are much lower.\n\n"
                "This helps users make clearer migration decisions with real trading friction included."
            )
    elif question_type == "blockchain":
        if "smart contract" in text:
            answer = (
                "A smart contract is code on a blockchain that runs automatically when conditions are met.\n\n"
                "Example: when you deposit USDC into a lending pool, the contract tracks your deposit and yield rules.\n\n"
                "In DeFi strategies, smart contracts remove middlemen, but bugs in code are still a risk."
            )
        elif "ethereum" in text:
            answer = (
                "Ethereum is a blockchain where apps and smart contracts run.\n\n"
                "Example: many DeFi protocols like lending and liquidity pools are built on Ethereum or its Layer-2 networks.\n\n"
                "For strategy decisions, Ethereum often has deep liquidity, but gas fees can be higher than some alternatives."
            )
        else:
            answer = (
                "Blockchain is a shared digital ledger that many computers maintain together.\n\n"
                "Example: instead of one bank database, transaction history is verified by a network.\n\n"
                "In DeFi, this allows open financial apps, but users must manage wallet and smart-contract risks carefully."
            )
    else:
        if "apy" in text:
            answer = (
                "APY means Annual Percentage Yield, which is your estimated yearly return.\n\n"
                "Example: a 10% APY on $1,000 suggests about $100 over a year if rates stayed stable.\n\n"
                "In DeFi strategies, net APY matters more because gas and fees can reduce actual returns."
            )
        elif "tvl" in text:
            answer = (
                "TVL means Total Value Locked, or how much money is deposited in a protocol or pool.\n\n"
                "Example: a pool with $200M TVL usually has deeper liquidity than one with $200K.\n\n"
                "For strategy decisions, higher TVL can reduce slippage and improve execution confidence."
            )
        elif "gas" in text:
            answer = (
                "Gas fee is the transaction cost you pay on blockchain networks.\n\n"
                "Example: if migration costs $25 in gas, a small APY gain may not be worth it.\n\n"
                "Gas affects DeFi strategy because frequent moves can eat into your net yield."
            )
        elif "liquidity" in text or "pool" in text:
            answer = (
                "A DeFi pool is a smart-contract vault where users deposit tokens so others can borrow, swap, or trade.\n\n"
                "Example: a USDC lending pool pays depositors yield from borrower interest.\n\n"
                "Pool quality affects strategy through APY, TVL, risk, and gas-adjusted net returns."
            )
        else:
            answer = _fallback_chat_answer(user_message)

    return {
        "answer": answer,
        "recommended_pool": None,
        "reason": "Educational response mode: no pool recommendation requested.",
        "risk": "DeFi has smart-contract, liquidity, and market risks. Returns are not guaranteed.",
        "gas_impact": "Gas is a real cost and should be included when comparing yields.",
        "notes": [
            "Ask a strategy question like 'which pool should I use?' if you want a recommendation.",
        ],
        "question_type": question_type,
    }


def chat_with_gemini(
    user_message: str,
    pool_context: dict | None = None,
    chain: str | None = None,
    context: str | None = None,
) -> dict:
    """Return a concise, data-grounded response for DeFi copilot chat assistant."""
    context_obj = pool_context or {}
    pools = context_obj.get("pools", []) if isinstance(context_obj, dict) else []
    question_type = _classify_question_type(user_message)
    should_recommend = question_type == "strategy"

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
        if not should_recommend:
            return _fallback_non_strategy_answer(user_message, question_type)

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
                "question_type": question_type,
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
            "question_type": question_type,
        }

    model = _get_model()
    if model is None or _client is None:
        return _fallback_structured()

    prompt = f"""
You are a beginner-friendly DeFi and blockchain copilot inside Gas-Aware Yield Optimizer.

CRITICAL RULE:
- Recommend pools ONLY when user explicitly asks for recommendation/strategy (question_type = strategy).
- For all other question types, explain concepts. Do not recommend specific pools.

Question type detected by backend: {question_type}

Question types and behavior:
1) educational: explain clearly with this structure -> Definition, Example, How it affects DeFi strategy.
2) platform: explain using platform logic and formulas when relevant.
   Example formula: Net APY = Gross APY - Gas Impact - Protocol Fees.
3) strategy: use only provided live pool context and return recommendation fields.
4) blockchain: explain core blockchain concepts in simple language.

Data safety:
- Use only the provided context.
- Do NOT invent pools, APY, TVL, gas impact, or migration values.
- If data is missing, clearly say unavailable.
- Never guarantee profits.

Style:
- Short paragraphs, simple language for beginners.
- Avoid jargon unless needed, and explain it.

Return STRICT JSON only with keys:
answer,
recommended_pool (object or null with keys: protocol,pool,token,net_apy,tvl,risk,gas_impact),
reason,
risk,
gas_impact,
notes (array of short strings),
question_type

Rules for recommended_pool:
- If question_type is strategy: choose best option from context and fill recommended_pool.
- Otherwise: recommended_pool must be null.

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
                    if parsed.get("question_type") != question_type:
                        parsed["question_type"] = question_type
                    if not should_recommend:
                        parsed["recommended_pool"] = None
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
                        if parsed.get("question_type") != question_type:
                            parsed["question_type"] = question_type
                        if not should_recommend:
                            parsed["recommended_pool"] = None
                        return parsed
                except Exception:
                    pass
    except Exception:
        logger.exception("Gemini chat generation failed")

    return _fallback_structured()
