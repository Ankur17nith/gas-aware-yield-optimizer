"""
contract_listener.py
────────────────────
Listens for on-chain events from the Router contract.
Provides helpers to watch for Deposited, Withdrawn, and Migrated events.
"""

import json
import asyncio
from web3 import Web3
from config import settings


def get_web3() -> Web3:
    return Web3(Web3.HTTPProvider(settings.RPC_URL))


def load_router_abi() -> list:
    """Load the Router ABI from the abi/ folder."""
    abi_path = "../abi/Router.json"
    try:
        with open(abi_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def get_router_contract(w3: Web3):
    """Get an instance of the Router contract."""
    abi = load_router_abi()
    if not settings.ROUTER_ADDRESS or not abi:
        return None
    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.ROUTER_ADDRESS), abi=abi
    )


async def listen_for_events(callback, poll_interval: int = 12):
    """
    Poll for new Router events (Deposited, Withdrawn, Migrated).
    Calls `callback(event_name, event_data)` for each new event.
    """
    w3 = get_web3()
    contract = get_router_contract(w3)
    if not contract:
        return

    last_block = w3.eth.block_number

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block <= last_block:
                await asyncio.sleep(poll_interval)
                continue

            for event_name in ["Deposited", "Withdrawn", "Migrated"]:
                try:
                    event_filter = getattr(contract.events, event_name)
                    logs = event_filter.get_logs(
                        fromBlock=last_block + 1, toBlock=current_block
                    )
                    for log in logs:
                        await callback(event_name, dict(log.args))
                except Exception:
                    continue

            last_block = current_block

        except Exception:
            pass

        await asyncio.sleep(poll_interval)
