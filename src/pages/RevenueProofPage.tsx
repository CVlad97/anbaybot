import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, FlaskConical, LockKeyhole, RefreshCw, Search, ShieldCheck, Target } from 'lucide-react';
import { publicApi } from '../lib/publicApi';
import { getAdminToken } from '../lib/auth';
import { isFreshTimestamp } from '../lib/dataHealth';
import { RESEARCH_DATE, REVENUE_MODULES, evidenceLabel, yieldScenario, type ProofSnapshot } from '../lib/revenueProof';

const money = (value: number) => value.toLocaleString('fr-FR', {style:'currency',currency:'USD'});
const categories = ['Tout', 'Sans capital', 'Capital', 'Marchés', 'Récompenses', 'Audience'];

export default function RevenueProofPage() {
  const [snapshot,setSnapshot] = useState<ProofSnapshot | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [category,setCategory] = useState('Tout');
  const [query,setQuery] = useState('');
  const [capital,setCapital] = useState('100');
  const [rate,setRate] = useState('5');
  const [days,setDays] = useState('30');
  const [costs,setCosts] = useState('1');
  const refresh = useCallback(async () => {
    setSnapshot(null);
    setError('');
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await publicApi.proof();
      if (getAdminToken() === token) setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture indisponible');
    } finally { setLoading(false); }
  },[]);
  useEffect(() => {
    refresh();
    window.addEventListener('anbaybot-auth-change',refresh);
    return () => window.removeEventListener('anbaybot-auth-change',refresh);
  },[refresh]);
  const modules = REVENUE_MODULES.filter(m => (category === 'Tout' || m.category === category) && (m.name+' '+m.platform+' '+m.state).toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  const simulation = [capital,rate,days,costs].some(v=>v.trim()==='') ? null : yieldScenario(Number(capital),Number(rate),Number(days),Number(costs));
  const fresh = Boolean(snapshot && isFreshTimestamp(snapshot.readiness.latestScanAt));

  return <div className="animate-fade-in space-y-6">
    <section className="rounded-3xl border border-brand-500/25 bg-gradient-to-br from-brand-900/30 via-surface-900 to-surface-950 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <span className="text-xs font-semibold tracking-widest uppercase text-brand-300 flex items-center gap-2"><Target size={15}/> Objectif : premier gain personnel prouvé</span>
        <span className="badge-neutral">Phase 1 · validation</span>
      </div>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white max-w-2xl">Mes revenus.<br/><span className="text-brand-400">Des preuves avant les promesses.</span></h1>
      <p className="text-sm text-surface-300 mt-4 max-w-2xl leading-relaxed">Un cockpit pour comparer les pistes, vérifier tes comptes et mesurer le net réellement reçu. Un solde, une simulation ou des points ne deviennent pas automatiquement un gain.</p>
      <div className="flex flex-wrap gap-3 mt-6">
        <button onClick={()=>document.getElementById("modules-revenus")?.scrollIntoView({behavior:"smooth"})} className="btn-primary inline-flex items-center gap-2">Explorer les 19 pistes <ArrowUpRight size={16}/></button>
        <Link to="/dashboard" className="btn-secondary">Voir mes données privées</Link>
      </div>
    </section>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Metric label="P&L inscrit au registre" value={snapshot ? money(snapshot.ledger.recentNetUsd) : '—'} detail={snapshot ? snapshot.ledger.recentCount+' dernières écritures sur '+snapshot.ledger.count+' LIVE · à rapprocher' : 'Accès propriétaire requis'}/>
      <Metric label="Encaissement indépendant" value="À établir" detail="Aucun rapprochement bancaire ou paiement validé par ce cockpit"/>
      <Metric label="Couverture de recherche" value="19 pistes" detail="12 modules existants + 7 pistes complémentaires"/>
    </div>

    <section className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-white font-semibold flex items-center gap-2"><ShieldCheck size={18} className="text-brand-400"/> État de mes comptes</h2>
        <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading || !getAdminToken()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>{loading ? 'Lecture…' : 'Actualiser mes preuves'}</button>
      </div>
      {!getAdminToken() && <p className="text-sm text-surface-400 mt-3 flex gap-2"><LockKeyhole size={17} className="shrink-0"/> Ouvre « Accès propriétaire » en haut de page pour lire tes comptes. Le catalogue reste consultable ; tes soldes et opérations sont privés.</p>}
      {error && <p role="alert" className="text-sm text-danger-300 mt-3">{error}. Aucun chiffre de remplacement.</p>}
      {snapshot && <div className="mt-4 space-y-3 text-sm">
        <div className="flex flex-wrap gap-2"><span className="badge-neutral">{snapshot.walletCount} wallets suivis</span><span className="badge-neutral">{evidenceLabel(snapshot)}</span><span className={fresh ? 'badge-success' : 'badge-warning'}>{fresh ? 'Scan récent' : 'Scan à actualiser'}</span></div>
        <div className="grid sm:grid-cols-2 gap-3">{snapshot.readiness.exchanges.map(e=><div key={e.exchange} className="rounded-xl border border-surface-700 p-3"><span className="text-white font-medium">{e.exchange}</span><span className="text-surface-400 ml-3">{e.connection_status}</span><p className="text-xs text-surface-500 mt-1">Dernier contrôle : {e.last_checked_at ? new Date(e.last_checked_at).toLocaleString('fr-FR') : 'inconnu'}</p></div>)}</div>
        {snapshot.paper && <p className="text-surface-400"><strong className="text-surface-200">Essai {snapshot.paper.mode} :</strong> {snapshot.paper.returnPct == null ? 'résultat indisponible' : snapshot.paper.returnPct.toFixed(3)+' %'}. Une simulation ne prouve aucun gain réel.</p>}
        <p className="text-xs text-surface-500">{snapshot.ledger.withReference} référence(s) sur les {snapshot.ledger.recentCount} dernières écritures. Une référence seule ne valide ni l’origine du paiement ni sa rentabilité. Lu le {new Date(snapshot.checkedAt).toLocaleString('fr-FR')}.</p>
      </div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {['1 · Compte éligible','2 · Opération documentée','3 · Net après coûts','4 · Encaissement rapproché'].map(t=><div key={t} className="rounded-xl border border-surface-800 bg-surface-950/50 p-3 text-xs text-surface-400">{t}</div>)}
      </div>
    </section>

    <section className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <h2 className="font-semibold text-white flex items-center gap-2"><CheckCircle2 size={18} className="text-brand-400"/> Le prochain résultat utile</h2>
        <ol className="list-decimal ml-5 text-sm text-surface-300 space-y-3 mt-4">
          <li>Vérifier tes comptes existants et les sommes déjà disponibles au retrait, sans déposer davantage.</li>
          <li>Si aucun revenu n’existe encore : vérifier une étude ou un test rémunéré accessible à ton profil, puis le réaliser personnellement.</li>
          <li>Rapprocher le versement reçu avec la source, la date, les frais et le temps passé.</li>
        </ol>
        <p className="text-xs text-surface-500 mt-4">Un premier travail peut commencer aujourd’hui. Admission, disponibilité et délais de paiement empêchent de garantir un encaissement aujourd’hui.</p>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold text-white flex items-center gap-2"><FlaskConical size={18} className="text-brand-400"/> Le rendement résiste-t-il aux frais ?</h2>
        <p className="text-xs text-surface-400 mt-2">Exemple mathématique modifiable, sans lien avec ton capital ni avec un taux actuellement proposé.</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[['Capital ($)',capital,setCapital],['APY hypothétique (%)',rate,setRate],['Durée (jours)',days,setDays],['Tous frais ($)',costs,setCosts]].map(([label,value,setter])=><label key={String(label)} className="text-xs text-surface-400">{String(label)}<input className="input w-full mt-1" type="number" step="any" value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}
        </div>
        <p role="status" className="text-2xl text-white font-semibold mt-4">{simulation ? money(simulation.net) : 'Saisie à vérifier'} <span className="text-xs font-normal text-surface-400">net théorique sur la durée</span></p>
        <p className="text-xs text-surface-500 mt-2">Capital × ((1 + APY / 100)^(jours / 365) − 1) − frais. Hors variation du token, défaut, perte en liquidité et fiscalité.</p>
      </div>
    </section>

    <section id="modules-revenus" className="space-y-4 scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-white">Audit de chaque piste</h2><p className="text-xs text-surface-400 mt-1">Documentation consultée le {RESEARCH_DATE} · éligibilité personnelle à confirmer · aucune promesse de rendement.</p></div><span className="text-sm text-surface-400" role="status">{modules.length} / 19 pistes</span></div>
      <div className="flex flex-wrap gap-2">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)} className={category===c ? 'btn-primary' : 'btn-secondary'}>{c}</button>)}</div>
      <label className="flex items-center gap-2 rounded-xl border border-surface-700 px-3 bg-surface-900"><Search size={17} className="text-surface-400"/><input aria-label="Rechercher une piste" className="input border-0 w-full" placeholder="Plateforme, stratégie ou blocage…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="grid md:grid-cols-2 gap-4">
        {modules.map(m=>{
          const observed = snapshot?.strategies.find(s=>s.strategy_key===m.id);
          return <article key={m.id} className="card p-5 flex flex-col">
            <div className="flex justify-between gap-3"><span className="text-xs uppercase tracking-wider text-brand-400">{m.category}</span><span className="text-xs text-surface-500">{m.platform}</span></div>
            <h3 className="text-lg font-semibold text-white mt-2">{m.name}</h3>
            <p className="text-xs text-warn-300 mt-2">{m.state}</p>
            <p className="text-sm text-surface-300 mt-3 leading-relaxed">{m.next}</p>
            <p className="text-xs text-surface-500 mt-3">{observed ? 'Moteur : '+observed.status+' · dernière vérification '+(observed.last_verified_at ? new Date(observed.last_verified_at).toLocaleString('fr-FR') : 'inconnue') : snapshot ? 'Aucun connecteur personnel vérifié pour cette piste.' : 'État de ton compte : non lu.'}</p>
            <details className="mt-4 border-t border-surface-800 pt-3"><summary className="text-sm text-brand-300 cursor-pointer">Preuve exigée & automatisation</summary>
              <p className="text-xs text-surface-300 mt-3"><strong>Preuve :</strong> {m.evidence}</p>
              <p className="text-xs text-surface-400 mt-3"><strong>Bot :</strong> {m.automation}</p>
              <p className="text-xs text-surface-500 mt-3">Le statut du moteur décrit ses données ou simulations. La rentabilité de ce module sur ton compte reste à démontrer.</p>
              <div className="flex flex-wrap gap-3 mt-3">{m.sources.map((url,i)=><a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-300 underline underline-offset-4">Source officielle {i+1} ↗</a>)}</div>
            </details>
          </article>;
        })}
      </div>
      {modules.length===0 && <p className="card p-5 text-surface-400">Aucune piste pour ce filtre. Modifie ta recherche.</p>}
    </section>

    <section className="card p-5 text-sm text-surface-400">
      <h2 className="text-white font-semibold mb-3">Ce que le VPS prend en charge</h2>
      <p>Lectures, contrôles de disponibilité et journaux compacts. Le catalogue s’affiche sans appel d’IA ; la preuve privée se lit à la demande. Les signatures, paris, dépôts et réponses personnelles ne sont pas automatisés ici.</p>
      <p className="mt-3">La prochaine amélioration est le rapprochement des historiques de tes comptes avec des versements réels, puis le suivi du gain net et du temps par module. Les offres commerciales restent en attente de cette validation.</p>
    </section>
  </div>;
}
function Metric({label,value,detail}:{label:string;value:string;detail:string}) {
  return <div className="card p-5"><p className="text-xs text-surface-400">{label}</p><p className="text-2xl font-bold text-white mt-2">{value}</p><p className="text-xs text-surface-500 mt-2">{detail}</p></div>;
}
