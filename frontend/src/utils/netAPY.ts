/**
 * Compute net APY after gas costs (client-side utility).
 */
export function computeNetAPY(
  grossAPY: number,
  gasCostUSD: number,
  depositAmount: number
): number {
  if (depositAmount <= 0) return grossAPY;
  const gasImpact = (gasCostUSD / depositAmount) * 100;
  return Math.round((grossAPY - gasImpact) * 10000) / 10000;
}

/**
 * Compute 30-day profit projection.
 */
export function compute30DayProfit(
  netAPY: number,
  depositAmount: number
): number {
  const dailyRate = netAPY / 365 / 100;
  return Math.round(depositAmount * dailyRate * 30 * 100) / 100;
}
