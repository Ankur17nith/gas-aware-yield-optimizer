import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Prediction } from '../types/prediction';

interface PredictionsState {
  predictions: Prediction[];
  loading: boolean;
  error: string | null;
  sources: Record<string, string>;
}

export function usePredictions(autoFetch = true, chain?: string) {
  const [state, setState] = useState<PredictionsState>({
    predictions: [],
    loading: false,
    error: null,
    sources: {},
  });

  const fetchPredictions = useCallback(async (chainOverride?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.getPredictions(chainOverride ?? chain);
      setState({
        predictions: data.predictions,
        loading: false,
        error: null,
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
      fetchPredictions();
    }
  }, [autoFetch, fetchPredictions]);

  return { ...state, fetchPredictions };
}
