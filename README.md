# AnbayBot — Semi-Auto Crypto Trading Assistant

**AnbayBot** is a production-ready semi-automatic cryptocurrency trading interface built with **React 18, TypeScript, and Vite**. It supports **Solana** (Phantom, Solflare) and **EVM** (MetaMask, Trust Wallet, Coinbase Wallet) wallets and provides a full cockpit for monitoring market data, managing trading actions, and controlling risk.

> ⚠️ **Security-first design:** The server never stores or accesses private keys. All transactions require explicit user confirmation with wallet signature. Live trading is disabled by default.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React 18](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org) |
| **Bundler** | [Vite 8](https://vitejs.dev) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com) + custom components |
| **State** | [Zustand](https://github.com/pmndrs/zustand) |
| **Validation** | [Zod 4](https://zod.dev) |
| **Icons** | [Lucide React](https://lucide.dev) |
| **Backend** | [Supabase](https://supabase.com) Edge Functions |
| **Blockchain** | [`@solana/web3.js`](https://solana-labs.github.io/solana-web3.js), [`ethers`](https://docs.ethers.org) |
| **Mobile** | Wallet deep-links (Phantom, Solflare, MetaMask, Trust Wallet) |

---

## Key Features

### Core
- ✅ **Semi-Auto Trading** — Server prepares actions, you confirm with wallet signature
- ✅ **Multi-Wallet** — Phantom, Solflare (Solana) + MetaMask, Trust Wallet, Coinbase Wallet (EVM)
- ✅ **Mobile Compatible** — Deeplink support for in-wallet browsing
- ✅ **Strategy Engine** — Pluggable strategies (momentum, defensive exit, payout, copy trading, etc.)
- ✅ **Jupiter Integration** — V6 swap transactions with automatic routing (via backend)
- ✅ **Kill Switch** — Emergency stop for all trading operations
- ✅ **Audit Logging** — Complete trail of all critical events
- ✅ **Market Data** — Live trending tokens (CoinGecko) and DEX movers (DexScreener)
- ✅ **Demo Mode** — Full local demo without any backend (ready to use on GitHub Pages)
- ✅ **Runtime Fallback** — Auto-fallback to local demo when the backend is unreachable

### Safety
- ❌ **No Private Keys** — Server never stores or accesses private keys
- ✅ **User Confirmation** — Every trade needs explicit human approval
- ✅ **Risk Parameters** — Configurable limits (max trade size, daily loss, slippage, etc.)
- ✅ **Graceful Degradation** — All external APIs fail safely

---

## Getting Started

### Prerequisites

- **Node.js 18+** with npm
- **A wallet** (Phantom, Solflare, MetaMask, etc.) — browser extension or mobile app

### 1. Install

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required for backend features:
- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Your Supabase anon/public key

Optional but recommended:
- `VITE_SOLANA_RPC_URL` — Custom Solana RPC (default: `https://api.mainnet-beta.solana.com`)
- `VITE_ETHEREUM_RPC_URL` — Custom Ethereum RPC (default: `https://mainnet.base.org`)

### 3. Start Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Connect a Wallet

- Install Phantom, Solflare, or MetaMask browser extension
- Open the app and click the wallet button in the header
- Approve the connection

---

## Available Scripts

```bash
npm run dev         # Start Vite dev server (hot reload)
npm run build       # Build for production + copy 404.html for GitHub Pages
npm run preview     # Preview production build locally
npm run lint        # ESLint check
npm run typecheck   # TypeScript type checking (tsc --noEmit)
```

---

## GitHub Pages Deployment

The project is ready for GitHub Pages:

1. Set `VITE_BASE_PATH` to your repo name (e.g., `/anbaybot`) in GitHub repo variables
2. The build script automatically copies `index.html` → `404.html` for SPA deep-link support
3. Enable GitHub Pages in repo settings → Source: GitHub Actions or deploy from `dist/` folder

```yaml
# Example deploy step
- run: npm run build
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
```

**Demo mode** works out of the box on GitHub Pages — no backend required. All market data is fetched client-side from public APIs (CoinGecko, DexScreener).

---

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/               # Generic UI primitives
│   ├── WalletConnect.tsx  # Wallet connection (Solana + EVM)
│   └── ...
├── pages/                # Route pages (Dashboard, Console, Wallets, etc.)
├── lib/
│   ├── engines/          # Trading strategies and scoring
│   │   └── strategies/   # Individual strategy implementations
│   ├── modules/          # Core modules (orchestrator, AI sentiment, etc.)
│   ├── wallets/          # Wallet connection logic (Solana, EVM)
│   ├── supabase.ts       # Supabase client
│   ├── api.ts            # API layer (Edge Functions + local demo fallback)
│   ├── localDb.ts        # Local in-memory database (demo mode)
│   └── types.ts          # TypeScript type definitions
├── store/                # Zustand state management
├── App.tsx               # Main app with routing
└── main.tsx              # Entry point
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | For backend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | For backend | Supabase anon key |
| `VITE_SOLANA_RPC_URL` | Optional | Solana RPC endpoint |
| `VITE_ETHEREUM_RPC_URL` | Optional | Ethereum/EVM RPC endpoint |
| `VITE_BACKEND_API_URL` | Optional | Custom Edge Function URL |
| `VITE_APP_BASE_URL` | Optional | App URL for wallet deeplinks |
| `VITE_BASE_PATH` | Optional | Base path for GitHub Pages |
| `VITE_ENABLE_TX_SIGNING` | Optional | Enable wallet-side signing |
| `VITE_ANBAYBOT_DEMO_ENABLED` | Optional | Force demo/local mode |

---

## Architecture

### Action Pipeline

1. **PREPARED** — Strategy creates action in database
2. **TX_BUILT** — Jupiter transaction built with user's public key
3. **AWAITING_SIGNATURE** — UI prompts user to sign
4. **SUBMITTED** — Transaction sent to blockchain
5. **CONFIRMED** — Transaction confirmed on-chain

Users can refuse actions at any stage.

### Strategy System

Pluggable strategies in `src/lib/engines/strategies/`:

- **momentum_dex** — Buys tokens with high 24h price change
- **defensive_exit** — Protects against losses
- **payout_150_eur** — Triggers payout when threshold reached
- **copy_swap_filtered** — Copies trades from top traders
- **ultra_aggressive** — High-risk, high-reward plays
- **all_tokens_scanner** — Scans all tokens for opportunities
- **trend_momentum_safe** — Safer trend-following
- **breakout_retest_safe** — Breakout retest strategy
- **volume_spike_safe** — Volume spike detection
- **mean_reversion_safe** — Mean reversion trading

### Runtime Fallback

When the backend is unreachable (or in demo mode), the app falls back to a **local in-memory database** (`localDb.ts`). All market data is fetched directly from public APIs:

- 📊 **CoinGecko** — Trending coins, prices
- 📈 **DexScreener** — DEX movers, token search
- 💱 **Binance** — Spot prices (public API, no key required)

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Wallet won't connect | Ensure extension is installed/unlocked; on mobile, use the wallet's browser via deep-links |
| Actions not appearing | Check kill switch (should be OFF); run manual signal scan |
| Build fails | `npm install` first; check `.env` file is valid |
| Backend unavailable | Demo mode auto-activates; all features work with local data |

---

## Security

1. **Never commit private keys** — The `.env` file is in `.gitignore`
2. **Review all transactions** — Check amounts before signing in your wallet
3. **Start small** — Test with minimal amounts first
4. **Monitor audit logs** — Review in the Safety page regularly
5. **Use kill switch** — Emergency stop available at all times

## CI/CD

GitHub Pages deployment is ready. The build is statically served — no server-side runtime required.

## License

MIT

## Disclaimer

This software is for **educational purposes only**. Cryptocurrency trading carries significant risk. Always do your own research and never invest more than you can afford to lose. The authors are not responsible for any financial losses.
