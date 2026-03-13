/**
 * verify.ts
 * Verifies deployed contracts on Etherscan.
 * Run with: npx hardhat run scripts/verify.ts --network <network>
 */

import { run } from 'hardhat';

const CONTRACTS = {
  router: {
    address: process.env.ROUTER_ADDRESS || '',
    constructorArguments: [process.env.FEE_RECIPIENT || ''],
  },
  aaveAdapter: {
    address: process.env.AAVE_ADAPTER_ADDRESS || '',
    constructorArguments: [
      process.env.AAVE_POOL_ADDRESS || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      process.env.ROUTER_ADDRESS || '',
    ],
  },
  curveAdapter: {
    address: process.env.CURVE_ADAPTER_ADDRESS || '',
    constructorArguments: [
      process.env.CURVE_POOL_ADDRESS || '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
      process.env.CURVE_LP_ADDRESS || '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
      process.env.ROUTER_ADDRESS || '',
      [
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      ],
    ],
  },
  compoundAdapter: {
    address: process.env.COMPOUND_ADAPTER_ADDRESS || '',
    constructorArguments: [
      process.env.COMPOUND_COMET_ADDRESS || process.env.SEPOLIA_COMPOUND_COMET || '',
      process.env.ROUTER_ADDRESS || '',
    ],
  },
};

async function main() {
  for (const [name, config] of Object.entries(CONTRACTS)) {
    if (!config.address) {
      console.log(`Skipping ${name}: no address set`);
      continue;
    }

    console.log(`Verifying ${name} at ${config.address}...`);
    try {
      await run('verify:verify', {
        address: config.address,
        constructorArguments: config.constructorArguments,
      });
      console.log(`${name} verified ✓`);
    } catch (err: any) {
      if (err.message.includes('Already Verified')) {
        console.log(`${name} already verified`);
      } else {
        console.error(`${name} verification failed:`, err.message);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
