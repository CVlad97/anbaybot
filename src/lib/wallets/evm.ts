declare global {
  interface Window {
    ethereum?: EvmProvider;
  }
}

interface EvmProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
}

export function getMetaMaskProvider(): EvmProvider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

export function isMetaMaskInstalled(): boolean {
  return !!getMetaMaskProvider()?.isMetaMask;
}

export async function connectMetaMask(): Promise<string> {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error('MetaMask not found');
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts[0]) throw new Error('No account returned');
  return accounts[0];
}

export async function getChainId(): Promise<string> {
  const provider = getMetaMaskProvider();
  if (!provider) return '0x0';
  return (await provider.request({ method: 'eth_chainId' })) as string;
}

export function formatEvmAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
