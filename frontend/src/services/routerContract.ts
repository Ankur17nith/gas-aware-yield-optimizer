import { Contract, parseUnits } from 'ethers';
import { getSigner } from './blockchain';
import type { MigrationParams } from '../types/migration';

// Router ABI (minimal — only the functions we call from the frontend)
const ROUTER_ABI = [
  'function deposit(uint8 protocol, address token, uint256 amount, bytes extraData) external',
  'function withdraw(uint8 protocol, address token, uint256 amount, bytes extraData) external',
  'function migrate((uint8 fromProtocol, uint8 toProtocol, address token, uint256 amount, uint256 minReceived, bytes extraData) params) external',
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

const ROUTER_ADDRESS = import.meta.env.VITE_ROUTER_ADDRESS || '';

function getRouterContract(): Contract {
  const signer = getSigner();
  if (!signer) throw new Error('Wallet not connected');
  if (!ROUTER_ADDRESS) throw new Error('Router address not configured');
  return new Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
}

function getTokenContract(tokenAddress: string): Contract {
  const signer = getSigner();
  if (!signer) throw new Error('Wallet not connected');
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
  const token = getTokenContract(tokenAddress);
  const amountWei = parseUnits(amount, decimals);
  const tx = await token.approve(ROUTER_ADDRESS, amountWei);
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
  const router = getRouterContract();
  const amountWei = parseUnits(amount, decimals);
  const tx = await router.deposit(protocol, tokenAddress, amountWei, '0x');
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Migrate funds between protocols via the Router.
 */
export async function migrate(params: MigrationParams): Promise<string> {
  const router = getRouterContract();
  const tx = await router.migrate({
    fromProtocol: params.fromProtocol,
    toProtocol: params.toProtocol,
    token: params.token,
    amount: parseUnits(params.amount, 6),
    minReceived: parseUnits(params.minReceived, 6),
    extraData: '0x',
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Get token balance for connected wallet.
 */
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const token = getTokenContract(tokenAddress);
  const decimals = await token.decimals();
  const balance = await token.balanceOf(walletAddress);
  return (Number(balance) / 10 ** Number(decimals)).toFixed(2);
}
