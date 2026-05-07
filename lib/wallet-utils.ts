type SolanaProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  on?: (event: string, callback: (publicKey: { toString: () => string } | null) => void) => void;
  removeListener?: (event: string, callback: (publicKey: { toString: () => string } | null) => void) => void;
};

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (publicKey: { toString: () => string } | null) => void) => void;
  removeListener?: (event: string, callback: (publicKey: { toString: () => string } | null) => void) => void;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    ethereum?: EthereumProvider;
  }
}

export function isPhantomInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.solana?.isPhantom;
}

export function isSolflareInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.solflare?.isSolflare;
}

export async function connectPhantom(): Promise<string> {
  if (!window.solana) {
    throw new Error('Phantom wallet not found');
  }
  const resp = await window.solana.connect();
  return resp.publicKey.toString();
}

export async function connectSolflare(): Promise<string> {
  if (!window.solflare) {
    throw new Error('Solflare wallet not found');
  }
  const resp = await window.solflare.connect();
  return resp.publicKey.toString();
}

export async function disconnectWallet(provider: 'phantom' | 'solflare'): Promise<void> {
  if (provider === 'phantom' && window.solana) {
    await window.solana.disconnect();
  } else if (provider === 'solflare' && window.solflare) {
    await window.solflare.disconnect();
  }
}

export function getPhantomDeeplink(appUrl: string): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(appUrl)}?ref=${encodeURIComponent(appUrl)}`;
}

export function getSolflareDeeplink(appUrl: string): string {
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(appUrl)}?ref=${encodeURIComponent(appUrl)}`;
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;
}

export async function connectMetaMask(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export async function getMetaMaskChainId(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found');
  }
  return await window.ethereum.request({ method: 'eth_chainId' });
}

export function validateSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function validateEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
