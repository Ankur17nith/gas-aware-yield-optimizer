import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── Server ──
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")

    # ── Blockchain ──
    RPC_URL: str = os.getenv("RPC_URL", "https://eth.llamarpc.com")
    CHAIN_ID: int = int(os.getenv("CHAIN_ID", "1"))

    # ── Contract addresses (Ethereum mainnet) ──
    ROUTER_ADDRESS: str = os.getenv("ROUTER_ADDRESS", "")
    AAVE_POOL_ADDRESS: str = os.getenv(
        "AAVE_POOL_ADDRESS", "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
    )

    # ── API Keys ──
    ETHERSCAN_API_KEY: str = os.getenv("ETHERSCAN_API_KEY", "")
    COINGECKO_API_KEY: str = os.getenv("COINGECKO_API_KEY", "")

    # ── Cache ──
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "45"))

    # ── AI Model ──
    MODEL_PATH: str = os.getenv("MODEL_PATH", "ai_engine/models/yield_model.pkl")

    # ── Stablecoin addresses (Ethereum mainnet) ──
    STABLECOINS: dict[str, str] = {
        "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    }

    # ── DefiLlama ──
    DEFILLAMA_YIELDS_URL: str = "https://yields.llama.fi/pools"
    DEFILLAMA_PRICES_URL: str = "https://coins.llama.fi/prices/current"

    # ── Etherscan Gas ──
    ETHERSCAN_GAS_URL: str = "https://api.etherscan.io/api"


settings = Settings()
