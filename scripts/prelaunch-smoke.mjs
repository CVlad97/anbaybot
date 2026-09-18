const BASE = process.env.ANBAYBOT_BASE_URL || 'https://cvlad97.github.io/anbaybot/';
const SUPABASE = process.env.ANBAYBOT_SUPABASE_URL || 'https://lmfwtiytqwedrazxjnwu.supabase.co';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const app = await fetch(BASE, { redirect: 'follow' });
  assert(app.ok, `app root HTTP ${app.status}`);
  const html = await app.text();
  assert(html.includes('root'), 'app root missing React mount point');

  const health = await getJson(`${SUPABASE}/functions/v1/anbaybot-public?path=health`);
  assert(health.status === 'ok', 'public health not ok');

  const portfolio = await getJson(`${SUPABASE}/functions/v1/anbaybot-public?path=portfolio`);
  assert(Array.isArray(portfolio.wallets), 'portfolio wallets missing');
  assert(Number.isFinite(Number(portfolio.totalValueUsd)), 'portfolio total invalid');

  const readiness = await getJson(`${SUPABASE}/functions/v1/anbaybot-public?path=readiness`);
  assert(typeof readiness.killSwitch === 'boolean', 'readiness killSwitch missing');
  assert(Array.isArray(readiness.exchanges), 'readiness exchanges missing');

  const strategies = await getJson(`${SUPABASE}/functions/v1/anbaybot-public?path=strategies`);
  assert(Array.isArray(strategies.strategies) && strategies.strategies.length >= 1, 'strategies missing');

  const goal = await getJson(`${SUPABASE}/functions/v1/anbaybot-public?path=goal`);
  assert(Number(goal.targetWeeklyEur) === 1000, 'weekly goal mismatch');
  assert(Number.isFinite(Number(goal.capitalEur)), 'goal capital invalid');

  const exchanges = await getJson(`${SUPABASE}/functions/v1/ikb-api?path=exchange/health`);
  assert(Array.isArray(exchanges.exchanges) && exchanges.exchanges.length === 2, 'exchange health incomplete');
  for (const row of exchanges.exchanges) {
    assert(['NOT_CONFIGURED','READ_ONLY','TEST_READY','LIVE_READY','ERROR'].includes(row.status), `unexpected exchange status: ${row.status}`);
  }

  if (readiness.liveEnabled) {
    assert(readiness.privateReady === true, 'LIVE enabled without privateReady');
    assert(readiness.killSwitch === false, 'LIVE enabled while kill switch active');
  }

  console.log(JSON.stringify({
    status: 'PASS',
    app: BASE,
    wallets: portfolio.wallets.length,
    strategies: strategies.strategies.length,
    exchanges: exchanges.exchanges.map(x => ({ exchange: x.exchange, status: x.status })),
    liveEnabled: readiness.liveEnabled,
    killSwitch: readiness.killSwitch,
  }, null, 2));
}

main().catch(err => {
  console.error('PRELAUNCH_SMOKE_FAIL:', err?.stack || err);
  process.exit(1);
});
