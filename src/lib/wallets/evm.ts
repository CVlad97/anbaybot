declare global {
  interface Window {
    ethereum?: EvmProvider;
  }
}

interface EvmProvider {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EvmProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
}

export type EvmWalletId = 'metamask' | 'trust' | 'base';

const BASE_CHAIN = {
  chainId: '0x2105',
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

function providers(): EvmProvider[] {
  if (typeof window === 'undefined' || !window.ethereum) return [];
  return window.ethereum.providers?.length ? window.ethereum.providers : [window.ethereum];
}

function findProvider(wallet: EvmWalletId): EvmProvider | null {
  const list = providers();
  if (wallet === 'metamask') return list.find(p => p.isMetaMask && !p.isTrust && !p.isCoinbaseWallet) || null;
  if (wallet === 'trust') return list.find(p => p.isTrust || p.isTrustWallet) || null;
  if (wallet === 'base') return list.find(p => p.isCoinbaseWallet) || null;
  return null;
}

export function getMetaMaskProvider(): EvmProvider | null {
  return findProvider('metamask') || (typeof window === 'undefined' ? null : window.ethereum ?? null);
}

export function isMetaMaskInstalled(): boolean {
  return !!getMetaMaskProvider()?.isMetaMask;
}

export function isEvmWalletInstalled(wallet: EvmWalletId): boolean {
  if (wallet === 'metamask') return !!getMetaMaskProvider();
  return !!findProvider(wallet);
}

export async function connectMetaMask(): Promise<string> {
  return connectEvmWallet('metamask');
}

export async function getConnectedEvmAddress(wallet: EvmWalletId): Promise<string | null> {
  const provider = wallet === 'metamask' ? getMetaMaskProvider() : findProvider(wallet);
  if (!provider) return null;
  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
  if (!accounts[0]) return null;
  return accounts[0];
}

export async function connectEvmWallet(wallet: EvmWalletId): Promise<string> {
  const provider = wallet === 'metamask' ? getMetaMaskProvider() : findProvider(wallet);
  if (!provider) {
    throw new Error(`${walletLabel(wallet)} non détecté. Ouvrez la page dans le navigateur du wallet.`);
  }
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts[0]) throw new Error('Aucun compte renvoyé par le wallet.');
  if (wallet === 'base' || wallet === 'trust' || wallet === 'metamask') {
    await switchToBase(provider).catch(() => {
      // Keep connection even if the wallet refuses network switching.
    });
  }
  return accounts[0];
}

export async function getChainId(): Promise<string> {
  const provider = getMetaMaskProvider();
  if (!provider) return '0x0';
  return (await provider.request({ method: 'eth_chainId' })) as string;
}

async function switchToBase(provider: EvmProvider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN.chainId }] });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : 0;
    if (code === 4902) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [BASE_CHAIN] });
      return;
    }
    throw error;
  }
}

export function formatEvmAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function walletLabel(wallet: EvmWalletId): string {
  if (wallet === 'trust') return 'Trust Wallet';
  if (wallet === 'base') return 'Base / Coinbase Wallet';
  return 'MetaMask';
}

export function getEvmWalletDeeplink(wallet: EvmWalletId, url: string): string {
  const clean = url.replace(/^https?:\/\//, '');
  if (wallet === 'trust') return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`;
  if (wallet === 'base') return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`;
  return `https://metamask.app.link/dapp/${clean}`;
}
