import { AgentBuilder, createTool, collectTextFrom } from "@iqai/adk";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const ALLOWED_ACTIONS = new Set(["migrate", "consider", "hold"]);

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function pickJsonBlock(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  return text.slice(start, end + 1);
}

function parseJsonSafely(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    const block = pickJsonBlock(text);
    if (!block) return null;
    try {
      return JSON.parse(block);
    } catch {
      return null;
    }
  }
}

function normalizeStrategyOutput(raw, input, runtimeStatus = "ok") {
  const parsed = asObject(raw);
  const action = String(parsed.action || "hold").toLowerCase();
  const normalizedAction = ALLOWED_ACTIONS.has(action) ? action : "hold";

  const confidence = clamp(Math.round(safeNumber(parsed.confidence, 60)), 0, 100);
  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.map((line) => String(line)).filter(Boolean)
    : ["ADK agent completed analysis with external market tools."];

  const current = asObject(parsed.current);
  const recommended = asObject(parsed.recommended);

  return {
    agent: {
      name: "IQ Yield Strategy Agent",
      framework: "@iqai/adk",
      mode: "autonomous",
    },
    action: normalizedAction,
    confidence,
    current,
    recommended,
    predicted_net_apy_30d: safeNumber(parsed.predicted_net_apy_30d),
    estimated_30d_delta_usd: safeNumber(parsed.estimated_30d_delta_usd),
    reasoning,
    explanation: String(parsed.explanation || ""),
    onchain_trigger: {
      supported: false,
      method: "migrate(address fromAdapter,address toAdapter,address token,uint256 amount,bytes data)",
      status: "requires_user_signature",
      tx_plan: asObject(parsed.onchain_trigger?.tx_plan),
    },
    sources: {
      input_pools: "DefiLlama via backend aggregator",
      prices: "CoinGecko/DefiLlama via backend aggregator",
      gas: "Etherscan/RPC via backend aggregator",
      ranking: "adk-tool-driven-reasoning-v1",
    },
    meta: {
      model: String(process.env.ADK_MODEL || "gemini-2.5-flash"),
      chain: String(input.chain || "ethereum"),
      runtime_status: runtimeStatus,
    },
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request failed (${res.status}) ${url}: ${body}`);
  }
  return res.json();
}

function createMarketSnapshotTool(apiBaseUrl) {
  return createTool({
    name: "fetch_market_snapshot",
    description:
      "Fetches live ranked stablecoin pools, gas prices, and token prices from backend APIs.",
    fn: async (args) => {
      const amount = safeNumber(args?.amountUsd, 10000);
      const chain = String(args?.chain || "ethereum");
      const [netYield, gas, prices] = await Promise.all([
        fetchJson(`${apiBaseUrl}/net-yield?amount=${encodeURIComponent(amount)}&chain=${encodeURIComponent(chain)}`),
        fetchJson(`${apiBaseUrl}/gas`),
        fetchJson(`${apiBaseUrl}/prices`),
      ]);

      const rankedPools = Array.isArray(netYield?.pools) ? netYield.pools : [];
      const stable = rankedPools
        .filter((p) => ["USDC", "USDT", "DAI", "FRAX"].includes(String(p?.token || "").toUpperCase()))
        .slice(0, 12);

      return {
        amount,
        chain,
        gas,
        prices,
        top_stable_pools: stable,
      };
    },
  });
}

function createTxPlanTool(routerAddress) {
  return createTool({
    name: "build_router_tx_plan",
    description:
      "Builds a non-custodial migration transaction plan for the frontend wallet signer. Use when action is migrate or consider.",
    fn: async (args) => {
      const token = String(args?.token || "USDC");
      const protocol = String(args?.targetProtocol || "aave");
      const amount = safeNumber(args?.amountUsd, 10000);
      return {
        required_user_signature: true,
        router: routerAddress || "UNCONFIGURED_ROUTER",
        action: "prepare_migration",
        method: "migrate(address fromAdapter,address toAdapter,address token,uint256 amount,bytes data)",
        notes: [
          "Frontend wallet signs and sends the transaction.",
          "Backend does not custody private keys.",
        ],
        params_preview: {
          target_protocol: protocol,
          token,
          amount_usd: amount,
        },
      };
    },
  });
}

async function runAdkStrategy(input) {
  const apiBaseUrl = String(input.apiBaseUrl || process.env.ADK_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, "");
  const model = String(process.env.ADK_MODEL || "gemini-2.5-flash");
  const routerAddress = String(process.env.VITE_ROUTER_ADDRESS || process.env.NEXT_PUBLIC_ROUTER_ADDRESS || "");

  const marketTool = createMarketSnapshotTool(apiBaseUrl);
  const txPlanTool = createTxPlanTool(routerAddress);

  const instruction = [
    "You are an autonomous DeFi strategist.",
    "You must call tools to gather live market data before deciding.",
    "Use fetch_market_snapshot first.",
    "If action is migrate or consider, call build_router_tx_plan.",
    "Return STRICT JSON with keys: action, confidence, current, recommended, predicted_net_apy_30d, estimated_30d_delta_usd, reasoning, explanation, onchain_trigger.",
    "Action must be one of: migrate, consider, hold.",
    "Reasoning must be an array of short factual bullets.",
  ].join(" ");

  const prompt = JSON.stringify(
    {
      task: "Compute autonomous stablecoin migration strategy",
      input: {
        current_protocol: String(input.currentProtocol || "aave"),
        current_token: String(input.currentToken || "USDC"),
        amount_usd: safeNumber(input.amountUsd, 10000),
        chain: String(input.chain || "ethereum"),
      },
      requirements: {
        include_confidence_0_to_100: true,
        include_reasoning_array: true,
        include_onchain_plan_if_migrate_or_consider: true,
      },
    },
    null,
    2,
  );

  const response = await AgentBuilder.create("yield_optimizer_adk_agent")
    .withModel(model)
    .withInstruction(instruction)
    .withTools(marketTool, txPlanTool)
    .withQuickSession({ appName: "yield-optimizer", userId: "offline-judge" })
    .ask(prompt);

  const text = typeof response === "string" ? response : collectTextFrom(response) || JSON.stringify(response);
  const parsed = parseJsonSafely(text);
  if (!parsed) {
    const fallback = {
      action: "hold",
      confidence: 0,
      reasoning: ["ADK response parsing fallback used."],
    };
    return normalizeStrategyOutput(fallback, input, "degraded_parse");
  }
  return normalizeStrategyOutput(parsed, input, "ok");
}

function parseCliInput(argv) {
  const idx = argv.indexOf("--input");
  if (idx >= 0 && argv[idx + 1]) {
    try {
      return JSON.parse(argv[idx + 1]);
    } catch (error) {
      throw new Error(`Invalid --input JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const get = (key, fallback) => {
    const i = argv.indexOf(`--${key}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };

  return {
    currentProtocol: get("current_protocol", "aave"),
    currentToken: get("current_token", "USDC"),
    amountUsd: safeNumber(get("amount", "10000"), 10000),
    chain: get("chain", "ethereum"),
    apiBaseUrl: get("api_base", process.env.ADK_API_BASE_URL || DEFAULT_API_BASE),
  };
}

async function main() {
  const input = parseCliInput(process.argv.slice(2));
  const result = await runAdkStrategy(input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ADK strategy run failed: ${message}\n`);
  process.exit(1);
});
