import { useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Plus, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

type Row = Awaited<ReturnType<typeof api.getBusinessRevenue>>['data'][number];
type Source = Row['source'];

const sources: Array<{ value: Source; label: string }> = [
  { value: 'SERVICES', label: 'Services' },
  { value: 'AFFILIATE', label: 'Affiliation' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'SAAS', label: 'SaaS' },
  { value: 'OTHER', label: 'Autre' },
];

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

export default function BusinessRevenuePanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<Source>('SERVICES');
  const [gross, setGross] = useState('');
  const [fees, setFees] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const result = await api.getBusinessRevenue();
      setRows(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture du registre business impossible');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.net_eur || 0), 0), [rows]);

  async function save() {
    const grossNum = Number(gross.replace(',', '.'));
    const feesNum = Number((fees || '0').replace(',', '.'));
    if (!Number.isFinite(grossNum) || grossNum <= 0) {
      setError('Le montant brut doit être supérieur à 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.addBusinessRevenue({
        source,
        gross_eur: grossNum,
        fees_eur: Number.isFinite(feesNum) && feesNum > 0 ? feesNum : 0,
        note: note.trim(),
        proof_ref: proof.trim(),
      });
      setGross('');
      setFees('');
      setNote('');
      setProof('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5 mb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <BriefcaseBusiness size={20} className="text-brand-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-white">Revenus business vérifiés</h3>
            <p className="text-xs text-surface-500 mt-1">Services, affiliation, referral et SaaS. Ces lignes alimentent l’objectif hebdomadaire.</p>
          </div>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={refresh}>
          <RefreshCw size={14}/> Actualiser
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-danger-500/30 bg-danger-500/5 p-3 text-xs text-danger-300">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-5">
        <select className="input" value={source} onChange={e => setSource(e.target.value as Source)}>
          {sources.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <input className="input" inputMode="decimal" placeholder="Brut €" value={gross} onChange={e => setGross(e.target.value)} />
        <input className="input" inputMode="decimal" placeholder="Frais €" value={fees} onChange={e => setFees(e.target.value)} />
        <input className="input md:col-span-2" placeholder="Note / client / opération" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <div className="flex flex-col md:flex-row gap-3 mt-3">
        <input className="input flex-1" placeholder="Référence de preuve (facture, paiement, lien…)" value={proof} onChange={e => setProof(e.target.value)} />
        <button className="btn-primary flex items-center justify-center gap-2" onClick={save} disabled={saving}>
          <Plus size={14}/> {saving ? 'Enregistrement…' : 'Ajouter revenu réel'}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-surface-800 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-surface-500">Total enregistré</p>
          <p className="text-lg font-semibold text-brand-400">{eur(total)}</p>
        </div>
        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
          {rows.slice(0, 10).map(row => (
            <div key={row.id} className="flex items-start justify-between gap-3 text-xs border-t border-surface-800 pt-2">
              <div>
                <p className="text-white">{row.source} · {new Date(row.occurred_at).toLocaleDateString('fr-FR')}</p>
                <p className="text-surface-500 mt-0.5">{row.note || 'Sans note'}{row.proof_ref ? ` · preuve: ${row.proof_ref}` : ''}</p>
              </div>
              <p className="font-semibold text-brand-400 whitespace-nowrap">{eur(Number(row.net_eur || 0))}</p>
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-surface-500">Aucun revenu business enregistré pour le moment.</p>}
        </div>
      </div>
    </section>
  );
}
