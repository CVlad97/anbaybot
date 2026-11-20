import { useEffect, useState } from 'react';

type Report = {
  mode: 'PAPER'; liveExecution: false; status: 'ok' | 'degraded'; checkedAt: string;
  symbol: string; source?: string; bid?: number; ask?: number; equity?: number;
  pnl?: number; decision: string; reason?: string; cash: number; initialCash: number;
  strategy: string; feeRate: number; slippageRate: number; currency: string;
  position?: { entry: number; qty: number } | null;
  fills: { at: string; side: string; price: number; qty: number; fee: number; reason: string }[];
};
const endpoint = 'https://delikreol.com/anbaybot-paper.json';
const number = (value?: number) => value == null ? 'Indisponible' : value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export default function DayTradingPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    let controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (disposed || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      setLoading(true);
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Service VPS indisponible');
        const data = await response.json() as Report;
        if (data.mode !== 'PAPER' || data.liveExecution !== false || !Number.isFinite(Date.parse(data.checkedAt))) {
          throw new Error('Rapport VPS invalide');
        }
        if (disposed) return;
        setReport(data);
        setError('');
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : 'Actualisation impossible');
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        if (!disposed) { setLoading(false); setNow(Date.now()); }
      }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    return () => { disposed = true; controller.abort(); window.clearInterval(timer); };
  }, []);

  const fresh = report && now - Date.parse(report.checkedAt) < 180000;
  const healthy = report?.status === 'ok' && fresh && !error;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Day trading · simulation VPS</h1>
        <p className="text-surface-400 mt-2">Capital de départ fictif de 1 000 USDT. Prix publics MEXC, frais simulés et journal conservé sur le serveur.</p>
      </div>
      <div role="status" className="card p-4">
        {healthy ? 'Moteur actif · actualisation chaque minute' : loading && !report ? 'Connexion au VPS…' : 'Données indisponibles ou périmées · simulation à vérifier'}
        {report && <p className="text-sm text-surface-400 mt-2">Dernier contrôle {new Date(report.checkedAt).toLocaleString('fr-FR')}</p>}
        {error && <p className="text-red-300 mt-2">{error}</p>}
      </div>
      {report && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[['Valeur simulée', number(report.equity)], ['P&L simulé', number(report.pnl)],
            ['BTC achat / vente', number(report.ask) + ' / ' + number(report.bid)], ['Décision', report.decision]].map(([label, value]) =>
            <div className="card p-4" key={label}><p className="text-surface-400 text-sm">{label}</p><p className="text-xl text-white mt-2">{value}</p></div>)}
        </div>
        <div className="card p-4 space-y-2">
          <p>{report.position ? 'Position fictive ouverte sur BTCUSDT' : 'Aucune position fictive ouverte'}</p>
          <p className="text-sm text-surface-400">{report.strategy}</p>
          <p className="text-sm text-surface-400">Frais par opération {(report.feeRate * 100).toFixed(2)} % · glissement simulé {(report.slippageRate * 100).toFixed(2)} % · taille fixe 100 USDT fictifs.</p>
          <p className="text-sm text-surface-400">Les opérations restent en simulation. Les résultats futurs et les gains réels restent à établir.</p>
        </div>
        <div className="card p-4 overflow-x-auto">
          <h2 className="font-semibold text-white mb-3">Journal des opérations fictives</h2>
          {report.fills.length === 0 ? <p className="text-surface-400">En attente d’un signal. Le moteur conserve le capital fictif disponible.</p> :
            <table className="w-full text-sm"><thead><tr><th>Date</th><th>Sens</th><th>Prix</th><th>Frais</th><th>Motif</th></tr></thead>
              <tbody>{report.fills.map((fill, index) => <tr key={fill.at + index}>
                <td className="p-2">{new Date(fill.at).toLocaleString('fr-FR')}</td><td>{fill.side}</td><td>{number(fill.price)}</td><td>{number(fill.fee)}</td><td>{fill.reason}</td>
              </tr>)}</tbody></table>}
        </div>
      </>}
    </div>
  );
}
