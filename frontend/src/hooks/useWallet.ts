import { useEffect, useMemo, useCallback } from 'react';
import { useAccount, useBalance, useChainId, useConnect, useDisconnect, useWalletClient } from 'wagmi';
import { formatUnits } from 'viem';
import { setWalletClient } from '../services/blockchain';

interface WalletState {
  address: string | null;
  chainId: number | null;
  ethBalance: string;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: balanceData } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    setWalletClient(walletClient ?? null);
  }, [walletClient]);

  const connect = useCallback(async () => {
    const connector = connectors.find((c) => c.type === 'injected') || connectors[0];
    if (!connector) {
      throw new Error('No wallet connector available.');
    }
    await connectAsync({ connector });
  }, [connectAsync, connectors]);

  const disconnect = useCallback(async () => {
    await disconnectAsync();
    await setWalletClient(null);
  }, [disconnectAsync]);

  return useMemo(
    () => ({
      address: address ?? null,
      chainId: chainId ?? null,
      ethBalance: balanceData
        ? Number(formatUnits(balanceData.value, balanceData.decimals)).toFixed(4)
        : '0',
      connected: isConnected,
      loading: isConnecting,
      error: null,
      connect,
      disconnect,
    } satisfies WalletState & { connect: () => Promise<void>; disconnect: () => Promise<void> }),
    [address, chainId, balanceData, isConnected, isConnecting, connect, disconnect]
  );
}
