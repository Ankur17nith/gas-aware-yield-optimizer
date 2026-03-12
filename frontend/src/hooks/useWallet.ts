import { useState, useEffect, useCallback } from 'react';
import {
  connectWallet as connectWalletService,
  getETHBalance,
  onAccountChange,
  onChainChange,
} from '../services/blockchain';

interface WalletState {
  address: string | null;
  chainId: number | null;
  ethBalance: string;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    ethBalance: '0',
    connected: false,
    loading: false,
    error: null,
  });

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { address, chainId } = await connectWalletService();
      const ethBalance = await getETHBalance();
      setState({
        address,
        chainId,
        ethBalance,
        connected: true,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Failed to connect wallet',
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      ethBalance: '0',
      connected: false,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    onAccountChange((accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState((s) => ({ ...s, address: accounts[0] }));
      }
    });

    onChainChange(() => {
      // Reload on chain change
      window.location.reload();
    });
  }, [disconnect]);

  return { ...state, connect, disconnect };
}
