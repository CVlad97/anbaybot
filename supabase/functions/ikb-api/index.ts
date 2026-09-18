import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { fetchTrackedWalletBalances, type TrackedWallet } from "./wallets.ts";

const ORIGIN = "https://cvlad97.github.io";
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": req.headers.get("Origin") === ORIGIN ? ORIGIN : ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,apikey,X-Anbaybot-Admin-Token",
  "Vary": "Origin",
});
const json = (req: Request, data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors(req),"Content-Type":"application/json"}});
const route = (req: Request) => new URL(req.url).searchParams.get("path") || "health";

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { return ""; }
}
function db() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = serviceKey();
  if (!url || !key) throw new Error("supabase_server_credentials_missing");
  return createClient(url, key, {global:{headers:{"X-Client-Info":"anbaybot-edge-v7"}}});
}
async function sha256(v:string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
const PUBLIC = new Set(["health","trading/prices","market/trending","market/dex-movers","market/token-search","exchange/health"]);
async function requireAdmin(req:Request, path:string, s:ReturnType<typeof db>) {
  if (PUBLIC.has(path)) return null;
  const token = req.headers.get("X-Anbaybot-Admin-Token") || "";
  if (!token) return json(req,{error:"Unauthorized",message:"Cockpit admin token required."},401);
  const hash = await sha256(token);
  const {data,error} = await s.from("admin_tokens").select("id").eq("token_hash",hash).eq("active",true).maybeSingle();
  if (error || !data) return json(req,{error:"Unauthorized",message:"Invalid cockpit token."},401);
  return null;
}
async function audit(s:ReturnType<typeof db>, event:string, meta:Record<string,unknown>={}) {
  await s.from("audit_logs").insert({event,meta});
  await s.from("audit_ledger").insert({severity:"INFO",event_type:event,actor_type:"API",source:"ikb-api-v7",sanitized_payload:meta});
}
async function settings(s:ReturnType<typeof db>) {
  const {data,error}=await s.from("settings").select("*").limit(1).maybeSingle();
  if(error) throw error; return data;
}
function mexcBase(){return Deno.env.get("MEXC_BASE_URL")||"https://api.mexc.com";}

function binanceBase(){return Deno.env.get("BINANCE_BASE_URL")||"https://api.binance.com";}
function binanceConfigured(){return Boolean(Deno.env.get("BINANCE_API_KEY")&&Deno.env.get("BINANCE_API_SECRET"));}
function mexcConfigured(){return Boolean(Deno.env.get("MEXC_API_KEY")&&Deno.env.get("MEXC_API_SECRET"));}
async function hmac(secret:string,payload:string){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(payload));return Array.from(new Uint8Array(sig)).map(x=>x.toString(16).padStart(2,"0")).join("");}

async function binanceSigned(method:"GET"|"POST", path:string, params:Record<string,string|number>={}){
  const key=Deno.env.get("BINANCE_API_KEY")||"", secret=Deno.env.get("BINANCE_API_SECRET")||"";
  if(!key||!secret) throw new Error("binance_credentials_missing");
  const q=new URLSearchParams(); Object.entries(params).forEach(([k,v])=>q.set(k,String(v))); q.set("timestamp",String(Date.now())); q.set("recvWindow","5000");
  const qs=q.toString(), sig=await hmac(secret,qs);
  const r=await fetch(`${binanceBase()}${path}?${qs}&signature=${sig}`,{method,headers:{"X-MBX-APIKEY":key}});
  const txt=await r.text(); if(!r.ok) throw new Error(`binance_${r.status}:${txt.slice(0,240)}`); return txt?JSON.parse(txt):{};
}
async function signed(method:"GET"|"POST", path:string, params:Record<string,string|number>={}){
  const key=Deno.env.get("MEXC_API_KEY")||"", secret=Deno.env.get("MEXC_API_SECRET")||"";
  if(!key||!secret) throw new Error("mexc_credentials_missing");
  const q=new URLSearchParams(); Object.entries(params).forEach(([k,v])=>q.set(k,String(v))); q.set("timestamp",String(Date.now())); q.set("recvWindow","5000");
  const qs=q.toString(), sig=await hmac(secret,qs); const r=await fetch(`${mexcBase()}${path}?${qs}&signature=${sig}`,{method,headers:{"X-MEXC-APIKEY":key}});
  const txt=await r.text(); if(!r.ok) throw new Error(`mexc_${r.status}:${txt.slice(0,240)}`); return txt?JSON.parse(txt):{};
}
async function prices(){const syms=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","TRXUSDT"];return await Promise.all(syms.map(async symbol=>{try{const r=await fetch(`${mexcBase()}/api/v3/ticker/24hr?symbol=${symbol}`);const d=await r.json();return {symbol,lastPrice:Number(d.lastPrice||0),priceChangePercent:Number(d.priceChangePercent||0),quoteVolume:Number(d.quoteVolume||0)};}catch{return {symbol,lastPrice:0,priceChangePercent:0,quoteVolume:0};}}));}

type ExchangeHealthRow = {
  exchange: "BINANCE" | "MEXC";
  configured: boolean;
  readOk: boolean;
  status: "NOT_CONFIGURED" | "READ_ONLY" | "ERROR";
  errorCode: string | null;
  lastCheckedAt: string;
};
type RiskSettings = { risk_params?: Record<string, unknown> } | null;
type TradableAccount = { tradableCapitalUsd?: number } | null;
type PnlValueRow = { net_pnl_usd?: unknown };

async function exchangeHealth(s:ReturnType<typeof db>){
  const checkedAt=new Date().toISOString();
  const results:ExchangeHealthRow[]=[];
  for(const exchange of ["BINANCE","MEXC"] as const){
    const configured=exchange==="BINANCE"?binanceConfigured():mexcConfigured();
    let readOk=false, errorCode="";
    if(configured){
      try{
        if(exchange==="BINANCE") await binanceSigned("GET","/api/v3/account",{omitZeroBalances:"true"});
        else await signed("GET","/api/v3/account");
        readOk=true;
      }catch(e){
        const msg=e instanceof Error?e.message:"connection_failed";
        errorCode=msg.split(":")[0].slice(0,80);
      }
    }
    const status=configured?(readOk?"READ_ONLY":"ERROR"):"NOT_CONFIGURED";
    await s.from("exchange_accounts").update({
      connection_status:status,
      last_checked_at:checkedAt,
      note: readOk ? "API privée vérifiée en lecture; aucune transaction exécutée." : configured ? `API configurée mais lecture échouée: ${errorCode}` : "Clés API absentes côté serveur."
    }).eq("exchange",exchange);
    results.push({exchange,configured,readOk,status,errorCode:errorCode||null,lastCheckedAt:checkedAt});
  }
  return {exchanges:results,liveTradingEnabled:Deno.env.get("ALLOW_LIVE_TRADING")==="true",killSwitch:(await settings(s))?.kill_switch??true,checkedAt};
}

async function testExchangeOrder(exchange:"BINANCE"|"MEXC", symbol:string, side:"BUY"|"SELL", amountUsd:number){
  const pair=String(symbol||"BTC").toUpperCase().replace(/USDT$/,"")+"USDT";
  const amt=Math.max(1,Math.min(10,Number(amountUsd||1)));
  if(side!=="BUY") throw new Error("test_only_buy_supported");
  if(exchange==="BINANCE"){
    const raw=await binanceSigned("POST","/api/v3/order/test",{symbol:pair,side:"BUY",type:"MARKET",quoteOrderQty:amt.toFixed(2)});
    return {exchange,mode:"TEST",status:"ACCEPTED",symbol:pair,side:"BUY",amountUsd:amt,message:"Binance order/test accepted; no asset bought or sold.",raw};
  }
  const raw=await signed("POST","/api/v3/order/test",{symbol:pair,side:"BUY",type:"MARKET",quoteOrderQty:amt.toFixed(2)});
  return {exchange,mode:"TEST",status:"ACCEPTED",symbol:pair,side:"BUY",amountUsd:amt,message:"MEXC order/test accepted; no asset bought or sold.",raw};
}

async function riskState(s:ReturnType<typeof db>, cfg:RiskSettings, acct:TradableAccount){
  const rp=cfg?.risk_params||{};
  const now=new Date();
  const startDay=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();
  const startWeek=new Date(now.getTime()-7*86_400_000).toISOString();

  const [
    {data:dayPnl,error:dayErr},
    {data:weekPnl,error:weekErr},
    {data:recentPnl,error:recentErr},
    {count:liveOrdersToday,error:ordersErr},
  ]=await Promise.all([
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").gte("occurred_at",startDay),
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").gte("occurred_at",startWeek),
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").order("occurred_at",{ascending:false}).limit(20),
    s.from("audit_logs").select("id",{count:"exact",head:true}).eq("event","mexc_live_order_submitted").gte("created_at",startDay),
  ]);
  if(dayErr)throw dayErr;if(weekErr)throw weekErr;if(recentErr)throw recentErr;if(ordersErr)throw ordersErr;

  const dayNet=(dayPnl||[]).reduce((sum:number,row:PnlValueRow)=>sum+Number(row.net_pnl_usd||0),0);
  const weekNet=(weekPnl||[]).reduce((sum:number,row:PnlValueRow)=>sum+Number(row.net_pnl_usd||0),0);
  let consecutiveLosses=0;
  for(const row of recentPnl||[]){
    if(Number(row.net_pnl_usd||0)<0) consecutiveLosses++;
    else break;
  }

  const capital=Math.max(0,Number(acct?.tradableCapitalUsd||0));
  const maxTradeFixed=Math.max(0,Number(rp.maxTradeSizeEur??100));
  const maxTradePct=Math.max(0,Number(rp.maxTradeSizePctCapital??10));
  const dynamicCap=capital*(maxTradePct/100);
  const maxOrderUsd=Math.max(0,Math.min(maxTradeFixed,dynamicCap||maxTradeFixed,capital));

  const dailyLossLimit=capital*Math.max(0,Number(rp.maxDailyLossPctCapital??2))/100;
  const weeklyLossLimit=capital*Math.max(0,Number(rp.maxWeeklyLossPctCapital??5))/100;
  const maxTradesPerDay=Math.max(1,Number(rp.maxTradesPerDay??6));
  const haltAfterLosses=Math.max(1,Number(rp.haltAfterConsecutiveLosses??3));
  const dailyLossUsd=Math.max(0,-dayNet);
  const weeklyLossUsd=Math.max(0,-weekNet);

  const reasons:string[]=[];
  if(dailyLossLimit>0&&dailyLossUsd>=dailyLossLimit) reasons.push("daily_loss_limit");
  if(weeklyLossLimit>0&&weeklyLossUsd>=weeklyLossLimit) reasons.push("weekly_loss_limit");
  if(consecutiveLosses>=haltAfterLosses) reasons.push("consecutive_loss_limit");
  if(Number(liveOrdersToday||0)>=maxTradesPerDay) reasons.push("daily_trade_limit");

  return {
    mode:String(rp.riskMode||"DYNAMIC"),
    stage:String(rp.liveRampStage||"TEST"),
    maxOrderUsd,
    maxTradeSizePctCapital:maxTradePct,
    maxRiskPerTradePctCapital:Number(rp.maxRiskPerTradePctCapital??0.75),
    dailyLossUsd,
    dailyLossLimitUsd:dailyLossLimit,
    weeklyLossUsd,
    weeklyLossLimitUsd:weeklyLossLimit,
    consecutiveLosses,
    haltAfterConsecutiveLosses:haltAfterLosses,
    liveOrdersToday:Number(liveOrdersToday||0),
    maxTradesPerDay,
    remainingTradesToday:Math.max(0,maxTradesPerDay-Number(liveOrdersToday||0)),
    minLiquidityUsd:Number(rp.minLiquidityUsd??250000),
    minConfidencePct:Number(rp.minConfidencePct??75),
    blocked:reasons.length>0,
    blockReasons:reasons,
  };
}

async function account(){
  const configured=Boolean(Deno.env.get("MEXC_API_KEY")&&Deno.env.get("MEXC_API_SECRET"));
  if(!configured) return {totalAccountValueUsd:0,freeStableUsd:0,tradableCapitalUsd:0,canTradeLive:false,missingConfig:true,assets:[],note:"Backend reel actif; compte MEXC non connecte."};
  const a=await signed("GET","/api/v3/account") as {balances?:Array<{asset:string,free:string,locked:string}>};
  const assets=(a.balances||[]).map(x=>({asset:x.asset,free:Number(x.free||0),locked:Number(x.locked||0)})).filter(x=>x.free>0||x.locked>0);
  const stable=new Set(["USDT","USDC","FDUSD","DAI","TUSD"]); let freeStableUsd=0,total=0;
  for(const x of assets){if(stable.has(x.asset)){freeStableUsd+=x.free;total+=x.free+x.locked;}}
  return {totalAccountValueUsd:total,freeStableUsd,tradableCapitalUsd:freeStableUsd*0.9,canTradeLive:Deno.env.get("ALLOW_LIVE_TRADING")==="true",missingConfig:false,assets,note:"Compte MEXC reel connecte cote serveur."};
}
async function cockpit(s:ReturnType<typeof db>){
  const [cfg,px,acct,walletQuery]=await Promise.all([
    settings(s),
    prices(),
    account(),
    s.from("managed_wallets").select("id,chain,label,address,platform,enabled").eq("enabled",true)
  ]);
  const wallets=(walletQuery.data||[]) as TrackedWallet[];
  const sorted=[...px].sort((a,b)=>b.priceChangePercent-a.priceChangePercent),top=sorted[0]||{symbol:"BTCUSDT",priceChangePercent:0};
  const kill=Boolean(cfg?.kill_switch), live=Boolean(!acct.missingConfig&&Deno.env.get("ALLOW_LIVE_TRADING")==="true");

  const rp=(cfg?.risk_params||{}) as Record<string,unknown>;
  const maxFixed=Math.max(1,Number(rp.maxTradeSizeEur||100));
  const maxPct=Math.max(0.1,Math.min(100,Number(rp.maxTradeSizePctCapital||10)));
  const maxDailyLossPct=Math.max(0.1,Number(rp.maxDailyLossPctCapital||2));
  const maxWeeklyLossPct=Math.max(0.1,Number(rp.maxWeeklyLossPctCapital||5));
  const haltAfterLosses=Math.max(1,Number(rp.haltAfterConsecutiveLosses||3));

  const tradable=Math.max(0,Number(acct.tradableCapitalUsd||0));
  const dynamicMax=Math.max(1,Math.min(maxFixed,tradable*(maxPct/100)));

  const dayStart=new Date(); dayStart.setUTCHours(0,0,0,0);
  const weekStart=new Date(Date.now()-7*86_400_000);
  const [{data:dailyRows},{data:weeklyRows},{data:recentRows}]=await Promise.all([
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").gte("occurred_at",dayStart.toISOString()),
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").gte("occurred_at",weekStart.toISOString()),
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").order("occurred_at",{ascending:false}).limit(haltAfterLosses)
  ]);
  const dailyPnl=(dailyRows||[]).reduce((sum,row)=>sum+Number(row.net_pnl_usd||0),0);
  const weeklyPnl=(weeklyRows||[]).reduce((sum,row)=>sum+Number(row.net_pnl_usd||0),0);
  const baseCapital=Math.max(Number(acct.totalAccountValueUsd||0),tradable,1);
  const dailyLossLimit=baseCapital*(maxDailyLossPct/100);
  const weeklyLossLimit=baseCapital*(maxWeeklyLossPct/100);
  const dailyStop=dailyPnl<=-dailyLossLimit;
  const weeklyStop=weeklyPnl<=-weeklyLossLimit;
  const consecutiveLossStop=(recentRows||[]).length>=haltAfterLosses&&(recentRows||[]).every(row=>Number(row.net_pnl_usd||0)<0);
  const riskHalt=dailyStop||weeklyStop||consecutiveLossStop;

  return {
    updatedAt:new Date().toISOString(),
    settings:cfg,
    prices:px,
    account:acct,
    wallets,
    recommendation:{
      action:"WAIT",
      symbol:String(top.symbol).replace(/USDT$/,""),
      side:"HOLD",
      amountUsd:0,
      confidence:50,
      momentum:Number(top.priceChangePercent||0),
      reasoning:["Backend reel actif","Aucun ordre autonome force"],
      timestamp:new Date().toISOString()
    },
    validation:{
      passed:!kill&&!acct.missingConfig&&!riskHalt,
      canSubmit:!kill&&!acct.missingConfig&&!riskHalt&&tradable>0,
      killSwitchActive:kill,
      liveTradingEnabled:live,
      tradableCapitalUsd:tradable,
      maxOrderUsd:dynamicMax,
      riskMode:String(rp.riskMode||"DYNAMIC"),
      liveRampStage:String(rp.liveRampStage||"TEST"),
      dailyPnlUsd:dailyPnl,
      weeklyPnlUsd:weeklyPnl,
      dailyLossLimitUsd:dailyLossLimit,
      weeklyLossLimitUsd:weeklyLossLimit,
      riskHalt,
      issues:[
        ...(kill?[{field:"killSwitch",message:"Kill switch active",severity:"error"}]:[]),
        ...(acct.missingConfig?[{field:"exchange",message:"Private exchange credentials missing",severity:"warning"}]:[]),
        ...(dailyStop?[{field:"dailyLoss",message:"Daily loss limit reached",severity:"error"}]:[]),
        ...(weeklyStop?[{field:"weeklyLoss",message:"Weekly loss limit reached",severity:"error"}]:[]),
        ...(consecutiveLossStop?[{field:"lossStreak",message:"Consecutive-loss halt active",severity:"error"}]:[])
      ]
    },
    pnl:{totalValueUsd:acct.totalAccountValueUsd,pnlUsd:weeklyPnl,pnlPct:baseCapital>0?(weeklyPnl/baseCapital)*100:0,sinceLabel:"7d-live"},
    liveTradingReady:live&&!kill&&!riskHalt&&tradable>0
  };
}
async function list(s:ReturnType<typeof db>,table:string,order="created_at",limit=100){const {data,error}=await s.from(table).select("*").order(order,{ascending:false}).limit(limit);if(error)throw error;return data||[];}
async function livePortfolio(s:ReturnType<typeof db>){
  const c=await cockpit(s);
  const balances=await fetchTrackedWalletBalances(c.wallets,c.prices);
  const walletTotal=balances.reduce((sum,row)=>sum+Number(row.totalValueUsd||0),0);
  return {cockpit:c,balances,walletTotal,totalValueUsd:walletTotal+Number(c.account.totalAccountValueUsd||0)};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{status:200,headers:cors(req)});
  const path=route(req); let s:ReturnType<typeof db>;
  try{s=db();}catch(e){return json(req,{error:"backend_config_error",message:String(e)},500);}
  if(path==="health") return json(req,{status:"ok",mode:"real_edge_v7",databaseConfigured:true,adminHashAuth:true,mexcConfigured:mexcConfigured(),binanceConfigured:binanceConfigured(),liveTradingEnabled:Deno.env.get("ALLOW_LIVE_TRADING")==="true",timestamp:new Date().toISOString()});
  if(path==="trading/prices") return json(req,{data:await prices()});
  if(path==="exchange/health") return json(req,await exchangeHealth(s));
  const auth=await requireAdmin(req,path,s); if(auth) return auth;
  try{
    if(path==="config"&&req.method==="GET") return json(req,{data:await settings(s)});
    if(path==="config"&&req.method==="PUT"){const body=await req.json();const cfg=await settings(s);await s.from("settings").update({...body,updated_at:new Date().toISOString()}).eq("id",cfg.id).throwOnError();await audit(s,"settings_updated",{fields:Object.keys(body)});return json(req,{success:true});}
    if(path==="kill"&&req.method==="POST"){const body=await req.json();const cfg=await settings(s);await s.from("settings").update({kill_switch:Boolean(body.kill),updated_at:new Date().toISOString()}).eq("id",cfg.id).throwOnError();await audit(s,body.kill?"kill_switch_activated":"kill_switch_deactivated");return json(req,{kill_switch:Boolean(body.kill)});}
    if(path==="audit") return json(req,{data:await list(s,"audit_logs","created_at",200)});
    if(path==="wallets/list") return json(req,{data:await list(s,"managed_wallets")});
    if(path==="followed-wallets/list") return json(req,{data:await list(s,"followed_wallets","score",200)});
    if(path==="actions/list") return json(req,{data:await list(s,"actions")});
    if(path==="signals/list") return json(req,{data:await list(s,"signals")});
    if(path==="transactions/list") return json(req,{transactions:await list(s,"transactions","created_at",50),actions:await list(s,"actions")});
    if(path==="wallets"&&req.method==="POST"){const b=await req.json();const {data,error}=await s.from("managed_wallets").upsert(b,{onConflict:"chain,address"}).select("*").single();if(error)throw error;await audit(s,"wallet_synced",{id:data.id,chain:data.chain});return json(req,{data},201);}
    const wm=path.match(/^wallets\/([^/]+)$/); if(wm&&req.method==="PATCH"){const b=await req.json();await s.from("managed_wallets").update(b).eq("id",wm[1]).throwOnError();return json(req,{success:true});} if(wm&&req.method==="DELETE"){await s.from("managed_wallets").delete().eq("id",wm[1]).throwOnError();return json(req,{success:true});}
    if(path==="followed-wallets"&&req.method==="POST"){const b=await req.json();const {data,error}=await s.from("followed_wallets").upsert(b,{onConflict:"chain,address"}).select("*").single();if(error)throw error;return json(req,{data},201);}
    const fm=path.match(/^followed-wallets\/([^/]+)$/); if(fm&&req.method==="PATCH"){const b=await req.json();await s.from("followed_wallets").update(b).eq("id",fm[1]).throwOnError();return json(req,{success:true});} if(fm&&req.method==="DELETE"){await s.from("followed_wallets").delete().eq("id",fm[1]).throwOnError();return json(req,{success:true});}
    if(path==="portfolio/balances"){const p=await livePortfolio(s);return json(req,{balances:p.balances,totalValueUsd:p.totalValueUsd,pnlUsd:0,pnlPct:0,prices:{sol:p.cockpit.prices.find(x=>x.symbol==="SOLUSDT")?.lastPrice||0,eth:p.cockpit.prices.find(x=>x.symbol==="ETHUSDT")?.lastPrice||0}});}
    if(path==="portfolio/summary"){const p=await livePortfolio(s);return json(req,{data:{totalValueUsd:p.totalValueUsd,walletTotalUsd:p.walletTotal,exchangeTotalUsd:p.cockpit.account.totalAccountValueUsd,wallets:p.balances,mode:"REAL_BACKEND"}});}
    if(path==="portfolio/history") return json(req,{data:await list(s,"portfolio_snapshots","created_at",100)});
    if(path==="portfolio/cached") return json(req,{balances:await list(s,"wallet_balances","updated_at",200),totalValueUsd:0});
    if(path==="trading/cockpit") return json(req,await cockpit(s));
    if(path==="trading/account") return json(req,{data:(await cockpit(s)).account});
    if(path==="trading/recommendation") return json(req,{data:(await cockpit(s)).recommendation});
    if(path==="trading/pnl") return json(req,{data:(await cockpit(s)).pnl});
    if(path==="business-revenue"&&req.method==="GET"){
      const {data,error}=await s.from("business_revenue_ledger").select("id,occurred_at,source,gross_eur,fees_eur,net_eur,note,proof_ref,created_at").order("occurred_at",{ascending:false}).limit(100);
      if(error)throw error;
      return json(req,{data:data||[]});
    }
    if(path==="business-revenue"&&req.method==="POST"){
      const b=await req.json();
      const source=String(b.source||"OTHER").toUpperCase();
      if(!["SAAS","REFERRAL","AFFILIATE","SERVICES","OTHER"].includes(source))return json(req,{error:"invalid_source"},400);
      const gross=Math.max(0,Number(b.gross_eur||0));
      const fees=Math.max(0,Number(b.fees_eur||0));
      if(gross<=0)return json(req,{error:"gross_eur_must_be_positive"},400);
      const {data,error}=await s.from("business_revenue_ledger").insert({
        occurred_at:b.occurred_at||new Date().toISOString(),
        source,
        gross_eur:gross,
        fees_eur:Math.min(fees,gross),
        note:String(b.note||"").slice(0,500),
        proof_ref:String(b.proof_ref||"").slice(0,500)
      }).select("*").single();
      if(error)throw error;
      await audit(s,"business_revenue_recorded",{source,gross_eur:gross,fees_eur:Math.min(fees,gross)});
      return json(req,{data},201);
    }
    if(path==="earn/flexible/list") return json(req,{data:[],implemented:false,message:"Backend reel actif; aucun produit Earn verifie/connecte."});
    if(path==="autotrade/config"&&req.method==="GET") return json(req,{data:await list(s,"auto_trade_config","strategy_id",100)});
    if(path==="autotrade/config"&&req.method==="PUT"){const b=await req.json();const {data:row}=await s.from("auto_trade_config").select("id").eq("strategy_id",b.strategy_id).maybeSingle();if(row)await s.from("auto_trade_config").update({...b,updated_at:new Date().toISOString()}).eq("id",row.id).throwOnError();else await s.from("auto_trade_config").insert(b).throwOnError();await audit(s,"auto_trade_config_updated",{strategy_id:b.strategy_id});return json(req,{success:true});}
    if(path==="ai/config"&&req.method==="GET"){const {data}=await s.from("ai_config").select("*").limit(1).maybeSingle();return json(req,{data});}
    if(path==="ai/config"&&req.method==="PUT"){const b=await req.json();const {data:row}=await s.from("ai_config").select("id").limit(1).maybeSingle();if(row)await s.from("ai_config").update({...b,updated_at:new Date().toISOString()}).eq("id",row.id).throwOnError();else await s.from("ai_config").insert(b).throwOnError();await audit(s,"ai_config_updated");return json(req,{success:true});}
    if(path==="ai/analyze"&&req.method==="POST"){const c=await cockpit(s);await audit(s,"ai_analysis_run",{symbol:c.recommendation.symbol,action:c.recommendation.action});return json(req,{recommendation:c.recommendation});}
    if(path==="signals/run"&&req.method==="POST"){const cfg=await settings(s);return json(req,{signalsCreated:0,actionsCreated:0,reason:cfg.kill_switch?"kill_switch_active":"live_signal_engine_not_connected"});}
    if(path==="exchange/test"&&req.method==="POST"){
      const b=await req.json();
      const exchange=String(b.exchange||"MEXC").toUpperCase();
      if(exchange!=="BINANCE"&&exchange!=="MEXC") return json(req,{error:"unsupported_exchange"},400);
      const result=await testExchangeOrder(exchange as "BINANCE"|"MEXC",String(b.symbol||"BTC"),"BUY",Number(b.amountUsd||1));
      await audit(s,"exchange_test_order_ok",{exchange:result.exchange,symbol:result.symbol,amountUsd:result.amountUsd});
      await s.from("exchange_accounts").update({connection_status:"TEST_READY",last_checked_at:new Date().toISOString(),note:"Lecture + order/test vérifiés; aucune transaction réelle exécutée."}).eq("exchange",result.exchange);
      return json(req,{data:result});
    }
    if(path==="trading/validate"&&req.method==="POST"){const b=await req.json();const c=await cockpit(s);const amount=Number(b.amountUsd||0);const ok=c.validation.canSubmit&&amount>0&&amount<=c.validation.maxOrderUsd;return json(req,{data:{...c.validation,symbol:String(b.symbol||""),side:String(b.side||"BUY"),amountUsd:amount,passed:ok,canSubmit:ok}});}
    if(path==="trading/order"&&req.method==="POST"){
      const b=await req.json(); const mode=String(b.mode||"TEST").toUpperCase(); const c=await cockpit(s); const symbol=String(b.symbol||"").toUpperCase().replace(/USDT$/,"")+"USDT", side=String(b.side||"BUY").toUpperCase(), amount=Number(b.amountUsd||0);
      if(c.account.missingConfig) return json(req,{data:{mode,status:"REJECTED",message:"MEXC credentials missing"}},400);
      if(mode==="LIVE"&&c.settings.kill_switch) return json(req,{data:{mode,status:"REJECTED",message:"LIVE kill switch active"}},400);
      if(mode==="LIVE"&&c.validation.riskBlocked) return json(req,{data:{mode,status:"REJECTED",message:"Risk guard active",reasons:c.validation.riskBlockReasons}},400);
      if(amount<=0||amount>c.validation.maxOrderUsd) return json(req,{data:{mode,status:"REJECTED",message:"Amount outside dynamic server risk limit",maxOrderUsd:c.validation.maxOrderUsd}},400);
      if(side!=="BUY") return json(req,{data:{mode,status:"REJECTED",message:"Only BUY by quote amount is enabled"}},400);
      if(mode==="TEST"){const raw=await signed("POST","/api/v3/order/test",{symbol,side,type:"MARKET",quoteOrderQty:amount.toFixed(2)});await audit(s,"mexc_test_order_ok",{symbol,side,amountUsd:amount});return json(req,{data:{mode:"TEST",symbol,side,amountUsd:amount,status:"ACCEPTED",message:"MEXC test accepted; no asset bought or sold.",raw}});}
      if(mode==="LIVE"){const phrase=Deno.env.get("CONFIRMATION_PHRASE")||"JE COMPRENDS LE RISQUE ET JE VALIDE CETTE ACTION";if(Deno.env.get("ALLOW_LIVE_TRADING")!=="true"||b.confirmationPhrase!==phrase)return json(req,{data:{mode:"LIVE",status:"REJECTED",message:"Live blocked by server switch or confirmation phrase"}},403);const raw=await signed("POST","/api/v3/order",{symbol,side,type:"MARKET",quoteOrderQty:amount.toFixed(2)});await audit(s,"mexc_live_order_submitted",{symbol,side,amountUsd:amount});return json(req,{data:{mode:"LIVE",symbol,side,amountUsd:amount,status:"SUBMITTED",raw}});}
    }
    const am=path.match(/^actions\/([^/]+)\/(build|confirm|refuse)$/);if(am){const [,id,verb]=am;if(verb==="build"){const cfg=await settings(s);if(cfg.kill_switch)return json(req,{error:"Kill switch is active"},403);await s.from("actions").update({status:"BUILDING",updated_at:new Date().toISOString()}).eq("id",id).throwOnError();return json(req,{transaction:"",note:"Prepared action only; wallet signature required."});}if(verb==="confirm"){const b=await req.json();await s.from("actions").update({status:"CONFIRMED",updated_at:new Date().toISOString()}).eq("id",id).throwOnError();if(b.signature)await s.from("transactions").insert({action_id:id,signature:b.signature,explorer_url:"",status:"SUCCESS"}).throwOnError();return json(req,{success:true});}if(verb==="refuse"){await s.from("actions").update({status:"REFUSED",updated_at:new Date().toISOString()}).eq("id",id).throwOnError();return json(req,{success:true});}}
    return json(req,{data:null,unsupported:true,path});
  }catch(e){console.error("[ikb-api-v7]",path,e);return json(req,{error:"Internal server error",path},500);}
});