import { BrowserProvider, JsonRpcSigner } from 'ethers';

let provider: BrowserProvider | null = null;
let signer: JsonRpcSigner | null = null;

function isEip1193Provider(value: unknown): value is { request: (...args: any[]) => Promise<any> } {
  return Boolean(value) && typeof (value as any).request === 'function';
}

function getInjectedProvider(): { request: (...args: any[]) => Promise<any> } | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as Window & { ethereum?: unknown }).ethereum;
  return isEip1193Provider(eth) ? eth : null;
}

export async function setWalletClient(walletClient: any | null) {
  if (!walletClient) {
    provider = null;
    signer = null;
    return;
  }

  const transportProvider = walletClient?.transport?.value ?? walletClient?.transport;
  if (isEip1193Provider(transportProvider)) {
    provider = new BrowserProvider(transportProvider, 'any');
    signer = await provider.getSigner(walletClient.account.address);
    return;
  }

  const injected = getInjectedProvider();
  if (injected) {
    provider = new BrowserProvider(injected, 'any');
    await provider.send('eth_requestAccounts', []);
    signer = await provider.getSigner(walletClient.account.address);
    return;
  }

  provider = null;
  signer = null;
}

export async function connectWallet() {
  const injected = getInjectedProvider();
  if (!injected) {
    throw new Error('MetaMask not installed');
  }

  provider = new BrowserProvider(injected, 'any');
  await provider.send('eth_requestAccounts', []);
  signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

export async function ensureWalletProvider(): Promise<BrowserProvider> {
  if (provider) return provider;

  const injected = getInjectedProvider();
  if (!injected) {
    throw new Error('Wallet provider not connected');
  }

  provider = new BrowserProvider(injected, 'any');
  return provider;
}

export async function ensureWalletSigner(): Promise<JsonRpcSigner> {
  if (signer) return signer;

  const ensuredProvider = await ensureWalletProvider();
  const accounts = await ensuredProvider.listAccounts();
  if (!accounts.length) {
    throw new Error('Wallet not connected');
  }

  signer = await ensuredProvider.getSigner();
  return signer;
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
