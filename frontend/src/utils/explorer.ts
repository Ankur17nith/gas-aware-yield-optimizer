const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  8453: 'https://basescan.org',
};

export function getExplorerBase(chainId?: number | null): string {
  if (!chainId) return EXPLORERS[1];
  return EXPLORERS[chainId] || EXPLORERS[1];
}

export function txExplorerUrl(hash: string, chainId?: number | null): string {
  return `${getExplorerBase(chainId)}/tx/${hash}`;
}

export function addressExplorerUrl(address: string, chainId?: number | null): string {
  return `${getExplorerBase(chainId)}/address/${address}`;
}
