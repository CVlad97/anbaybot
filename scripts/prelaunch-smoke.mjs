const BASE=process.env.ANBAYBOT_BASE_URL || 'https://cvlad97.github.io/anbaybot/';
const ROOT=(process.env.ANBAYBOT_SUPABASE_URL || 'https://lmfwtiytqwedrazxjnwu.supabase.co')+'/functions/v1/';
const assert=(condition,message)=>{if(!condition)throw Error(message);};
async function main(){
  const app=await fetch(BASE,{signal:AbortSignal.timeout(12000)});
  assert(app.ok,'Site inaccessible');
  assert((await app.text()).includes('root'),'React mount missing');
  const health=await fetch(ROOT+'anbaybot-public?path=health',{signal:AbortSignal.timeout(12000)});
  assert(health.ok && (await health.json()).status==='ok','Health failed');
  const paths=['portfolio','exchanges','strategies','pnl','opportunities','readiness','goal','challenge','proof'];
  const denied=await Promise.all(paths.map(async path=>{
    const res=await fetch(ROOT+'anbaybot-public?path='+path,{signal:AbortSignal.timeout(12000)});
    assert(res.status===401,'Personal data publicly accessible: '+path);
    return path;
  }));
  const exchange=await fetch(ROOT+'ikb-api?path=exchange/health',{signal:AbortSignal.timeout(12000)});
  assert(exchange.status===401,'Private exchange health exposed');
  let ownerRead='NOT_TESTED_NO_TOKEN';
  if(process.env.ANBAYBOT_ADMIN_TOKEN){
    const res=await fetch(ROOT+'anbaybot-public?path=proof',{headers:{'X-Anbaybot-Admin-Token':process.env.ANBAYBOT_ADMIN_TOKEN},signal:AbortSignal.timeout(15000)});
    assert(res.ok,'Owner read failed');
    const data=await res.json();
    assert(Array.isArray(data.strategies),'Missing strategy proof coverage');
    assert(data.ledger.verification==='NOT_RECONCILED','Unexpected financial certification');
    ownerRead='PASS';
  }
  console.log(JSON.stringify({status:'PASS',scope:'reachability_and_privacy',protectedEndpoints:denied.length+1,ownerRead,profitability:'NOT_PROVEN'}));
}
main().catch(err=>{console.error('SMOKE_FAIL:',err.message);process.exit(1);});
