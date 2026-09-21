import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, ExternalLink, Landmark, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { api } from '../lib/api';

type Registry = Awaited<ReturnType<typeof api.getAssetRegistry>>;

const LINKS: Record<string,string> = {
  'Revolut X':'https://exchange.revolut.com/account/api-keys',
  'Binance':'https://www.binance.com/en/my/settings/api-management',
  'MEXC':'https://www.mexc.com/user/openapi',
  'Kraken':'https://pro.kraken.com/app/settings/api',
  'Coinbase':'https://www.coinbase.com/settings/api',
  'Bitstack':'https://bitstack-app.com/',
  'Phantom':'https://phantom.com/',
  'Solflare':'https://solflare.com/',
  'MetaMask':'https://metamask.io/',
  'Trust Wallet':'https://trustwallet.com/',
  'Grass Wallet':'https://app.getgrass.io/',
};

function short(a:string){ return a.length > 16 ? `${a.slice(0,8)}…${a.slice(-6)}` : a; }
function statusClass(s:string){
  if (/CONFIRMED|READ_ONLY|VERIFIED|ACTIVE|OPPORTUNITY_FOUND|PARTIAL/.test(s)) return 'badge-success';
  if (/ACTION_REQUIRED|CANDIDATE|RECOVERY|UNASSESSED/.test(s)) return 'badge-warning';
  return 'badge-neutral';
}

export default function AccountsPage(){
  const [data,setData]=useState<Registry|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const refresh=useCallback(async()=>{
    setLoading(true); setError('');
    try{ setData(await api.getAssetRegistry()); }
    catch(e){ setError(e instanceof Error ? e.message : 'Registre indisponible'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ void refresh(); },[refresh]);

  const confirmed=useMemo(()=>data?.wallets.filter(w=>w.ownership_status==='CONFIRMED')||[],[data]);
  const candidates=useMemo(()=>data?.wallets.filter(w=>w.ownership_status!=='CONFIRMED')||[],[data]);

  return (
    <div>
      <PageHeader icon={Landmark} title="Comptes & Wallets" subtitle="Inventaire privé multi-wallets · revenus · récupération · consolidation" />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-brand-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Règle de consolidation</p>
            <p className="text-xs text-surface-400 mt-1">Seuls les wallets CONFIRMED sont comptés comme patrimoine. Les anciens destinataires restent séparés jusqu’à preuve de contrôle. Aucun retrait ou sweep n’est exécuté depuis cette page.</p>
          </div>
        </div>
      </div>

      {loading && !data ? <LoadingSpinner /> : null}
      {error && <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Metric label="Comptes trouvés" value={String(data.summary.accountCount)} />
            <Metric label="Wallets confirmés" value={String(data.summary.confirmedWallets)} />
            <Metric label="Candidats" value={String(data.summary.candidateWallets)} />
            <Metric label="Historiques à vérifier" value={String(data.summary.unverifiedWallets)} />
            <Metric label="Hub préféré" value={data.summary.preferredHub || '—'} />
          </div>

          <div className="flex justify-end mb-4">
            <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
              <RefreshCw size={14} className={loading?'animate-spin':''}/> Actualiser
            </button>
          </div>

          <section className="card p-5 mb-6">
            <div className="flex items-center gap-2 mb-4"><Landmark size={17} className="text-brand-400"/><h2 className="font-semibold text-white">Applications & exchanges retrouvés</h2></div>
            <div className="space-y-3">
              {data.accounts.map(a=>(
                <div key={a.id} className="rounded-xl border border-surface-800 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{a.provider}</span>
                        {a.preferred_hub && <span className="badge-success">HUB CIBLE</span>}
                        <span className={statusClass(a.connection_status)}>{a.connection_status}</span>
                        {a.kyc_status && <span className={statusClass(a.kyc_status)}>{a.kyc_status}</span>}
                      </div>
                      <p className="text-xs text-surface-500 mt-2">{a.notes || '—'}</p>
                    </div>
                    {LINKS[a.provider] && (
                      <a className="btn-secondary inline-flex items-center gap-2 shrink-0" href={LINKS[a.provider]} target="_blank" rel="noreferrer">
                        Ouvrir <ExternalLink size={13}/>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5 mb-6">
            <div className="flex items-center gap-2 mb-4"><WalletCards size={17} className="text-brand-400"/><h2 className="font-semibold text-white">Wallets confirmés</h2></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {confirmed.map(w=><WalletRow key={w.id} w={w}/>)}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2 mb-4"><CircleDollarSign size={17} className="text-brand-400"/><h2 className="font-semibold text-white">À récupérer / vérifier</h2></div>
            <p className="text-xs text-surface-500 mb-4">Ces adresses proviennent principalement d’anciens retraits. Leur solde peut être public, mais elles ne seront jamais comptées comme tiennes avant confirmation de contrôle.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {candidates.map(w=><WalletRow key={w.id} w={w}/>)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function WalletRow({w}:{w:Registry['wallets'][number]}){
  return (
    <div className="rounded-xl border border-surface-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white">{w.label || w.chain}</p>
          <p className="text-xs text-surface-500 font-mono mt-1">{short(w.address)}</p>
        </div>
        <span className={statusClass(w.ownership_status)}>{w.ownership_status}</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        <span className="badge-neutral">{w.chain}</span>
        {w.native_symbol && <span className="badge-neutral">{Number(w.native_balance||0).toLocaleString('fr-FR',{maximumFractionDigits:8})} {w.native_symbol}</span>}
        <span className={statusClass(w.yield_status)}>{w.yield_status}</span>
      </div>
      {w.notes && <p className="text-[11px] text-surface-500 mt-3">{w.notes}</p>}
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}){
  return <div className="card p-4"><p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p><p className="text-lg font-bold text-white mt-2">{value}</p></div>;
}
