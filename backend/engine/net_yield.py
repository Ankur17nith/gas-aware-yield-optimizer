"""
net_yield.py
────────────
Computes net APY after gas costs for each pool.
Takes into account deposit gas, the user's investment amount,
and annualizes the gas cost impact.
Supports multi-chain gas pricing (L2s are much cheaper).
"""

# Gas units for different operations (estimated)
GAS_ESTIMATES = {
    "Aave": {"approve": 55_000, "deposit": 250_000, "withdraw": 200_000},
    "Compound": {"approve": 55_000, "deposit": 220_000, "withdraw": 180_000},
    "Curve": {"deposit": 350_000, "withdraw": 300_000},
    "Yearn": {"deposit": 300_000, "withdraw": 250_000},
    "Spark": {"deposit": 250_000, "withdraw": 200_000},
    "Morpho Aave": {"deposit": 280_000, "withdraw": 230_000},
}

DEFAULT_GAS = {"approve": 55_000, "deposit": 250_000, "withdraw": 200_000}

# Gas price multiplier relative to Ethereum L1.
# L2s settle on Ethereum but execution gas is dramatically cheaper.
CHAIN_GAS_MULTIPLIER = {
    "Ethereum": 1.0,
    "Arbitrum": 0.01,    # ~100x cheaper than L1
    "Polygon": 0.005,    # ~200x cheaper, uses MATIC
    "Base": 0.008,       # ~125x cheaper than L1
}

# Annual protocol fee estimates in basis points
PROTOCOL_FEE_BPS = {
    "Aave V3": 10,
    "Compound V3": 8,
    "Curve": 20,
    "Yearn": 50,
    "Spark": 10,
    "Morpho Aave": 15,
}


def compute_net_yields(
    pools: list[dict],
    gas_data: dict,
    price_data: dict,
    deposit_amount: float,
) -> list[dict]:
    """
    For each pool, compute:
    - gas_cost_usd: cost of deposit tx in USD
    - protocol_fee_pct: protocol fee percentage
    - net_apy:      gross APY minus annualized gas impact minus protocol fee
    - profit_30d:   projected 30-day profit after gas
    """
    eth_price = price_data.get("prices", {}).get("ETH", {}).get("price", 3000.0)
    gas_gwei = gas_data.get("standard", 20)

    results = []
    for pool in pools:
        protocol = pool["protocol"]
        gross_apy = pool["apy"]

        # Get gas estimate for this protocol
        gas_est = GAS_ESTIMATES.get(protocol, DEFAULT_GAS)
        approve_gas = gas_est.get("approve", DEFAULT_GAS["approve"])
        deposit_gas = gas_est["deposit"]
        withdraw_gas = gas_est["withdraw"]

        approve_plus_deposit_units = approve_gas + deposit_gas
        avg_tx_units = approve_plus_deposit_units / 2
        total_gas_units = deposit_gas + withdraw_gas

        # Apply chain-specific gas multiplier (L2s are much cheaper)
        pool_chain = pool.get("chain", "Ethereum")
        chain_multiplier = CHAIN_GAS_MULTIPLIER.get(pool_chain, 1.0)

        # Gas cost in ETH then USD
        avg_tx_cost_eth = (avg_tx_units * gas_gwei * chain_multiplier) / 1e9
        avg_tx_cost_usd = round(avg_tx_cost_eth * eth_price, 2)
        roundtrip_cost_eth = (total_gas_units * gas_gwei * chain_multiplier) / 1e9
        roundtrip_cost_usd = round(roundtrip_cost_eth * eth_price, 2)

        # Gas impact percent follows: (Estimated Gas Cost / Deposit Amount) * 100.
        if deposit_amount > 0:
            gas_impact_pct = (avg_tx_cost_usd / deposit_amount) * 100
        else:
            gas_impact_pct = 0

        protocol_fee_bps = PROTOCOL_FEE_BPS.get(protocol, 15)
        protocol_fee_pct = protocol_fee_bps / 100

        # Net APY = Gross APY - Gas Cost Impact - Protocol Fee
        net_apy = round(gross_apy - gas_impact_pct - protocol_fee_pct, 4)

        # 30-day profit projection
        daily_rate = net_apy / 365 / 100
        profit_30d = round(deposit_amount * daily_rate * 30, 2)

        results.append(
            {
                **pool,
                "gross_apy": gross_apy,
                "gas_cost_usd": avg_tx_cost_usd,
                "approve_gas": approve_gas,
                "approve_cost_usd": round((approve_gas * gas_gwei * chain_multiplier / 1e9) * eth_price, 2),
                "deposit_cost_usd": round((deposit_gas * gas_gwei * chain_multiplier / 1e9) * eth_price, 2),
                "roundtrip_cost_usd": roundtrip_cost_usd,
                "gas_impact_pct": round(gas_impact_pct, 4),
                "protocol_fee_bps": protocol_fee_bps,
                "protocol_fee_pct": round(protocol_fee_pct, 4),
                "net_apy": net_apy,
                "profit_30d": profit_30d,
                "deposit_gas": deposit_gas,
                "withdraw_gas": withdraw_gas,
                "gas_gwei": gas_gwei,
                "eth_price": eth_price,
            }
        )

    return results
