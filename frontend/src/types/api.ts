export interface GasData {
  safe: number;
  standard: number;
  fast: number;
  base_fee: number;
  unit: string;
  source: string;
}

export interface PriceEntry {
  price: number;
  symbol: string;
  confidence: number;
}

export interface PriceData {
  prices: Record<string, PriceEntry>;
  source: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}
