import { createConfig, http } from 'wagmi';
import { arbitrum, base, mainnet, polygon, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'REPLACE_WITH_WALLETCONNECT_PROJECT_ID';

const chains = [mainnet, sepolia, arbitrum, polygon, base] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected({ target: 'metaMask' }),
    injected({ target: 'coinbaseWallet' }),
    walletConnect({ projectId: walletConnectProjectId }),
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
