import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Pool } from '../types/pool';

const TARGET_STABLES = new Set(['USDC', 'USDT', 'DAI']);
const SAFE_APY_MAX = 100;

function normalizePoolName(pool: Pool): string {
  const candidate = (pool.pool_name || pool.pool_meta || '').trim();
  if (!candidate) return 'Standard Pool';
  return candidate;
}

function processPools(rawPools: Pool[]): Pool[] {
  const uniquePools = Object.values(
    rawPools.reduce<Record<string, Pool>>((acc, pool) => {
      const id = pool.pool_id || `${pool.protocol}-${pool.token}-${pool.chain}-${pool.pool_meta || ''}`;
      acc[id] = {
        ...pool,
        pool_id: id,
        pool_name: normalizePoolName(pool),
      };
      return acc;
    }, {})
  );

  return uniquePools
    .filter((pool) => TARGET_STABLES.has((pool.token || pool.symbol || '').toUpperCase()))
    .filter((pool) => {
      const gross = Number(pool.gross_apy ?? pool.apy ?? pool.raw_apy ?? 0);
      return Number.isFinite(gross) && gross < SAFE_APY_MAX;
    });
}

interface PoolsState {
  pools: Pool[];
  loading: boolean;
  error: string | null;
  depositAmount: number;
  sources: Record<string, string>;
}

export function usePools(autoFetch = true, chain?: string) {
  const [state, setState] = useState<PoolsState>({
    pools: [],
    loading: false,
    error: null,
    depositAmount: 10000,
    sources: {},
  });

  const fetchPools = useCallback(async (amount: number = 10000, chainOverride?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.getPools(chainOverride ?? chain);
      const processed = processPools(data.pools || []);
      setState({
        pools: processed,
        loading: false,
        error: null,
        depositAmount: amount,
        sources: data.sources || {},
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Unable to fetch data. Retrying...',
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
