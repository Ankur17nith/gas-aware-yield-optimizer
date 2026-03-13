import { BrowserProvider, JsonRpcSigner } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

let provider: BrowserProvider | null = null;
let signer: JsonRpcSigner | null = null;

/**
 * Connect to MetaMask or any injected wallet.
 */
export async function connectWallet(): Promise<{
  address: string;
  chainId: number;
}> {
  if (!window.ethereum) {
    throw new Error('No injected wallet detected. Use Connect Wallet to continue.');
  }

  provider = new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  return { address, chainId };
}

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

/**
 * Listen for account/chain changes.
 */
export function onAccountChange(callback: (accounts: string[]) => void) {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', callback);
  }
}

export function onChainChange(callback: (chainId: string) => void) {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', callback);
  }
}
