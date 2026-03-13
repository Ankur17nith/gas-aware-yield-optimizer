import { createConfig, http } from 'wagmi';
import { arbitrum, base, mainnet, polygon, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'REPLACE_WITH_WALLETCONNECT_PROJECT_ID';

const walletConnectMetadata = {
  name: 'Gas-Aware Stablecoin Yield Optimizer',
  description: 'Gas-aware stablecoin yield analytics and migration assistant',
  url: 'https://gas-aware-yield-optimizer.vercel.app',
  icons: ['https://gas-aware-yield-optimizer.vercel.app/favicon.ico'],
};

const chains = [mainnet, sepolia, arbitrum, polygon, base] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected({ target: 'metaMask' }),
    injected({ target: 'coinbaseWallet' }),
    walletConnect({
      projectId: walletConnectProjectId,
      metadata: walletConnectMetadata,
      showQrModal: true,
    }),
    coinbaseWallet({ appName: 'Gas-Aware Yield Optimizer', appLogoUrl: '' }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
  },
});
