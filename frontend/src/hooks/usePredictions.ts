import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Prediction } from '../types/prediction';

interface PredictionsState {
  predictions: Prediction[];
  loading: boolean;
  error: string | null;
}

export function usePredictions(autoFetch = true, chain?: string) {
  const [state, setState] = useState<PredictionsState>({
    predictions: [],
    loading: false,
    error: null,
  });

  const fetchPredictions = useCallback(async (chainOverride?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.getPredictions(chainOverride ?? chain);
      setState({
        predictions: data.predictions,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Failed to fetch predictions',
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
