import { Contract, formatUnits, parseUnits } from 'ethers';
import { ensureWalletProvider, ensureWalletSigner, getProvider, getSigner } from './blockchain';
import type { MigrationParams } from '../types/migration';

// Router ABI (minimal — only the functions we call from the frontend)
const ROUTER_ABI = [
  'function deposit(uint8 protocol, address token, uint256 amount, bytes extraData) external',
  'function withdraw(uint8 protocol, address token, uint256 amount, bytes extraData) external',
  'function migrate((uint8 fromProtocol, uint8 toProtocol, address token, uint256 amount, uint256 minReceived, bytes extraData) params) external',
  'function migratePosition((uint8 fromProtocol, uint8 toProtocol, address token, uint256 amount, uint256 minReceived, bytes extraData) params) external',
  'function rebalance((uint8 fromProtocol, uint8 toProtocol, address token, uint256 amount, uint256 minReceived, bytes extraData) params) external',
  'function getUserDeposits(address user, address token) external view returns (uint256 aaveAmount, uint256 curveAmount, uint256 compoundAmount, uint256 total)',
  'function getSupportedTokens() external view returns (address[])',
  'function getAdapter(uint8 protocol) external view returns (address)',
  'function paused() external view returns (bool)',
  'function feeBps() external view returns (uint256)',
];

// ERC-20 approval ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const ROUTER_STORAGE_KEY = 'yo_router_address';

function normalizeAddress(address: string): string {
  return address.trim();
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function readRuntimeRouterAddress(): string {
  const envAddress = normalizeAddress(
    import.meta.env.VITE_ROUTER_ADDRESS || import.meta.env.NEXT_PUBLIC_ROUTER_ADDRESS || ''
  );
  if (isAddressLike(envAddress)) return envAddress;

  if (typeof window !== 'undefined') {
    const stored = normalizeAddress(window.localStorage.getItem(ROUTER_STORAGE_KEY) || '');
    if (isAddressLike(stored)) return stored;
  }

  return '';
}

export function getRuntimeRouterAddress(): string {
  return readRuntimeRouterAddress();
}

export function setRuntimeRouterAddress(address: string): void {
  const normalized = normalizeAddress(address);
  if (!isAddressLike(normalized)) {
    throw new Error('Invalid router address format');
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ROUTER_STORAGE_KEY, normalized);
  }
}

export function clearRuntimeRouterAddress(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ROUTER_STORAGE_KEY);
  }
}

export interface ContractStatus {
  network: string;
  chainId: number;
  walletAddress: string | null;
  contractAddress: string;
  latestBlock: number;
  lastTransactionHash: string | null;
  userDeposits: {
    token: string;
    total: string;
    aave: string;
    curve: string;
    compound: string;
  }[];
}

let lastTransactionHash: string | null = null;

async function getRouterContract(): Promise<Contract> {
  const signer = await ensureWalletSigner();
  const routerAddress = getRuntimeRouterAddress();
  if (!routerAddress) throw new Error('Router address not configured');
  return new Contract(routerAddress, ROUTER_ABI, signer);
}

async function getTokenContract(tokenAddress: string): Promise<Contract> {
  const signer = await ensureWalletSigner();
  return new Contract(tokenAddress, ERC20_ABI, signer);
}

/**
 * Approve the Router to spend tokens.
 */
export async function approveToken(
  tokenAddress: string,
  amount: string,
  decimals: number = 6
): Promise<string> {
  const routerAddress = getRuntimeRouterAddress();
  if (!routerAddress) throw new Error('Router address not configured');
  const token = await getTokenContract(tokenAddress);
  const amountWei = parseUnits(amount, decimals);
  const tx = await token.approve(routerAddress, amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Deposit tokens into a protocol via the Router.
 */
export async function deposit(
  protocol: number,
  tokenAddress: string,
  amount: string,
  decimals: number = 6
): Promise<string> {
  const router = await getRouterContract();
  const amountWei = parseUnits(amount, decimals);
  const tx = await router.deposit(protocol, tokenAddress, amountWei, '0x');
  const receipt = await tx.wait();
  lastTransactionHash = receipt.hash;
  return receipt.hash;
}

/**
 * Withdraw tokens from a protocol via the Router.
 */
export async function withdraw(
  protocol: number,
  tokenAddress: string,
  amount: string,
  decimals: number = 6
): Promise<string> {
  const router = await getRouterContract();
  const amountWei = parseUnits(amount, decimals);
  const tx = await router.withdraw(protocol, tokenAddress, amountWei, '0x');
  const receipt = await tx.wait();
  lastTransactionHash = receipt.hash;
  return receipt.hash;
}

/**
 * Migrate funds between protocols via the Router.
 */
export async function migrate(params: MigrationParams): Promise<string> {
  const router = await getRouterContract();
  const tx = await router.migrate({
    fromProtocol: params.fromProtocol,
    toProtocol: params.toProtocol,
    token: params.token,
    amount: parseUnits(params.amount, 6),
    minReceived: parseUnits(params.minReceived, 6),
    extraData: '0x',
  });
  const receipt = await tx.wait();
  lastTransactionHash = receipt.hash;
  return receipt.hash;
}

/**
 * Rebalance funds between protocols via the Router.
 */
export async function rebalance(params: MigrationParams): Promise<string> {
  const router = await getRouterContract();
  const tx = await router.rebalance({
    fromProtocol: params.fromProtocol,
    toProtocol: params.toProtocol,
    token: params.token,
    amount: parseUnits(params.amount, 6),
    minReceived: parseUnits(params.minReceived, 6),
    extraData: '0x',
  });
  const receipt = await tx.wait();
  lastTransactionHash = receipt.hash;
  return receipt.hash;
}

/**
 * Alias used by UI actions for readability.
 */
export async function migratePosition(params: MigrationParams): Promise<string> {
  return migrate(params);
}

/**
 * Send a minimal on-chain transaction to verify wallet/network/chain execution.
 */
export async function testSmartContract(): Promise<{ hash: string; status: string; gasUsed: string }> {
  const signer = await ensureWalletSigner();
  const routerAddress = getRuntimeRouterAddress();
  if (!routerAddress) throw new Error('Router address not configured');

  // Send a low-risk transaction to the Router contract itself so MetaMask shows wallet -> router.
  const router = new Contract(routerAddress, ROUTER_ABI, signer);
  const tx = await signer.sendTransaction({
    to: routerAddress,
    value: 0n,
    data: router.interface.encodeFunctionData('feeBps', []),
  });
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('Transaction sent but no receipt returned yet. Please retry in a moment.');
  }
  lastTransactionHash = receipt.hash;

  return {
    hash: receipt.hash,
    status: receipt.status === 1 ? 'success' : 'failed',
    gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : '0',
  };
}

/**
 * Get token balance for connected wallet.
 */
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const token = await getTokenContract(tokenAddress);
  const decimals = await token.decimals();
  const balance = await token.balanceOf(walletAddress);
  return (Number(balance) / 10 ** Number(decimals)).toFixed(2);
}

export async function getContractStatus(walletAddress?: string | null): Promise<ContractStatus> {
  const provider = getProvider() ?? (await ensureWalletProvider());
  const routerAddress = getRuntimeRouterAddress();
  if (!routerAddress) throw new Error('Router address not configured');

  const network = await provider.getNetwork();
  const latestBlock = await provider.getBlockNumber();
  const signer = getSigner();
  const user = walletAddress || (signer ? await signer.getAddress() : null);

  const userDeposits: ContractStatus['userDeposits'] = [];
  if (user) {
    const router = new Contract(routerAddress, ROUTER_ABI, provider);
    const trackedTokens = [
      { token: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { token: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
      { token: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    ];

    for (const t of trackedTokens) {
      const [aaveAmount, curveAmount, compoundAmount, total] = await router.getUserDeposits(user, t.address);
      userDeposits.push({
        token: t.token,
        aave: Number(formatUnits(aaveAmount, 6)).toFixed(2),
        curve: Number(formatUnits(curveAmount, 6)).toFixed(2),
        compound: Number(formatUnits(compoundAmount, 6)).toFixed(2),
        total: Number(formatUnits(total, 6)).toFixed(2),
      });
    }
  }

  return {
    network: network.name,
    chainId: Number(network.chainId),
    walletAddress: user,
    contractAddress: routerAddress,
    latestBlock,
    lastTransactionHash,
    userDeposits,
  };
}
