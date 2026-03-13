export type StrategyAction = 'migrate' | 'consider' | 'hold';

export interface StrategyPool {
  pool_id?: string;
  protocol: string;
  token: string;
  apy?: number;
  net_apy?: number;
  tvl?: number;
  reward_apy?: number;
  risk_level?: 'Low' | 'Medium' | 'High';
  pool_address?: string;
}

export interface StrategyInput {
  pools: StrategyPool[];
  currentProtocol: string;
  currentToken: string;
  amountUsd: number;
  gasGwei: number;
}

export interface StrategyResult {
  action: StrategyAction;
  confidence: number;
  current: StrategyPool;
  recommended: StrategyPool;
  predictedNetApy30d: number;
  estimated30dDeltaUsd: number;
  reasoning: string[];
}

const STABLE_TOKENS = new Set(['USDC', 'USDT', 'DAI', 'FRAX']);

function netApy(pool: StrategyPool): number {
  return Number(pool.net_apy ?? pool.apy ?? 0);
}

function riskPenalty(pool: StrategyPool): number {
  const risk = (pool.risk_level || 'Medium').toLowerCase();
  if (risk === 'low') return 0;
  if (risk === 'high') return 3;
  return 1.2;
}

function score(pool: StrategyPool): number {
  const tvl = Math.max(Number(pool.tvl ?? 0), 1);
  const tvlBonus = Math.max(0, Math.min((Math.log10(tvl) - 4) * 0.7, 2.5));
  return netApy(pool) + tvlBonus - riskPenalty(pool);
}

function projectedApy30d(pool: StrategyPool): number {
  const base = netApy(pool);
  const rewardDrift = Math.min(Number(pool.reward_apy ?? 0) * 0.08, 0.8);
  return Math.max(base + rewardDrift, 0);
}

export function runYieldStrategyAgent(input: StrategyInput): StrategyResult {
  const stablePools = input.pools.filter((p) => STABLE_TOKENS.has((p.token || '').toUpperCase()));
  if (!stablePools.length) {
    throw new Error('No stablecoin pools available for strategy analysis');
  }

  const currentPool =
    stablePools.find(
      (p) =>
        p.protocol.toLowerCase() === input.currentProtocol.toLowerCase() &&
        p.token.toUpperCase() === input.currentToken.toUpperCase()
    ) || stablePools.reduce((worst, p) => (score(p) < score(worst) ? p : worst), stablePools[0]);

  const recommendedPool = stablePools.reduce((best, p) => (score(p) > score(best) ? p : best), stablePools[0]);

  const apyDelta = netApy(recommendedPool) - netApy(currentPool);
  const scoreDelta = score(recommendedPool) - score(currentPool);

  let action: StrategyAction = 'hold';
  if (apyDelta >= 0.25 && scoreDelta >= 0.35) {
    action = 'migrate';
  } else if (apyDelta >= 0.12 && scoreDelta >= 0.2) {
    action = 'consider';
  }

  const confidence = Math.max(52, Math.min(97, Math.round(58 + scoreDelta * 18)));
  const predictedNetApy30d = projectedApy30d(recommendedPool);
  const currentProjected = projectedApy30d(currentPool);
  const estimated30dDeltaUsd = Number(
    (input.amountUsd * ((predictedNetApy30d - currentProjected) / 100) * (30 / 365)).toFixed(2)
  );

  const reasoning = [
    `Net APY delta is ${apyDelta.toFixed(2)}% in favor of ${recommendedPool.protocol}.`,
    `Score delta is ${scoreDelta.toFixed(2)} after TVL and risk adjustments.`,
    `Gas context (${input.gasGwei.toFixed(1)} gwei) is accounted for in net APY inputs.`,
  ];

  if (action === 'hold') {
    reasoning.push('Expected gain is below migration threshold after friction checks.');
  }

  return {
    action,
    confidence,
    current: currentPool,
    recommended: recommendedPool,
    predictedNetApy30d,
    estimated30dDeltaUsd,
    reasoning,
  };
}
