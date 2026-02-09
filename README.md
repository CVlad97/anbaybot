# IKB CopyBot Stable Pro

A production-ready semi-automatic crypto trading assistant built with Next.js 14 App Router, TypeScript, Prisma, and Tailwind CSS.

## Key Features

### Core Functionality
- ✅ **Semi-Auto Trading:** Server prepares actions, user confirms with wallet signature
- ✅ **Multi-Wallet Support:** Phantom, Solflare (Solana) + MetaMask (EVM)
- ✅ **Mobile Compatible:** Deeplink support for mobile wallet browsers
- ✅ **Strategy Engine:** Pluggable strategies (momentum, defensive exit, payout)
- ✅ **Jupiter Integration:** V6 swap transactions with automatic routing
- ✅ **Kill Switch:** Emergency stop for all trading operations
- ✅ **Audit Logging:** Complete trail of all critical events
- ✅ **Market Data:** Live trending tokens and DEX movers

### Safety & Security
- ❌ **No Private Keys:** Server never stores or accesses private keys
- ✅ **User Confirmation Required:** Every trade needs explicit approval
- ✅ **Risk Parameters:** Configurable limits and safety checks
- ✅ **Graceful Degradation:** All external APIs fail safely
- ✅ **RLS Policies:** Row-level security on all database tables

## Tech Stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Prisma ORM
- **Blockchain:** @solana/web3.js, ethers.js
- **APIs:** Jupiter V6, CoinGecko, DexScreener, Helius (optional)
- **Validation:** Zod

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Phantom or Solflare wallet (for Solana trading)
- MetaMask (for Ethereum/Base - display only in v1)

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Database (Required)
DATABASE_URL="postgresql://user:password@localhost:5432/ikb_copybot"

# Application (Required)
NEXT_PUBLIC_APP_BASE_URL="http://localhost:3000"

# Security (Required for cron)
CRON_SECRET="your-secure-random-string-here"

# Optional: Helius (for webhooks)
\1\"\"
\1\"\"
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Optional: Open Prisma Studio to view database
npx prisma studio
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Connect a Wallet

- Install Phantom, Solflare, or MetaMask browser extension
- Open the app at `http://localhost:3000`
- Click "Phantom", "Solflare", or "MetaMask" in the top navigation
- Approve the connection
- Your wallet is now registered and ready to use

## Available Scripts

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run typecheck        # TypeScript validation
npm run lint             # Lint code (currently skipped due to ESLint 9 compatibility)

# Database
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Create and apply migrations
npx prisma studio        # Open Prisma Studio (database GUI)
```

## Project Structure

```
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ActionCard.tsx   # Action confirmation UI
│   │   ├── WalletConnect.tsx # Wallet connection component
│   │   └── ui/              # Generic UI components
│   ├── pages/               # Route pages
│   │   ├── ActionsPage.tsx  # Action pipeline management
│   │   ├── DashboardPage.tsx
│   │   ├── WalletsPage.tsx
│   │   ├── SafetyPage.tsx   # Risk params & audit logs
│   │   └── ...
│   ├── lib/
│   │   ├── engines/         # Trading strategies
│   │   │   └── strategies/  # Individual strategy implementations
│   │   ├── modules/         # Core modules (orchestrator, etc.)
│   │   ├── wallets/         # Wallet connection logic
│   │   ├── supabase.ts      # Supabase client
│   │   ├── validation.ts    # Zod schemas
│   │   └── types.ts         # TypeScript types
│   ├── store/               # Zustand state management
│   └── App.tsx              # Main app router
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── actions/         # Action pipeline API
│   │   ├── market-data/     # Market data API
│   │   ├── settings/        # Settings API
│   │   ├── helius-webhook/  # Webhook handler
│   │   └── signals-run/     # Strategy execution
│   └── migrations/          # Database schema
├── docs/
│   ├── SELF_HEAL_CHECKLIST.md  # Failure mode handling
│   ├── MODULES_DOCUMENTATION.md
│   └── ORCHESTRATION_GUIDE.md
└── .github/
    └── workflows/
        └── ci.yml           # GitHub Actions CI
```

## Edge Functions

The application uses Supabase Edge Functions for serverless API endpoints:

### Deployed Functions

1. **actions** - Action pipeline (prepare, build, confirm, refuse)
2. **market-data** - Trending tokens, DEX movers, token search
3. **settings** - Kill switch and risk parameter management
4. **helius-webhook** - Webhook receiver for Solana transaction events
5. **signals-run** - Strategy execution endpoint (cron-trigger)

### Calling Edge Functions

```typescript
const response = await fetch(
  `${VITE_SUPABASE_URL}/functions/v1/market-data?endpoint=trending`,
  {
    headers: {
      'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`,
    },
  }
);
```

## Database Schema

Key tables:

- **managed_wallets** - User's connected wallets
- **followed_wallets** - Wallets being tracked for copy trading
- **signals** - Market signals from various sources
- **actions** - Trading actions pending user confirmation
- **transactions** - Executed blockchain transactions
- **settings** - App configuration (kill switch, risk params)
- **audit_logs** - Security and event audit trail

All tables have Row-Level Security (RLS) enabled with anon access policies for single-user setup.

## Action Pipeline Flow

1. **PREPARED** - Strategy creates action in database
2. **TX_BUILT** - Jupiter transaction built with user's public key
3. **AWAITING_SIGNATURE** - UI prompts user to sign
4. **SUBMITTED** - Transaction sent to blockchain
5. **CONFIRMED** - Transaction confirmed on-chain

Users can refuse actions at any stage with a reason.

## Strategy System

Strategies are pluggable modules in `src/lib/engines/strategies/`:

- **momentum_dex** - Buys tokens with high 24h price change
- **defensive_exit** - Protects against losses
- **payout_150_eur** - Triggers payout when threshold reached
- **copy_swap_filtered** - Copies trades from top traders
- **ultra_aggressive** - High-risk, high-reward plays
- **all_tokens_scanner** - Scans all tokens for opportunities

Enable/disable strategies in the Auto-Trade page.

## Safety Features

### Kill Switch

Located in Console and Safety pages. When activated:
- All `prepare`, `build`, `confirm` operations return 403
- Existing actions remain in database
- Read operations continue working
- Can be toggled on/off instantly

### Risk Parameters

Configurable in Safety page:
- Max trade size (EUR)
- Max trades per day
- Max slippage (basis points)
- Min liquidity (USD)
- Payout threshold (EUR)
- Token blacklist

### Audit Logs

Every critical event is logged:
- Wallet connections
- Action creation, build, confirm, refuse
- Kill switch toggles
- Risk parameter changes
- Strategy execution

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   VITE_APP_BASE_URL (your Vercel URL)
   ```
4. Deploy

### Cron Setup (Optional)

For automated strategy execution:

1. Use Vercel Cron Jobs or external service (cron-job.org)
2. Configure to POST to:
   ```
   ${VITE_SUPABASE_URL}/functions/v1/signals-run
   ```
3. Add header:
   ```
   X-Cron-Secret: your-cron-secret
   ```
4. Recommended schedule: Every 15 minutes

### Webhook Setup (Optional)

For Helius transaction monitoring:

1. Create Helius account and get API key
2. Configure webhook in Helius dashboard:
   - URL: `${VITE_SUPABASE_URL}/functions/v1/helius-webhook`
   - Headers: `X-Webhook-Secret: your-webhook-secret`
   - Transaction types: Token transfers
3. Add followed wallet addresses to monitor

## Troubleshooting

### Wallet won't connect
- Ensure wallet extension is installed and unlocked
- On mobile, open app in wallet's browser using deeplinks
- Check browser console for errors

### Actions not appearing
- Verify database connection in Safety page
- Check kill switch status (should be OFF)
- Run manual signal scan in Console page

### Transaction build fails
- Ensure wallet is connected
- Check if you have sufficient SOL balance
- Verify Jupiter API is accessible (check browser network tab)

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Check that `.env` file has valid Supabase credentials
- Run `npm run typecheck` to find TypeScript errors

## Testing

### Manual Testing Checklist

1. ✅ Connect wallet (Phantom/Solflare)
2. ✅ Create test action (Actions page → Create Test Action)
3. ✅ Build transaction
4. ✅ Sign transaction in wallet
5. ✅ Verify transaction on Solscan
6. ✅ Toggle kill switch (Console page)
7. ✅ Verify kill switch blocks new actions

### API Health Checks

Visit Safety page → Click "Refresh" next to API Status to verify:
- CoinGecko API
- DexScreener API

## Security Considerations

1. **Never commit private keys** - Use wallet extensions only
2. **Review all transactions** - Check amounts before signing
3. **Start small** - Test with minimal amounts first
4. **Monitor audit logs** - Review Safety page regularly
5. **Use kill switch** - In case of suspicious activity

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:
- Installs dependencies
- Runs linting
- Type checks TypeScript
- Builds production bundle

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure `npm run build` succeeds
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please open a GitHub issue.

## Disclaimer

This software is for educational purposes only. Cryptocurrency trading carries significant risk. Always do your own research and never invest more than you can afford to lose. The authors are not responsible for any financial losses.
