"""
transaction_utils.py
────────────────────
Utilities for building and estimating transactions against the Router
contract. Used by the backend to provide gas estimates and tx data
to the frontend.
"""

import json
from web3 import Web3
from config import settings


def get_web3() -> Web3:
    return Web3(Web3.HTTPProvider(settings.RPC_URL))


def load_router_abi() -> list:
    abi_path = "../abi/Router.json"
    try:
        with open(abi_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def estimate_deposit_gas(
    token_address: str,
    amount: int,
    protocol: int,  # 0 = AAVE, 1 = CURVE
) -> dict:
    """Estimate gas for a deposit transaction."""
    w3 = get_web3()
    gas_price = w3.eth.gas_price

    # Estimated gas units per protocol
    gas_estimates = {0: 250_000, 1: 350_000}
    estimated_gas = gas_estimates.get(protocol, 300_000)

    gas_cost_wei = estimated_gas * gas_price
    gas_cost_eth = float(Web3.from_wei(gas_cost_wei, "ether"))

    return {
        "estimated_gas_units": estimated_gas,
        "gas_price_gwei": round(float(Web3.from_wei(gas_price, "gwei")), 2),
        "gas_cost_eth": round(gas_cost_eth, 6),
        "gas_cost_usd": None,  # Filled by caller with ETH price
    }


def estimate_migration_gas(
    from_protocol: int,
    to_protocol: int,
) -> dict:
    """Estimate gas for a migration transaction."""
    w3 = get_web3()
    gas_price = w3.eth.gas_price

    withdraw_gas = {0: 200_000, 1: 300_000}
    deposit_gas = {0: 250_000, 1: 350_000}

    estimated_gas = withdraw_gas.get(from_protocol, 250_000) + deposit_gas.get(
        to_protocol, 300_000
    )

    gas_cost_wei = estimated_gas * gas_price
    gas_cost_eth = float(Web3.from_wei(gas_cost_wei, "ether"))

    return {
        "estimated_gas_units": estimated_gas,
        "gas_price_gwei": round(float(Web3.from_wei(gas_price, "gwei")), 2),
        "gas_cost_eth": round(gas_cost_eth, 6),
    }


def build_migration_tx_data(
    from_protocol: int,
    to_protocol: int,
    token_address: str,
    amount: int,
    min_received: int,
    sender: str,
) -> dict | None:
    """Build the calldata for a Router.migrate() transaction."""
    abi = load_router_abi()
    if not abi or not settings.ROUTER_ADDRESS:
        return None

    w3 = get_web3()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(settings.ROUTER_ADDRESS), abi=abi
    )

    try:
        tx = contract.functions.migrate(
            (from_protocol, to_protocol, token_address, amount, min_received, b"")
        ).build_transaction(
            {
                "from": Web3.to_checksum_address(sender),
                "nonce": w3.eth.get_transaction_count(
                    Web3.to_checksum_address(sender)
                ),
                "gas": 600_000,
                "gasPrice": w3.eth.gas_price,
            }
        )
        return tx
    except Exception:
        return None


def get_token_balance(token_address: str, wallet_address: str) -> int:
    """Get the ERC-20 token balance for a wallet."""
    w3 = get_web3()
    erc20_abi = [
        {
            "constant": True,
            "inputs": [{"name": "account", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function",
        }
    ]
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(token_address), abi=erc20_abi
    )
    return contract.functions.balanceOf(
        Web3.to_checksum_address(wallet_address)
    ).call()
