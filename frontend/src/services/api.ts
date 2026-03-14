const PROD_API_URL = 'https://gas-aware-yield-optimizer.onrender.com';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return PROD_API_URL;
  }

  return '/api';
}

const BASE_URL = getApiBaseUrl();

export interface AiAgentStrategyResponse {
  agent: {
    name: string;
    framework: string;
    mode: string;
  };
  action: 'migrate' | 'consider' | 'hold';
  confidence: number;
  current: any;
  recommended: any;
  predicted_net_apy_30d: number;
  estimated_30d_delta_usd: number;
  reasoning: string[];
  explanation?: string;
  onchain_trigger?: {
    supported: boolean;
    method?: string;
    status?: string;
  };
  sources?: Record<string, string>;
}

export interface AiExplainStrategyResponse {
  explanation: string;
}

export interface AiChatResponse {
  answer: string;
  question_type?: 'educational' | 'platform' | 'strategy' | 'blockchain';
  recommended_pool?: {
    protocol?: string;
    pool?: string;
    token?: string;
    net_apy?: number;
    tvl?: number;
    risk?: string;
    gas_impact?: number;
  } | null;
  reason?: string;
  risk?: string;
  gas_impact?: string;
  migration_advice?: string;
  notes?: string[];
  context_used?: {
    pools_count?: number;
    chain?: string;
  };
}

async function request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const isAbsoluteBase = /^https?:\/\//.test(BASE_URL);
  const url = isAbsoluteBase
    ? new URL(`${BASE_URL}${endpoint}`)
    : new URL(`${BASE_URL}${endpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.text();
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error(`API Error ${res.status} from ${url.pathname}: ${body || 'Unknown backend error'}`);
      }

      return res.json();
    } catch (error) {
      lastNetworkError = error;
      const isLastAttempt = attempt === MAX_RETRIES;
      const isHttpError = error instanceof Error && error.message.startsWith('API Error');

      if (isHttpError || isLastAttempt) {
        break;
      }

      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  if (lastNetworkError instanceof Error && lastNetworkError.message.startsWith('API Error')) {
    throw lastNetworkError;
  }

  const message = lastNetworkError instanceof Error ? lastNetworkError.message : 'Network request failed';
  throw new Error(
    `Unable to fetch data. Retrying was attempted, but backend is still unreachable at ${BASE_URL}: ${message}`
  );
}

async function postRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const isAbsoluteBase = /^https?:\/\//.test(BASE_URL);
  const url = isAbsoluteBase
    ? new URL(`${BASE_URL}${endpoint}`)
    : new URL(`${BASE_URL}${endpoint}`, window.location.origin);

  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const raw = await res.text();
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error(`API Error ${res.status} from ${url.pathname}: ${raw || 'Unknown backend error'}`);
      }

      return res.json();
    } catch (error) {
      lastNetworkError = error;
      const isLastAttempt = attempt === MAX_RETRIES;
      const isHttpError = error instanceof Error && error.message.startsWith('API Error');

      if (isHttpError || isLastAttempt) {
        break;
      }

      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  if (lastNetworkError instanceof Error && lastNetworkError.message.startsWith('API Error')) {
    throw lastNetworkError;
  }

  const message = lastNetworkError instanceof Error ? lastNetworkError.message : 'Network request failed';
  throw new Error(
    `Unable to fetch data. Retrying was attempted, but backend is still unreachable at ${BASE_URL}: ${message}`
  );
}

export const api = {
  /** Fetch live pool data */
  getPools: (chain?: string) =>
    request<{ pools: any[]; sources?: Record<string, string> }>('/pools', chain ? { chain } : undefined),

  /** Fetch current gas prices */
  getGas: () => request<any>('/gas'),

  /** Fetch token prices */
  getPrices: () => request<any>('/prices'),

  /** Fetch net yields (gas-aware) for a deposit amount */
  getNetYield: (amount: number, chain?: string) => {
    const params: Record<string, string> = { amount: amount.toString() };
    if (chain) params.chain = chain;
    return request<{ pools: any[]; deposit_amount: number; sources?: Record<string, string> }>('/net-yield', params);
  },

  /** Fetch AI predictions */
  getPredictions: (chain?: string) =>
    request<{ predictions: any[]; sources?: Record<string, string> }>('/predictions', chain ? { chain } : undefined),

  /** Fetch migration recommendation */
  getMigration: (
    protocol: string,
    token: string,
    amount: number,
    chain?: string,
    gasThresholdGwei?: number
  ) => {
    const params: Record<string, string> = {
      current_protocol: protocol,
      current_token: token,
      amount: amount.toString(),
    };
    if (gasThresholdGwei !== undefined) params.gas_threshold_gwei = gasThresholdGwei.toString();
    if (chain) params.chain = chain;
    return request<any>('/migration', params);
  },

  /** Check auto-rebalance recommendation */
  getAutoRebalance: (
    protocol: string,
    token: string,
    amount: number,
    gasThreshold: number,
    chain?: string
  ) => {
    const params: Record<string, string> = {
      current_protocol: protocol,
      current_token: token,
      amount: amount.toString(),
      gas_threshold_gwei: gasThreshold.toString(),
    };
    if (chain) params.chain = chain;
    return request<any>('/auto-rebalance', params);
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

  /** Fetch autonomous AI strategy recommendation */
  getAiAgentStrategy: (
    currentProtocol: string,
    currentToken: string,
    amount: number,
    chain?: string
  ) => {
    const params: Record<string, string> = {
      current_protocol: currentProtocol,
      current_token: currentToken,
      amount: amount.toString(),
    };
    if (chain) params.chain = chain;
    return request<AiAgentStrategyResponse>('/ai-agent/strategy', params);
  },

  /** Fetch Gemini-generated explanation for selected strategy */
  getAiExplainStrategy: (
    protocol: string,
    pool: string,
    token: string,
    apy: number,
    tvl: number,
    chain?: string,
    confidence?: number
  ) => {
    const params: Record<string, string> = {
      protocol,
      pool,
      token,
      apy: apy.toString(),
      tvl: tvl.toString(),
    };
    if (chain) params.chain = chain;
    if (confidence !== undefined) params.confidence = confidence.toString();
    return request<AiExplainStrategyResponse>('/ai/explain-strategy', params);
  },

  /** Chat with beginner-friendly Gemini assistant */
  chatWithAssistant: (
    message: string,
    chain?: string,
    context?: string,
    amount?: number,
    currentProtocol?: string,
    currentToken?: string
  ) =>
    postRequest<AiChatResponse>('/ai/chat', {
      message,
      chain,
      context,
      amount,
      current_protocol: currentProtocol,
      current_token: currentToken,
    }),

  /** Fetch real-time assistant grounding context for debug/demo visibility */
  getAssistantContext: (
    amount: number,
    chain?: string,
    currentProtocol: string = 'aave',
    currentToken: string = 'USDC'
  ) => {
    const params: Record<string, string> = {
      amount: amount.toString(),
      current_protocol: currentProtocol,
      current_token: currentToken,
    };
    if (chain) params.chain = chain;
    return request<any>('/assistant/context', params);
  },
};
