import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, Users, Cpu, Terminal, ListOrdered,
  Shield, Menu, X, Zap, ChevronRight, LayoutDashboard,
  Repeat, Brain, Activity,
} from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import OpportunityNotifications from './OpportunityNotifications';
import { isBackendConfigured, isDemoSupabase } from '../lib/supabase';
import { clearAdminToken, getAdminToken, setAdminToken } from '../lib/auth';
import { useWalletAutoReconnect } from '../hooks/useWalletAutoReconnect';

const NAV_ITEMS = [
  { path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/wallets', label: 'Portefeuilles', icon: Wallet },
  { path: '/signals', label: 'Signaux live', icon: TrendingUp },
  { path: '/traders', label: 'Traders suivis', icon: Users },
  { path: '/strategies', label: 'Stratégies', icon: Cpu },
  { path: '/auto-trade', label: 'Pilotage des ordres', icon: Repeat },
  { path: '/ai', label: 'Gestion IA', icon: Brain },
  { path: '/orchestration', label: 'Orchestration', icon: Activity },
  { path: '/console', label: 'Console', icon: Terminal },
  { path: '/transactions', label: 'Historique', icon: ListOrdered },
  { path: '/safety', label: 'Sécurité', icon: Shield },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  useWalletAutoReconnect();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState(() => getAdminToken());
  const [hasToken, setHasToken] = useState(() => Boolean(getAdminToken()));
  const location = useLocation();
  const navigate = useNavigate();
  const { solanaAddress, evmAddress } = useWalletStore();

  const activeAddress = solanaAddress || evmAddress;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface-900 border border-surface-700 rounded-xl"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-surface-950 border-r border-surface-800
        flex flex-col transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
              <Zap size={20} className="text-brand-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">IKB CopyBot</h1>
              <p className="text-xs text-surface-500 font-medium">PRO v2.0</p>
            </div>
          </div>
          {activeAddress && (
            <div className="mt-4 px-3 py-2 bg-surface-900 rounded-lg border border-surface-800">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider font-medium">Connecté</p>
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
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 group
                  ${active
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900'}
                `}
              >
                <item.icon size={18} className={active ? 'text-brand-400' : 'text-surface-500 group-hover:text-surface-300'} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight size={14} className="text-brand-500" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-800">
          <p className="text-[10px] text-surface-600 text-center">
            Aucune garantie de profit. Confirmation utilisateur requise.
          </p>
        </div>
      </aside>

      <main className="flex-1 min-h-screen lg:ml-0">
        <div className="max-w-6xl mx-auto p-4 lg:p-8 pt-16 lg:pt-8">
          {isDemoSupabase && (
            <div className="mb-6 rounded-2xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-sm text-warn-100">
              <strong className="text-warn-300">Mode public demo actif.</strong>{' '}
              GitHub Pages fonctionne sans secret. Les donnees sont locales au navigateur et aucune execution live n'est envoyee.
              Configure Supabase Edge Function + variables GitHub pour activer le cockpit reel.
            </div>
          )}
          {!isDemoSupabase && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${isBackendConfigured ? 'border-brand-500/30 bg-brand-500/10 text-brand-100' : 'border-danger-500/40 bg-danger-500/10 text-danger-100'}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <strong className={isBackendConfigured ? 'text-brand-300' : 'text-danger-300'}>Mode reel serveur.</strong>{' '}
                  {isBackendConfigured
                    ? 'Les operations passent par la fonction Edge securisee. Renseigne le token cockpit localement pour utiliser les routes privees.'
                    : 'Backend non configure: ajoute VITE_BACKEND_API_URL dans GitHub Pages.'}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="password"
                    className="input min-w-0 sm:w-72"
                    placeholder="Token cockpit local"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                  />
                  <button
                    className="btn-secondary whitespace-nowrap"
                    onClick={() => {
                      setAdminToken(tokenInput);
                      setHasToken(Boolean(tokenInput.trim()));
                    }}
                  >
                    {hasToken ? 'Mettre a jour' : 'Activer'}
                  </button>
                  {hasToken && (
                    <button
                      className="btn-ghost whitespace-nowrap"
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
