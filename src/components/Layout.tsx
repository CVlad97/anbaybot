import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, Users, Cpu, Terminal, ListOrdered,
  Shield, Menu, X, Zap, ChevronRight, LayoutDashboard,
  Repeat, Brain, Activity, DollarSign, CreditCard, HeartPulse,
} from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import OpportunityNotifications from './OpportunityNotifications';
import { clearAdminToken, getAdminToken, setAdminToken } from '../lib/auth';
import { useWalletAutoReconnect } from '../hooks/useWalletAutoReconnect';
import { publicApi } from '../lib/publicApi';

const BUILD_SHA = String(import.meta.env.VITE_BUILD_SHA || 'dev').slice(0, 7);

const NAV_ITEMS = [
  { path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/earnings', label: 'Revenus & P&L', icon: DollarSign },
  { path: '/wallets', label: 'Portefeuilles', icon: Wallet },
  { path: '/subscriptions', label: 'Souscriptions', icon: CreditCard },
  { path: '/monitoring', label: 'Monitoring 24/7', icon: HeartPulse },
  { path: '/signals', label: 'Signaux live', icon: TrendingUp },
  { path: '/traders', label: 'Traders suivis', icon: Users },
  { path: '/strategies', label: 'Stratégies', icon: Cpu },
  { path: '/auto-trade', label: 'Pilotage des ordres', icon: Repeat },
  { path: '/ai', label: 'Gestion IA', icon: Brain },
  { path: '/orchestration', label: 'Coordination', icon: Activity },
  { path: '/console', label: 'Console', icon: Terminal },
  { path: '/transactions', label: 'Historique', icon: ListOrdered },
  { path: '/safety', label: 'Sécurité', icon: Shield },
];

const ADMIN_PATHS = new Set(['/auto-trade', '/ai', '/console', '/safety']);

export default function Layout({ children }: { children: React.ReactNode }) {
  useWalletAutoReconnect();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState(() => getAdminToken());
  const [hasToken, setHasToken] = useState(() => Boolean(getAdminToken()));
  const location = useLocation();
  const navigate = useNavigate();
  const { solanaAddress, evmAddress } = useWalletStore();
  const activeAddress = solanaAddress || evmAddress;
  const showAdmin = ADMIN_PATHS.has(location.pathname);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        await publicApi.health();
        if (!cancelled) setServerOnline(true);
      } catch {
        if (!cancelled) setServerOnline(false);
      }
    }
    check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface-900 border border-surface-700 rounded-xl"
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-surface-950 border-r border-surface-800 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
              <Zap size={20} className="text-brand-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">ANBAYBOT</h1>
              <p className="text-xs text-surface-500 font-medium">LIVE · {BUILD_SHA}</p>
            </div>
          </div>
          {activeAddress && (
            <div className="mt-4 px-3 py-2 bg-surface-900 rounded-lg border border-surface-800">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">Wallet navigateur</p>
              <p className="text-xs text-brand-400 font-mono mt-0.5 truncate">{activeAddress}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${active ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900'}`}
              >
                <item.icon size={18} className={active ? 'text-brand-400' : 'text-surface-500 group-hover:text-surface-300'} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight size={14} className="text-brand-500" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-800 text-center">
          <p className="text-[10px] text-surface-600">Build {BUILD_SHA} · P&L LIVE uniquement vérifié</p>
        </div>
      </aside>

      <main className="flex-1 min-h-screen lg:ml-0">
        <div className="max-w-6xl mx-auto p-4 lg:p-8 pt-16 lg:pt-8">
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${serverOnline === true ? 'border-brand-500/30 bg-brand-500/10 text-brand-100' : serverOnline === false ? 'border-danger-500/30 bg-danger-500/10 text-danger-100' : 'border-surface-700 bg-surface-900 text-surface-300'}`}>
            <strong>{serverOnline === true ? 'Serveur réel connecté.' : serverOnline === false ? 'Serveur de lecture indisponible.' : 'Vérification du serveur…'}</strong>{' '}
            {serverOnline === true && 'Portefeuille et P&L sont lus en direct sans token admin.'}
          </div>

          {showAdmin && (
            <div className="mb-6 rounded-2xl border border-surface-700 bg-surface-900 px-4 py-3 text-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <strong className="text-surface-200">Administration sensible</strong>
                  <p className="text-xs text-surface-500 mt-1">Le token n’est requis que pour modifier la configuration ou préparer des opérations.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="input min-w-0 md:w-72"
                    placeholder="Token admin"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setAdminToken(tokenInput);
                      setHasToken(Boolean(tokenInput.trim()));
                    }}
                  >
                    {hasToken ? 'Mettre à jour' : 'Activer'}
                  </button>
                  {hasToken && (
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        clearAdminToken();
                        setTokenInput('');
                        setHasToken(false);
                      }}
                    >
                      Oublier
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {children}
        </div>
        <OpportunityNotifications />
      </main>
    </div>
  );
}
