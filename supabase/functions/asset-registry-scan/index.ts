import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

function serviceKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy) return legacy;
  try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"";}catch{return "";}
}
function db(){
  const url=Deno.env.get("SUPABASE_URL")||"", key=serviceKey();
  if(!url||!key) throw new Error("supabase_server_credentials_missing");
  return createClient(url,key);
}
async function rpc(url:string,method:string,params:unknown[]){
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  if(!r.ok) throw new Error("rpc_"+r.status);
  const d=await r.json(); if(d.error) throw new Error("rpc_error"); return d.result;
}
const CHAIN_RPC:Record<string,string>={
  ethereum:"https://ethereum-rpc.publicnode.com",
  base:"https://base-rpc.publicnode.com",
  polygon:"https://polygon-bor-rpc.publicnode.com",
  bsc:"https://bsc-rpc.publicnode.com"
};
const SYMBOL:Record<string,string>={ethereum:"ETH",base:"ETH",polygon:"POL",bsc:"BNB",solana:"SOL",bitcoin:"BTC",tron:"TRX"};

async function balance(chain:string,address:string){
  if(CHAIN_RPC[chain]){
    const hex=await rpc(CHAIN_RPC[chain],"eth_getBalance",[address,"latest"]);
    return Number(BigInt(String(hex)))/1e18;
  }
  if(chain==="solana"){
    const r=await rpc("https://api.mainnet-beta.solana.com","getBalance",[address,{commitment:"confirmed"}]);
    return Number(r?.value||0)/1e9;
  }
  if(chain==="bitcoin"){
    const r=await fetch("https://mempool.space/api/address/"+encodeURIComponent(address));
    if(!r.ok) throw new Error("btc_"+r.status);
    const d=await r.json(), c=d.chain_stats||{}, m=d.mempool_stats||{};
    return (Number(c.funded_txo_sum||0)-Number(c.spent_txo_sum||0)+Number(m.funded_txo_sum||0)-Number(m.spent_txo_sum||0))/1e8;
  }
  if(chain==="tron"){
    try {
      const r=await fetch("https://api.trongrid.io/v1/accounts/"+encodeURIComponent(address),{signal:AbortSignal.timeout(6500)});
      if(r.ok){
        const d=await r.json();
        if(Array.isArray(d?.data) && d.data.length) return Number(d.data[0].balance||0)/1e6;
      }
    }catch{}
    const fallback=await fetch("https://apilist.tronscanapi.com/api/account?address="+encodeURIComponent(address),{signal:AbortSignal.timeout(7500)});
    if(!fallback.ok) throw new Error("tron_fallback_"+fallback.status);
    const d=await fallback.json();
    const native=d?.balance ?? d?.tokenBalances?.find((x:{tokenId?:string})=>x.tokenId==="_")?.balance;
    if(native===undefined || !Number.isFinite(Number(native))) throw new Error("tron_native_balance_unavailable");
    return Number(native)/1e6;
  }
  throw new Error("unsupported_chain");
}

Deno.serve(async(req: Request)=>{
  if (req.method !== "POST") return new Response(JSON.stringify({error:"method_not_allowed"}), {status:405,headers:{"content-type":"application/json"}});

  try{
    const s=db();
    const token=req.headers.get("X-Anbaybot-Scan-Token") || "";
    if (!token || token.length > 512) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"content-type":"application/json"}});
    const {data:allowed,error:authError}=await s.rpc("authorize_revenue_scan",{p_token:token});
    if (authError || allowed !== true) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:{"content-type":"application/json"}});
    const {data,error}=await s.from("asset_wallet_registry").select("id,chain,address,native_balance");
    if(error) throw error;
    let updated=0, failed=0;
    const results=[];
    for(const row of data||[]){
      try{
        const value=await balance(String(row.chain),String(row.address));
        await s.from("asset_wallet_registry").update({
          native_balance:value,
          native_symbol:SYMBOL[String(row.chain)]||null,
          last_checked_at:new Date().toISOString(),
          updated_at:new Date().toISOString()
        }).eq("id",row.id);
        updated++;
        results.push({id:row.id,chain:row.chain,status:"OK"});
      }catch(e){
        failed++;
        results.push({id:row.id,chain:row.chain,status:"ERROR",reason:e instanceof Error?e.message:"scan_failed"});
      }
      await new Promise(r=>setTimeout(r,120));
    }
    return new Response(JSON.stringify({status:"ok",updated,failed,results,checkedAt:new Date().toISOString()}),{headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch(e){
    return new Response(JSON.stringify({status:"error",message:e instanceof Error?e.message:"scan_failed"}),{status:500,headers:{"content-type":"application/json"}});
  }
});