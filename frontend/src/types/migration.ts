export interface MigrationRecommendation {
  recommendation: 'migrate' | 'consider' | 'hold';
  reason: string;
  current: PoolSummary | null;
  target: PoolSummary | null;
  migration_cost_usd?: number;
  net_gain_30d?: number;
  breakeven_days?: number;
  current_profit_30d?: number;
  target_profit_30d?: number;
  gas_threshold_gwei?: number;
  current_gas_gwei?: number;
  gas_optimized?: boolean;
  optimal_gas_window?: string;
  auto_rebalance_recommended?: boolean;
}

export interface PoolSummary {
  protocol: string;
  token: string;
  gross_apy: number;
  net_apy: number;
  gas_cost_usd: number;
  tvl: number;
  pool_id: string;
}

export interface MigrationParams {
  fromProtocol: number;
  toProtocol: number;
  token: string;
  amount: string;
  minReceived: string;
}
