import { useCallback, useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw, ShieldCheck, Target } from 'lucide-react';
import { publicApi, type PublicPolymarket } from '../lib/publicApi';

type GeoState = {
  status: 'idle' | 'checking' | 'allowed' | 'blocked' | 'error';
  country?: string;
  region?: string;
  message?: string;
};

function usd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pctFromPrice(price: number | null | undefined) {
  if (price == null || !Number.isFinite(price)) return '—';
  return `${(price * 100).toFixed(1)}%`;
}

export default function PolymarketPanel() {
  const [data, setData] = useState<PublicPolymarket | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await publicApi.polymarket());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture Polymarket impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function checkGeo() {
    setGeo({ status: 'checking' });
    try {
      const response = await fetch('https://polymarket.com/api/geoblock', {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json() as { blocked?: boolean; country?: string; region?: string };
      setGeo({
        status: result.blocked ? 'blocked' : 'allowed',
        country: result.country,
        region: result.region,
        message: result.blocked
          ? 'Ouverture de nouvelles positions indisponible depuis cette IP.'
          : 'Cette IP n’est pas signalée comme bloquée par l’endpoint officiel.',
      });
    } catch {
      setGeo({
        status: 'error',
        message: 'Le navigateur n’a pas pu interroger directement le contrôle géographique Polymarket. Utilise le lien officiel ci-dessous.',
      });
    }
  }

  return (
    <section className="card p-5 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Target size={20} className="text-brand-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-white">Polymarket · Prediction Markets</h3>
            <p className="text-xs text-surface-500 mt-1">
              API publique connectée en lecture. Scanner limité aux marchés clairement crypto/sport non politiques.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={checkGeo} disabled={geo.status === 'checking'}>
            <ShieldCheck size={14} /> {geo.status === 'checking' ? 'Vérification…' : 'Vérifier mon éligibilité'}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-danger-500/30 bg-danger-500/5 p-3 text-xs text-danger-300">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        <Metric label="Connexion" value={data ? 'API CONNECTÉE' : loading ? 'VÉRIFICATION…' : 'INDISPONIBLE'} />
        <Metric label="Mode" value="READ ONLY / PAPER" />
        <Metric label="Marchés retenus" value={String(data?.markets.length || 0)} />
        <Metric label="Politique" value="EXCLUE DU SCANNER" />
      </div>

      <div className={`mt-4 rounded-xl border p-4 ${
        geo.status === 'allowed'
          ? 'border-brand-500/30 bg-brand-500/5'
          : geo.status === 'blocked'
            ? 'border-danger-500/30 bg-danger-500/5'
            : 'border-surface-800'
      }`}>
        <div className="flex items-start gap-3">
          <ShieldCheck size={17} className={geo.status === 'blocked' ? 'text-danger-400' : 'text-brand-400'} />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Éligibilité géographique</p>
            <p className="text-xs text-surface-400 mt-1">
              {geo.message || 'À vérifier depuis ton navigateur avant toute tentative d’ordre. Le serveur ne peut pas vérifier correctement ton IP personnelle.'}
            </p>
            {(geo.country || geo.region) && (
              <p className="text-xs text-surface-500 mt-1">
                Détection : {[geo.country, geo.region].filter(Boolean).join(' · ')}
              </p>
            )}
            <a
              href="https://docs.polymarket.com/api-reference/geoblock"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 mt-2"
            >
              Règles officielles Polymarket <ExternalLink size={11}/>
            </a>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-brand-400" />
          <h4 className="text-sm font-semibold text-white">Marchés non politiques les plus liquides détectés</h4>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {(data?.markets || []).slice(0, 8).map(market => (
            <div key={market.id} className="rounded-xl border border-surface-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">{market.question}</p>
                <span className="badge-neutral">DATA</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                <Small label="Prix implicite" value={pctFromPrice(market.lastTradePrice ?? market.outcomePrices[0])} />
                <Small label="Spread" value={market.spread == null ? '—' : `${(market.spread * 100).toFixed(2)} pts`} />
                <Small label="Liquidité" value={usd(market.liquidityUsd)} />
                <Small label="Vol. 24h" value={usd(market.volume24hUsd)} />
              </div>
              {market.rewardsDailyRate > 0 && (
                <p className="text-[11px] text-brand-400 mt-3">
                  Rewards indiquées par l’API : {market.rewardsDailyRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}/jour
                </p>
              )}
              <a
                href={`https://polymarket.com/market/${market.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 mt-3"
              >
                Voir le marché <ExternalLink size={10}/>
              </a>
            </div>
          ))}
        </div>

        {!loading && data?.markets.length === 0 && (
          <p className="text-xs text-surface-500">Aucun marché crypto/sport répondant aux filtres de liquidité n’a été retenu actuellement.</p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-surface-800 p-4 text-xs text-surface-400">
        Données de marché ≠ recommandation de pari. Aucun ordre Polymarket n’est envoyé par ANBAYBOT dans ce mode. L’activation LIVE ne sera possible qu’après éligibilité géographique, authentification wallet/API et contrôles de risque.
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p>
      <p className="text-sm font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-surface-600">{label}</p>
      <p className="text-xs text-surface-200 mt-0.5">{value}</p>
    </div>
  );
}
