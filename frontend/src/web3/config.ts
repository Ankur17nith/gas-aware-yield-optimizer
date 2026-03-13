import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, base, mainnet, polygon, sepolia } from 'wagmi/chains';

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'REPLACE_WITH_WALLETCONNECT_PROJECT_ID';

export const wagmiConfig = getDefaultConfig({
  appName: 'Gas-Aware Yield Optimizer',
  projectId: walletConnectProjectId,
  chains: [mainnet, sepolia, arbitrum, polygon, base],
  ssr: false,
});
