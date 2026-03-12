export interface Prediction {
  pool_id: string;
  protocol: string;
  token: string;
  current_apy: number;
  predicted_apy_30d: number;
  apy_upper: number;
  apy_lower: number;
  trend: number;
  momentum: number;
  confidence: 'high' | 'medium' | 'low';
  direction: 'up' | 'down' | 'stable';
}
