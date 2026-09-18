import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Copy, ExternalLink,
  KeyRound, Link2, RefreshCw, ShieldCheck, Smartphone, Wallet,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { publicApi, type PublicOpportunities, type PublicPortfolio, type PublicReadiness } from '../lib/publicApi';
import { api } from '../lib/api';

const TARGET_TRON = 'TC5rdUUpmWBZuCraVg4YsEq81UR6n4jWSN';
const TARGET_TRON_MASK = 'TC5rdU…jWSN';
const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const SETUP_KEY = 'anbaybot_setup_progress_v1';

type ExchangeHealth = Awaited<ReturnType<typeof api.getExchangeHealth>>;

type SetupProgress = {
  trustWalletOpens: boolean;
  addressMatched: boolean;
  canSign: boolean;
  usdtVisible: boolean;
  recoveryMaterialExists: boolean;
  testedSmallTransfer: boolean;
};

const initialProgress: SetupProgress = {
  trustWalletOpens: false,
  addressMatched: false,
  canSign: false,
  usdtVisible: false,
  recoveryMaterialExists: false,
  testedSmallTransfer: false,
};

function readProgress(): SetupProgress {
  if (typeof window === 'undefined') return initialProgress;
  try {
    return { ...initialProgress, ...JSON.parse(window.localStorage.getItem(SETUP_KEY) || '{}') };
  } catch {
    return initialProgress;
  }
}

export default function SetupPage() {
  const [progress, setProgress] = useState<SetupProgress>(() => readProgress());
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [readiness, setReadiness] = useState<PublicReadiness | null>(null);
  const [opportunities, setOpportunities] = useState<PublicOpportunities | null>(null);
  const [exchangeHealth, setExchangeHealth] = useState<ExchangeHealth | null>(null);
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const x = await api.getExchangeHealth();
      setExchangeHealth(x);
      const [p, r, o] = await Promise.all([publicApi.portfolio(), publicApi.readiness(), publicApi.opportunities()]);
      setPortfolio(p);
      setReadiness(r);
      setOpportunities(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lire l’état serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    window.localStorage.setItem(SETUP_KEY, JSON.stringify(progress));
  }, [progress]);

  const tronWallet = useMemo(
    () => (portfolio?.wallets || []).find(w => w.chain.toLowerCase() === 'tron' && w.addressMasked === TARGET_TRON_MASK)
      || (portfolio?.wallets || []).find(w => w.label.toLowerCase().includes('mobile retrouvé')),
    [portfolio],
  );
  const usdt = tronWallet?.tokens.find(t => t.symbol === 'USDT');
  const trx = tronWallet?.tokens.find(t => t.symbol === 'TRX');
  const chainFundsFound = Boolean(usdt && usdt.balance > 0);
  const exchangesReady = Boolean(readiness?.privateReady);
  const paperReady = Boolean(readiness?.ai?.enabled && readiness?.latestScanAt);
  const walletsReadable = (portfolio?.wallets || []).filter(w => !w.error).length;
  const walletsTotal = portfolio?.wallets.length || 0;
  const candidateReady = Boolean((opportunities?.rows || []).some(row => ['DATA_READY', 'PAPER_READY', 'TEST_READY'].includes(row.status)));
  const liveReady = Boolean(
    readiness
    && !readiness.killSwitch
    && readiness.privateReady
    && readiness.liveEnabled
    && progress.canSign
    && progress.testedSmallTransfer
  );

  const completed = [
    chainFundsFound,
    progress.trustWalletOpens,
    progress.addressMatched,
    progress.canSign,
    progress.usdtVisible,
    progress.testedSmallTransfer,
    paperReady,
    exchangesReady,
  ].filter(Boolean).length;

  function toggle(key: keyof SetupProgress) {
    setProgress(p => ({ ...p, [key]: !p[key] }));
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1500);
  }

  async function runExchangeTest(exchange: 'BINANCE' | 'MEXC') {
    setTestResult('Test en cours…');
    try {
      const result = await api.testExchange(exchange, 'BTC', 1);
      setTestResult(result.data.message);
      await refresh();
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : 'Test impossible');
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Link2}
        title="Setup guidé"
        subtitle="Récupération wallet, connexions, APIs et validation avant toute exécution"
        action={
          <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        }
      />

      <div className="card p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Progression</p>
            <p className="text-xs text-surface-500 mt-1">{completed}/8 contrôles terminés</p>
          </div>
          <div className="w-full md:w-72 h-2 rounded-full bg-surface-800 overflow-hidden">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${(completed / 8) * 100}%` }} />
          </div>
        </div>
      </div>

      {error && <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>}

      <section className={`card p-5 mb-6 border-l-4 ${liveReady ? 'border-l-brand-500' : 'border-l-warn-500'}`}>
        <div className="flex items-start gap-3">
          {liveReady ? <CheckCircle2 size={20} className="text-brand-400 mt-0.5" /> : <AlertTriangle size={20} className="text-warn-400 mt-0.5" />}
          <div className="flex-1">
            <h2 className="font-semibold text-white">Diagnostic « gains réels »</h2>
            <p className={`text-lg font-bold mt-2 ${liveReady ? 'text-brand-400' : 'text-warn-300'}`}>
              {liveReady ? 'INFRASTRUCTURE LIVE PRÊTE — résultat non garanti' : 'PAS ENCORE PRÊT POUR UN P&L LIVE'}
            </p>
            <p className="text-xs text-surface-400 mt-2">
              Wallets lisibles {walletsReadable}/{walletsTotal || '—'} · opportunité exploitable en PAPER {candidateReady ? 'oui' : 'non'} · APIs privées {readiness?.privateReady ? 'prêtes' : 'non'} · kill switch {readiness?.killSwitch ? 'actif' : 'désactivé'} · LIVE {readiness?.liveEnabled ? 'activé' : 'désactivé'} · P&L LIVE ${Number(readiness?.livePnlUsd || 0).toFixed(2)}
            </p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Tester tout
          </button>
        </div>
      </section>

      <section className="card p-5 mb-6 border-l-4 border-l-brand-500">
        <div className="flex items-start gap-3">
          <Wallet size={20} className="text-brand-400 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-white">1 · Retrouver et contrôler le wallet TRON</h2>
            <p className="text-xs text-surface-500 mt-1">ANBAYBOT ne demande et ne stocke jamais phrase de récupération, clé privée ou mot de passe wallet.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <Status title="Adresse suivie" value={TARGET_TRON_MASK} ok={Boolean(tronWallet)} />
          <Status title="USDT trouvé on-chain" value={usdt ? `${usdt.balance.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} USDT` : 'Non lu'} ok={chainFundsFound} />
          <Status title="TRX frais réseau" value={trx ? `${trx.balance.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} TRX` : 'Non lu'} ok={Boolean(trx && trx.balance > 0)} />
        </div>

        <div className="mt-5 space-y-3">
          <CheckRow checked={progress.trustWalletOpens} onClick={() => toggle('trustWalletOpens')} title="J’arrive à ouvrir l’application Trust Wallet" desc="Même si l’USDT n’est pas visible, coche si l’app elle-même s’ouvre." />
          <CheckRow checked={progress.addressMatched} onClick={() => toggle('addressMatched')} title="L’adresse TRON affichée correspond" desc={TARGET_TRON} />
          <CheckRow checked={progress.canSign} onClick={() => toggle('canSign')} title="Je peux confirmer une opération avec PIN/biométrie" desc="Cela prouve que le téléphone possède encore l’accès de signature." />
        </div>

        {!progress.canSign && (
          <div className="mt-5 rounded-xl border border-warn-500/30 bg-warn-500/5 p-4">
            <div className="flex gap-3">
              <KeyRound size={18} className="text-warn-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Si le wallet ne signe plus</p>
                <p className="text-xs text-surface-400 mt-2">
                  Un mot de passe/PIN local ne permet pas de reconstruire cryptographiquement un wallet perdu. Pour un wallet Trust Wallet classique, la récupération passe par la phrase de récupération ou une sauvegarde cloud chiffrée si elle avait été activée. Pour Trust Wallet SWIFT, la récupération peut passer par le passkey associé au compte Google/iCloud.
                </p>
                <p className="text-xs text-warn-300 mt-2">
                  Ne saisis jamais ta phrase ou ta clé dans ANBAYBOT, ChatGPT, un email ou un formulaire web. Entre-la uniquement dans l’application officielle que tu as toi-même ouverte.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a className="btn-secondary inline-flex items-center gap-2" href="https://trustwallet.com/download" target="_blank" rel="noreferrer"><Smartphone size={14}/> Trust Wallet officiel <ExternalLink size={12}/></a>
                  <a className="btn-secondary inline-flex items-center gap-2" href="https://trustwallet.com/blog/security/backing-up-and-restoring-your-wallet-step-by-step-guide" target="_blank" rel="noreferrer">Guide récupération <ExternalLink size={12}/></a>
                  <a className="btn-secondary inline-flex items-center gap-2" href="https://www.tronlink.org/" target="_blank" rel="noreferrer">Alternative TronLink <ExternalLink size={12}/></a>
                </div>
                <CheckRow
                  checked={progress.recoveryMaterialExists}
                  onClick={() => toggle('recoveryMaterialExists')}
                  title="J’ai retrouvé une méthode de récupération"
                  desc="Phrase/backup/passkey conservé hors d’ANBAYBOT. Ne le colle pas ici."
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5 mb-6">
        <div className="flex items-start gap-3">
          <Smartphone size={20} className="text-brand-400 mt-0.5" />
          <div>
            <h2 className="font-semibold text-white">2 · Faire réapparaître USDT TRC20</h2>
            <p className="text-xs text-surface-500 mt-1">Les fonds sont sur la blockchain même si l’interface du wallet les masque.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <CopyField label="Contrat" value={USDT_TRC20} copied={copied === 'contract'} onCopy={() => copy('contract', USDT_TRC20)} />
          <CopyField label="Symbole" value="USDT" copied={copied === 'symbol'} onCopy={() => copy('symbol', 'USDT')} />
          <CopyField label="Décimales" value="6" copied={copied === 'decimals'} onCopy={() => copy('decimals', '6')} />
        </div>

        <div className="mt-4 rounded-xl border border-surface-800 p-4 text-xs text-surface-300">
          Dans Trust Wallet : <strong className="text-white">View all → réglages → Manage Crypto → + → Token</strong>, puis réseau TRON si proposé. Si ta version ne permet pas d’ajouter ce token TRON, n’invente pas de réseau personnalisé : utilise le chemin de secours TronLink ci-dessous.
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <a className="btn-secondary inline-flex items-center gap-2" href="https://www.tronlink.org/" target="_blank" rel="noreferrer">Ouvrir TronLink officiel <ExternalLink size={12}/></a>
          <a className="btn-secondary inline-flex items-center gap-2" href="https://support.tronlink.org/hc/en-us/articles/5982285631769-How-to-Import-Your-Account-in-TronLink-Wallet-Extension" target="_blank" rel="noreferrer">Guide d’import TronLink <ExternalLink size={12}/></a>
        </div>

        <div className="mt-4 space-y-3">
          <CheckRow checked={progress.usdtVisible} onClick={() => toggle('usdtVisible')} title="USDT est de nouveau visible dans un wallet compatible TRON" desc="Trust Wallet ou TronLink." />
          <CheckRow checked={progress.testedSmallTransfer} onClick={() => toggle('testedSmallTransfer')} title="J’ai réussi un petit transfert test" desc="Fais d’abord 1 USDT vers une adresse TRON que tu contrôles avant un transfert important." />
        </div>
      </section>

      <section className="card p-5 mb-6">
        <div className="flex items-start gap-3">
          <Link2 size={20} className="text-brand-400 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-white">3 · Connecter et vérifier tous les wallets</h2>
            <p className="text-xs text-surface-500 mt-1">Lecture on-chain automatique. Une connexion de signature reste volontaire et se confirme dans chaque wallet.</p>
          </div>
          <a href="#/wallets" className="btn-primary inline-flex items-center gap-2">Connecter navigateur <ChevronRight size={14}/></a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {(portfolio?.wallets || []).map(wallet => (
            <div key={wallet.walletId} className="rounded-xl border border-surface-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{wallet.label}</p>
                  <p className="text-[11px] text-surface-500 mt-1">{wallet.chain} · {wallet.platform} · {wallet.addressMasked}</p>
                </div>
                <span className={wallet.error ? 'badge-danger' : 'badge-success'}>{wallet.error ? 'ERREUR' : 'LISIBLE'}</span>
              </div>
              <p className="text-xs text-surface-400 mt-3">
                {wallet.tokens.length ? wallet.tokens.map(t => `${t.balance.toLocaleString('fr-FR',{maximumFractionDigits:6})} ${t.symbol}`).join(' · ') : 'Aucun actif valorisé détecté'}
              </p>
              {wallet.error && <p className="text-[11px] text-danger-300 mt-2">{wallet.error}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 mb-6">
        <div className="flex items-start gap-3">
          <KeyRound size={20} className="text-brand-400 mt-0.5" />
          <div>
            <h2 className="font-semibold text-white">4 · APIs Binance / MEXC</h2>
            <p className="text-xs text-surface-500 mt-1">Clés privées côté serveur uniquement. Retraits désactivés. Ne colle jamais le secret dans ANBAYBOT.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {(['BINANCE','MEXC'] as const).map(name => {
            const db = (readiness?.exchanges || []).find(x => x.exchange === name);
            const health = (exchangeHealth?.exchanges || []).find(x => x.exchange === name);
            const status = health?.status || db?.connection_status || 'NOT_CONFIGURED';
            return (
              <div key={name} className="rounded-xl border border-surface-800 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{name}</p>
                  <span className={status === 'TEST_READY' || status === 'READ_ONLY' ? 'badge-success' : status === 'ERROR' ? 'badge-danger' : 'badge-neutral'}>{status}</span>
                </div>
                <p className="text-xs text-surface-500 mt-2">
                  Clés serveur : {health?.configured ? 'détectées' : 'absentes'} · lecture : {health?.readOk ? 'OK' : 'non validée'}
                </p>
                <p className="text-[11px] text-surface-500 mt-1">
                  Dernier contrôle {health?.lastCheckedAt ? new Date(health.lastCheckedAt).toLocaleString('fr-FR') : db?.last_checked_at ? new Date(db.last_checked_at).toLocaleString('fr-FR') : 'aucun'}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a
                    className="btn-secondary inline-flex items-center gap-2"
                    href={name === 'BINANCE' ? 'https://www.binance.com/en/my/settings/api-management' : 'https://www.mexc.com/user/openapi'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Créer/voir API <ExternalLink size={12}/>
                  </a>
                  <button
                    className="btn-secondary"
                    disabled={!health?.readOk}
                    onClick={() => runExchangeTest(name)}
                    title={health?.readOk ? 'Teste order/test avec 1 USDT sans transaction réelle' : 'Ajoutez d’abord les clés et validez la lecture'}
                  >
                    Ordre TEST 1 USDT
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {testResult && <div className="rounded-xl border border-surface-800 p-3 mt-4 text-xs text-surface-300">{testResult}</div>}

        <div className="rounded-xl border border-surface-800 p-4 mt-4">
          <p className="text-sm font-medium text-white">Secrets à créer dans Supabase</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {['BINANCE_API_KEY','BINANCE_API_SECRET','MEXC_API_KEY','MEXC_API_SECRET'].map(name => (
              <CopyField key={name} label="Nom du secret" value={name} copied={copied === name} onCopy={() => copy(name, name)} />
            ))}
          </div>
          <p className="text-xs text-surface-400 mt-3">
            Colle les valeurs directement dans Supabase, jamais dans le chat ni dans GitHub. Permissions recommandées : lecture + spot trading, retraits désactivés.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs text-surface-400">
            <p>✓ Lecture + trading spot uniquement</p>
            <p>✓ Retraits API désactivés</p>
            <p>✓ Restriction IP si le fournisseur la permet</p>
            <p>✓ Le kill switch LIVE reste actif pendant les tests</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <a
              className="btn-secondary inline-flex items-center gap-2"
              href="https://supabase.com/dashboard/project/lmfwtiytqwedrazxjnwu/settings/functions"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir les secrets Supabase <ExternalLink size={12}/>
            </a>
            <button className="btn-primary" onClick={refresh} disabled={loading}>J’ai ajouté les clés · Tester</button>
          </div>
        </div>
      </section>

      <section className="card p-5 mb-8">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-brand-400 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-white">5 · Validation finale</h2>
            <p className="text-xs text-surface-500 mt-1">Le setup ne retire pas les garde-fous financiers.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Status title="PAPER / analyse" value={paperReady ? 'PRÊT' : 'EN ATTENTE'} ok={paperReady} />
          <Status title="Exchanges privés" value={exchangesReady ? 'CONNECTÉS' : 'À CONNECTER'} ok={exchangesReady} />
          <Status title="LIVE" value={readiness?.killSwitch ? 'BLOQUÉ PAR KILL SWITCH' : readiness?.liveEnabled ? 'ACTIF' : 'NON ACTIVÉ'} ok={Boolean(readiness?.liveEnabled && !readiness?.killSwitch)} />
        </div>

        <div className="mt-4 rounded-xl border border-warn-500/30 bg-warn-500/5 p-4 flex gap-3">
          <AlertTriangle size={18} className="text-warn-400 shrink-0" />
          <p className="text-xs text-surface-300">
            Une fois les connexions terminées, commence par lecture des soldes puis ordre TEST. Le passage LIVE doit rester une étape séparée avec limite de taille et confirmation explicite.
          </p>
        </div>
      </section>
    </div>
  );
}

function CheckRow({ checked, onClick, title, desc }: { checked: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl border border-surface-800 p-3 flex items-start gap-3 hover:bg-surface-900 transition-colors">
      <CheckCircle2 size={18} className={checked ? 'text-brand-400' : 'text-surface-600'} />
      <div>
        <p className={`text-sm ${checked ? 'text-white' : 'text-surface-300'}`}>{title}</p>
        <p className="text-[11px] text-surface-500 mt-1 break-all">{desc}</p>
      </div>
    </button>
  );
}

function Status({ title, value, ok }: { title: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-surface-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-surface-500">{title}</p>
      <p className={`text-sm font-semibold mt-1 break-all ${ok ? 'text-brand-400' : 'text-warn-300'}`}>{value}</p>
    </div>
  );
}

function CopyField({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-surface-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <code className="text-xs text-white break-all flex-1">{value}</code>
        <button className="btn-ghost p-2" onClick={onCopy} aria-label={'Copier ' + label}>
          {copied ? <CheckCircle2 size={14} className="text-brand-400"/> : <Copy size={14}/>}
        </button>
      </div>
    </div>
  );
}
