import { useState, useCallback } from 'react';
import { api } from '../services/api';
import { migrate as migrateOnChain } from '../services/routerContract';
import type { MigrationRecommendation } from '../types/migration';

interface MigrationState {
  recommendation: MigrationRecommendation | null;
  loading: boolean;
  error: string | null;
  txHash: string | null;
  txLoading: boolean;
}

export function useMigration() {
  const [state, setState] = useState<MigrationState>({
    recommendation: null,
    loading: false,
    error: null,
    txHash: null,
    txLoading: false,
  });

  const fetchRecommendation = useCallback(
    async (
      protocol: string,
      token: string,
      amount: number,
      chain?: string,
      gasThresholdGwei?: number
    ) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await api.getMigration(protocol, token, amount, chain, gasThresholdGwei);
        setState((s) => ({
          ...s,
          recommendation: data,
          loading: false,
          error: null,
        }));
      } catch (err: any) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message || 'Unable to fetch data. Retrying...',
        }));
      }
    },
    []
  );

  const executeMigration = useCallback(
    async (
      fromProtocol: number,
      toProtocol: number,
      tokenAddress: string,
      amount: string,
      minReceived: string
    ) => {
      setState((s) => ({ ...s, txLoading: true, error: null, txHash: null }));
      try {
        const hash = await migrateOnChain({
          fromProtocol,
          toProtocol,
          token: tokenAddress,
          amount,
          minReceived,
        });
        setState((s) => ({
          ...s,
          txHash: hash,
          txLoading: false,
        }));
        return hash;
      } catch (err: any) {
        setState((s) => ({
          ...s,
          txLoading: false,
          error: err.message || 'Migration transaction failed',
        }));
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      recommendation: null,
      loading: false,
      error: null,
      txHash: null,
      txLoading: false,
    });
  }, []);

  return { ...state, fetchRecommendation, executeMigration, reset };
}
