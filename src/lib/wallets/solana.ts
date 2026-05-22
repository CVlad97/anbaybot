declare global {
  interface Window {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
  }
}

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isConnected?: boolean;
  publicKey?: { toString: () => string; toBase58?: () => string } | null;
  connect: (options?: unknown) => Promise<{ publicKey?: { toString: () => string } } | void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
}

export function getPhantomProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  const p = window.phantom?.solana;
  return p?.isPhantom ? p : null;
}

export function getSolflareProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  const p = window.solflare;
  return p?.isSolflare ? p : null;
}

function readPublicKey(provider: SolanaProvider): string {
  const pk = provider.publicKey;
  if (!pk) throw new Error('No public key available after connect');
  return pk.toBase58 ? pk.toBase58() : pk.toString();
}

export async function connectPhantom(): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider) throw new Error('Phantom not found. Install the Phantom extension.');
  const resp = await provider.connect();
  if (resp && resp.publicKey) {
    return resp.publicKey.toString();
  }
  return readPublicKey(provider);
}

export async function connectSolflare(): Promise<string> {
  const provider = getSolflareProvider();
  if (!provider) throw new Error('Solflare not found. Install the Solflare extension.');
  await provider.connect();
  await new Promise(r => setTimeout(r, 300));
  return readPublicKey(provider);
}

export async function getConnectedSolanaAddress(which: 'phantom' | 'solflare'): Promise<string | null> {
  const provider = which === 'phantom' ? getPhantomProvider() : getSolflareProvider();
  if (!provider) return null;
  if (provider.publicKey) {
    return readPublicKey(provider);
  }
  try {
    await provider.connect({ onlyIfTrusted: true });
  } catch {
    return null;
  }
  if (!provider.publicKey) return null;
  return readPublicKey(provider);
}

export async function disconnectSolana(which: 'phantom' | 'solflare'): Promise<void> {
  const p = which === 'phantom' ? getPhantomProvider() : getSolflareProvider();
  if (p) await p.disconnect().catch(() => {});
}

export function isPhantomInstalled(): boolean {
  return !!getPhantomProvider();
}

export function isSolflareInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.solflare?.isSolflare;
}

export function getPhantomDeeplink(url: string): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}`;
}

export function getSolflareDeeplink(url: string): string {
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`;
}

export async function signAndSendWithProvider(
  provider: 'phantom' | 'solflare',
  txBase64: string
): Promise<string> {
  const bytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));

  const p = provider === 'phantom' ? getPhantomProvider() : getSolflareProvider();
  if (!p) throw new Error(`${provider} provider not found`);

  if (!p.isConnected && !p.publicKey) {
    await p.connect();
  }

  if (!p.signAndSendTransaction) {
    throw new Error(`${provider} does not support signAndSendTransaction`);
  }

  const result = await p.signAndSendTransaction(bytes);
  return result.signature;
}
