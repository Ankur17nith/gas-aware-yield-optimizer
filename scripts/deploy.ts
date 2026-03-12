/**
 * deploy.ts
 * Deployment script for the Router and Adapter contracts.
 * Run with: npx hardhat run scripts/deploy.ts --network <network>
 *
 * Supports: localhost, sepolia, mainnet
 */

import { ethers, network } from 'hardhat';

// ── Network-specific addresses ──
const NETWORK_CONFIG: Record<string, {
  aavePool: string;
  curvePool: string;
  curveLp: string;
  stablecoins: { name: string; address: string }[];
}> = {
  mainnet: {
    aavePool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    curvePool: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
    curveLp: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
    stablecoins: [
      { name: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
      { name: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { name: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    ],
  },
  sepolia: {
    aavePool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
    // Curve has no Sepolia deployment — use zero address (CurveAdapter
    // will be deployed but not functional until a Curve pool exists)
    curvePool: '0x0000000000000000000000000000000000000000',
    curveLp: '0x0000000000000000000000000000000000000000',
    stablecoins: [
      { name: 'DAI', address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357' },
      { name: 'USDC', address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8' },
    ],
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  console.log(`\nDeploying to: ${networkName}`);
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Use network config or fall back to env vars / mainnet defaults
  const cfg = NETWORK_CONFIG[networkName] || NETWORK_CONFIG.mainnet;

  // ── 1. Deploy Router ──
  const Router = await ethers.getContractFactory('Router');
  const router = await Router.deploy(deployer.address); // feeRecipient = deployer
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('Router deployed to:', routerAddress);

  // ── 2. Deploy AaveAdapter ──
  const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
  const aaveAdapter = await AaveAdapter.deploy(cfg.aavePool, routerAddress);
  await aaveAdapter.waitForDeployment();
  const aaveAdapterAddress = await aaveAdapter.getAddress();
  console.log('AaveAdapter deployed to:', aaveAdapterAddress);

  // ── 3. Deploy CurveAdapter ──
  const hasCurve = cfg.curvePool !== '0x0000000000000000000000000000000000000000';
  let curveAdapterAddress = '0x0000000000000000000000000000000000000000';

  if (hasCurve) {
    const CurveAdapter = await ethers.getContractFactory('CurveAdapter');
    const curveAdapter = await CurveAdapter.deploy(
      cfg.curvePool,
      cfg.curveLp,
      routerAddress,
      cfg.stablecoins.map((s) => s.address) as [string, string]
    );
    await curveAdapter.waitForDeployment();
    curveAdapterAddress = await curveAdapter.getAddress();
    console.log('CurveAdapter deployed to:', curveAdapterAddress);
  } else {
    console.log('CurveAdapter skipped (no Curve pool on this network)');
  }

  // ── 4. Configure Router ──
  // Set adapters
  await router.setAdapter(0, aaveAdapterAddress); // Protocol.AAVE = 0
  console.log('Router: Aave adapter set');

  if (hasCurve) {
    await router.setAdapter(1, curveAdapterAddress); // Protocol.CURVE = 1
    console.log('Router: Curve adapter set');
  }

  // Whitelist stablecoins
  for (const { name, address } of cfg.stablecoins) {
    await router.setTokenSupport(address, true);
    console.log(`Router: ${name} whitelisted`);
  }

  console.log('\n── Deployment Summary ──');
  console.log('Network:      ', networkName);
  console.log('Router:       ', routerAddress);
  console.log('AaveAdapter:  ', aaveAdapterAddress);
  console.log('CurveAdapter: ', curveAdapterAddress);
  console.log('\nAdd to your .env:');
  console.log(`ROUTER_ADDRESS=${routerAddress}`);
  console.log(`AAVE_ADAPTER_ADDRESS=${aaveAdapterAddress}`);
  console.log(`CURVE_ADAPTER_ADDRESS=${curveAdapterAddress}`);
  console.log(`VITE_ROUTER_ADDRESS=${routerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
