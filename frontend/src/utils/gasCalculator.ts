/**
 * Gas cost estimation utilities (client-side).
 */

const GAS_ESTIMATES: Record<string, { deposit: number; withdraw: number }> = {
  'Aave V3': { deposit: 250_000, withdraw: 200_000 },
  'Compound V3': { deposit: 220_000, withdraw: 180_000 },
  Curve: { deposit: 350_000, withdraw: 300_000 },
  Yearn: { deposit: 300_000, withdraw: 250_000 },
  Spark: { deposit: 250_000, withdraw: 200_000 },
  'Morpho Aave': { deposit: 280_000, withdraw: 230_000 },
};

const DEFAULT_GAS = { deposit: 250_000, withdraw: 200_000 };

/**
 * Calculate total gas cost in USD for a deposit+withdraw round trip.
 */
export function calculateGasCostUSD(
  protocol: string,
  gasGwei: number,
  ethPrice: number
): number {
  const est = GAS_ESTIMATES[protocol] ?? DEFAULT_GAS;
  const totalGasUnits = est.deposit + est.withdraw;
  const gasCostETH = (totalGasUnits * gasGwei) / 1e9;
  return Math.round(gasCostETH * ethPrice * 100) / 100;
}

/**
 * Get gas units for a specific operation.
 */
export function getGasEstimate(
  protocol: string,
  operation: 'deposit' | 'withdraw'
): number {
  const est = GAS_ESTIMATES[protocol] ?? DEFAULT_GAS;
  return est[operation];
}
