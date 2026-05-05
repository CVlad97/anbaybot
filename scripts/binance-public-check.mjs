const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

console.log('=== Binance public market check ===');

for (const symbol of symbols) {
  const ticker = await getJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  console.log({
    symbol,
    lastPrice: ticker.lastPrice,
    priceChangePercent: ticker.priceChangePercent,
    quoteVolume: ticker.quoteVolume,
  });
}

console.log('=== Binance exchangeInfo BTCUSDT ===');

const exchangeInfo = await getJson('https://api.binance.com/api/v3/exchangeInfo?symbol=BTCUSDT');
const btc = exchangeInfo.symbols?.[0];

console.log({
  symbol: btc.symbol,
  status: btc.status,
  orderTypes: btc.orderTypes,
  filters: btc.filters.map((f) => f.filterType),
});
