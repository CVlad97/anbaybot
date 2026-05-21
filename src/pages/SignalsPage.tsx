import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Search, RefreshCw, ExternalLink, Flame, BarChart3 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { api } from '../lib/api';

interface MarketItem {
  id?: string;
  name?: string;
  symbol?: string;
  thumb?: string;
  priceUsd?: string;
  priceChange24h?: number;
  volume24h?: number;
  liquidity?: { usd?: number };
  url?: string;
  baseToken?: { name?: string; symbol?: string };
  chainId?: string;
  pairAddress?: string;
}

export default function SignalsPage() {
  const [tab, setTab] = useState<'trending' | 'movers' | 'search'>('trending');
  const [trending, setTrending] = useState<MarketItem[]>([]);
  const [movers, setMovers] = useState<MarketItem[]>([]);
  const [searchResults, setSearchResults] = useState<MarketItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.trending();
      const items = (data.items || []) as MarketItem[];
      setTrending(items);
    } catch {
      setTrending([]);
    }
    setLoading(false);
  }, []);

  const fetchMovers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.dexMovers();
      setMovers((data.items || []) as MarketItem[]);
    } catch {
      setMovers([]);
    }
    setLoading(false);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.tokenSearch(query);
      setSearchResults((data.items || []) as MarketItem[]);
    } catch {
      setSearchResults([]);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    if (tab === 'trending') fetchTrending();
    if (tab === 'movers') fetchMovers();
  }, [tab, fetchTrending, fetchMovers]);

  const tabs = [
    { id: 'trending' as const, label: 'Trending', icon: Flame },
    { id: 'movers' as const, label: 'Dex Movers', icon: BarChart3 },
    { id: 'search' as const, label: 'Search', icon: Search },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={TrendingUp}
        title="Live Signals"
        subtitle="Real-time market data from CoinGecko & DexScreener"
        action={
          <button onClick={() => tab === 'trending' ? fetchTrending() : fetchMovers()} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${tab === t.id ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'}
            `}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="flex gap-3 mb-6">
          <input
            className="input flex-1"
            placeholder="Search token name, symbol, or address..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-primary">Search</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : tab === 'trending' ? (
        trending.length === 0 ? (
          <EmptyState icon={Flame} title="No trending data" description="CoinGecko API may be unavailable. Try again later." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((item, i) => (
              <div key={item.id || i} className="card-hover p-5">
                <div className="flex items-center gap-3 mb-3">
                  {item.thumb && <img src={item.thumb} alt="" className="w-8 h-8 rounded-lg" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-surface-500 uppercase">{item.symbol}</p>
                  </div>
                  <span className="ml-auto text-xs text-surface-500 font-mono">#{(item as { market_cap_rank?: number }).market_cap_rank || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-400">
                  <span>Score: {(item as { score?: number }).score ?? 'N/A'}</span>
                  <span className="badge-green">Trending</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        (() => {
          const items = tab === 'movers' ? movers : searchResults;
          return items.length === 0 ? (
            <EmptyState icon={BarChart3} title="No results" description={tab === 'movers' ? 'DexScreener data unavailable' : 'Try a different search query'} />
          ) : (
            <div className="space-y-3">
              {items.map((pair, i) => (
                <div key={pair.pairAddress || i} className="card-hover p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">
                        {pair.baseToken?.symbol || pair.symbol || 'N/A'}
                        <span className="text-surface-500 font-normal">/{(pair as { quoteToken?: { symbol?: string } }).quoteToken?.symbol || ''}</span>
                      </p>
                      <span className="badge-neutral text-[10px]">{pair.chainId || 'N/A'}</span>
                    </div>
                    <p className="text-xs text-surface-500 font-mono truncate">{pair.pairAddress || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">${pair.priceUsd || 'N/A'}</p>
                    <p className={`text-xs font-medium ${(pair.priceChange24h || 0) >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                      {pair.priceChange24h != null ? `${pair.priceChange24h >= 0 ? '+' : ''}${pair.priceChange24h.toFixed(2)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-surface-500">Liq</p>
                    <p className="text-xs text-surface-300 font-mono">
                      ${pair.liquidity?.usd ? (pair.liquidity.usd / 1000).toFixed(0) + 'K' : 'N/A'}
                    </p>
                  </div>
                  {pair.url && (
                    <a href={pair.url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}
