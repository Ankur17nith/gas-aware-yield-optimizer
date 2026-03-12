/**
 * deploy.ts
 * Deployment script for the Router and Adapter contracts.
 * Run with: npx hardhat run scripts/deploy.ts --network <network>
 */

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // ── 1. Deploy Router ──
  const Router = await ethers.getContractFactory('Router');
  const router = await Router.deploy(deployer.address); // feeRecipient = deployer
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('Router deployed to:', routerAddress);

  // ── 2. Deploy AaveAdapter ──
  const AAVE_POOL = process.env.AAVE_POOL_ADDRESS || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
  const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
  const aaveAdapter = await AaveAdapter.deploy(AAVE_POOL, routerAddress);
  await aaveAdapter.waitForDeployment();
  const aaveAdapterAddress = await aaveAdapter.getAddress();
  console.log('AaveAdapter deployed to:', aaveAdapterAddress);

  // ── 3. Deploy CurveAdapter ──
  // 3pool addresses (example — adjust for target pool)
  const CURVE_POOL = process.env.CURVE_POOL_ADDRESS || '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
  const CURVE_LP = process.env.CURVE_LP_ADDRESS || '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
  const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  const CurveAdapter = await ethers.getContractFactory('CurveAdapter');
  const curveAdapter = await CurveAdapter.deploy(
    CURVE_POOL,
    CURVE_LP,
    routerAddress,
    [DAI, USDC]
  );
  await curveAdapter.waitForDeployment();
  const curveAdapterAddress = await curveAdapter.getAddress();
  console.log('CurveAdapter deployed to:', curveAdapterAddress);

  // ── 4. Configure Router ──
  // Set adapters
  await router.setAdapter(0, aaveAdapterAddress); // Protocol.AAVE = 0
  console.log('Router: Aave adapter set');

  await router.setAdapter(1, curveAdapterAddress); // Protocol.CURVE = 1
  console.log('Router: Curve adapter set');

  // Whitelist stablecoins
  const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  for (const [name, addr] of [['DAI', DAI], ['USDC', USDC], ['USDT', USDT]]) {
    await router.setTokenSupport(addr, true);
    console.log(`Router: ${name} whitelisted`);
  }

  console.log('\n── Deployment Summary ──');
  console.log('Router:       ', routerAddress);
  console.log('AaveAdapter:  ', aaveAdapterAddress);
  console.log('CurveAdapter: ', curveAdapterAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
