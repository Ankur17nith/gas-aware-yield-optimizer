const fs = require('fs');
const path = require('path');

const root = process.cwd();
const envPath = path.join(root, '.env');

function parseEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function masked(value) {
  if (!value) return 'MISSING';
  if (value.length < 10) return 'SET';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return `${res.status} ${res.statusText}`;
  } catch (err) {
    return `UNREACHABLE (${err.message})`;
  }
}

async function main() {
  const env = parseEnv(envPath);

  console.log('=== Demo Readiness Check ===');
  console.log('Env file:', fs.existsSync(envPath) ? '.env found' : '.env missing');
  console.log('');

  const required = [
    'SEPOLIA_RPC_URL',
    'DEPLOYER_PRIVATE_KEY',
    'VITE_API_URL',
    'VITE_ROUTER_ADDRESS',
  ];

  for (const key of required) {
    const raw = env[key] || '';
    const looksPlaceholder = raw.includes('YOUR_') || raw.includes('REPLACE_');
    const status = !raw || looksPlaceholder ? 'MISSING/PLACEHOLDER' : 'SET';
    console.log(`${key}: ${status} (${masked(raw)})`);
  }

  console.log('');
  const apiUrl = (env.VITE_API_URL || 'https://gas-aware-yield-optimizer.onrender.com').replace(/\/$/, '');
  const frontendUrl = 'https://gas-aware-yield-optimizer.vercel.app';

  console.log(`Backend health (${apiUrl}/health):`, await checkUrl(`${apiUrl}/health`));
  console.log(`Backend pools (${apiUrl}/pools):`, await checkUrl(`${apiUrl}/pools`));
  console.log(`Frontend (${frontendUrl}):`, await checkUrl(frontendUrl));

  console.log('');
  console.log('If DEPLOYER_PRIVATE_KEY and VITE_ROUTER_ADDRESS are missing, on-chain demo actions will fail.');
}

main().catch((err) => {
  console.error('demo-check failed:', err);
  process.exit(1);
});
