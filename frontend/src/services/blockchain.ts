import { BrowserProvider, JsonRpcSigner } from 'ethers';

let provider: BrowserProvider | null = null;
let signer: JsonRpcSigner | null = null;

export async function setWalletClient(walletClient: any | null) {
  if (!walletClient) {
    provider = null;
    signer = null;
    return;
  }

  provider = new BrowserProvider(walletClient.transport, 'any');
  signer = await provider.getSigner(walletClient.account.address);
}

/**
 * Get the currently connected signer.
 */
export function getSigner(): JsonRpcSigner | null {
  return signer;
}

/**
 * Get the provider.
 */
export function getProvider(): BrowserProvider | null {
  return provider;
}

/**
 * Get the connected wallet address (null if not connected).
 */
export async function getAddress(): Promise<string | null> {
  if (!signer) return null;
  return signer.getAddress();
}

/**
 * Get ETH balance of the connected wallet.
 */
export async function getETHBalance(): Promise<string> {
  if (!provider || !signer) return '0';
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);
  // Convert from wei to ETH, keep 4 decimal places
  return (Number(balance) / 1e18).toFixed(4);
}
