import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Pool } from '../types/pool';

interface PoolsState {
  pools: Pool[];
  loading: boolean;
  error: string | null;
  depositAmount: number;
}

export function usePools(autoFetch = true, chain?: string) {
  const [state, setState] = useState<PoolsState>({
    pools: [],
    loading: false,
    error: null,
    depositAmount: 10000,
  });

  const fetchPools = useCallback(async (amount: number = 10000, chainOverride?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.getNetYield(amount, chainOverride ?? chain);
      setState({
        pools: data.pools,
        loading: false,
        error: null,
        depositAmount: data.deposit_amount,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Failed to fetch pools',
      }));
    }
  }, [chain]);

  useEffect(() => {
    if (autoFetch) {
      fetchPools();
    }
  }, [autoFetch, fetchPools]);

  return { ...state, fetchPools };
}
