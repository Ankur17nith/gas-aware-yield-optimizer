export interface Pool {
  pool_id: string;
  protocol: string;
  token: string;
  symbol: string;
  apy: number;
  tvl: number;
  chain: string;
  pool_meta: string;
  // Computed by net-yield engine
  gross_apy?: number;
  gas_cost_usd?: number;
  gas_impact_pct?: number;
  net_apy?: number;
  profit_30d?: number;
  deposit_gas?: number;
  withdraw_gas?: number;
  gas_gwei?: number;
  eth_price?: number;
  // From ranker
  rank_score?: number;
  trust_score?: number;
  risk_score?: number;
  risk_level?: 'Low' | 'Medium' | 'High';
  rank?: number;
}
