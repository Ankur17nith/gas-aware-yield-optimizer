const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API Error ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  /** Fetch live pool data */
  getPools: (chain?: string) =>
    request<{ pools: any[] }>('/pools', chain ? { chain } : undefined),

  /** Fetch current gas prices */
  getGas: () => request<any>('/gas'),

  /** Fetch token prices */
  getPrices: () => request<any>('/prices'),

  /** Fetch net yields (gas-aware) for a deposit amount */
  getNetYield: (amount: number, chain?: string) => {
    const params: Record<string, string> = { amount: amount.toString() };
    if (chain) params.chain = chain;
    return request<{ pools: any[]; deposit_amount: number }>('/net-yield', params);
  },

  /** Fetch AI predictions */
  getPredictions: (chain?: string) =>
    request<{ predictions: any[] }>('/predictions', chain ? { chain } : undefined),

  /** Fetch migration recommendation */
  getMigration: (protocol: string, token: string, amount: number, chain?: string) => {
    const params: Record<string, string> = {
      current_protocol: protocol,
      current_token: token,
      amount: amount.toString(),
    };
    if (chain) params.chain = chain;
    return request<any>('/migration', params);
  },

  /** Fetch historical data for charts */
  getHistorical: () => request<{ historical: any[] }>('/historical'),

  /** Health check */
  health: () => request<{ status: string }>('/health'),

  /** Fetch leaderboard */
  getLeaderboard: (limit: number = 10, chain?: string) => {
    const params: Record<string, string> = { limit: limit.toString() };
    if (chain) params.chain = chain;
    return request<{ pools: any[]; total: number }>('/leaderboard', params);
  },

  /** Fetch aggregate stats */
  getStats: (chain?: string) =>
    request<any>('/stats', chain ? { chain } : undefined),

  /** Fetch portfolio simulation */
  getPortfolio: (amount: number, chain?: string) => {
    const params: Record<string, string> = { amount: amount.toString() };
    if (chain) params.chain = chain;
    return request<any>('/portfolio', params);
  },
};
