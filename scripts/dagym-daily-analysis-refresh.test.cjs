const test=require('node:test'),assert=require('node:assert/strict');
test('trusted upload refreshes next-day analysis; analysis-only repair never uploads raw data; failures do not fabricate success',async()=>{
 const oldFetch=global.fetch,env={SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY,DAGYM_BROWSER_SYNC_SECRET:process.env.DAGYM_BROWSER_SYNC_SECRET};
 process.env.SUPABASE_SERVICE_ROLE_KEY='eyJfixture.x.y';process.env.DAGYM_BROWSER_SYNC_SECRET='fixture';delete require.cache[require.resolve('../api/dagym-browser-daily')];const handler=require('../api/dagym-browser-daily');
 let calls=[],failRpc=false,stored=true;
 global.fetch=async(url,options={})=>{url=String(url);calls.push({url,...options});let value=[];
  if(url.includes('dagym_daily_snapshots?')&&(!options.method||options.method==='GET'))value=stored?[{quality:'partial',field_count:2}]:[];
  if(url.includes('/rpc/')){if(failRpc)return{ok:false,status:503,text:async()=>''};value={ok:true};}
  return{ok:true,status:200,text:async()=>JSON.stringify(value)};
 };
 const request=async body=>{const res={setHeader(){},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await handler({method:'POST',headers:{'x-dagym-sync-secret':'fixture'},body},res);return res;};
 try{
  const domains=Object.fromEntries([['attendance','/dashboard/attendance','daily'],['sales','/sales/list','month-to-date'],['members','/member/list','point-in-time']].map(([key,source,period])=>[key,{ok:true,authenticated:true,rangeVerified:true,source,period,capturedAt:'2026-11-02T18:00:00Z'}]));
  const result=await request({dateKey:'2026-11-02',metrics:{visits:0,sales:0},domains});assert.equal(result.code,200);assert.equal(result.body.analysisUpdated,true);assert.equal(result.body.fieldCount,2);assert.equal(result.body.domains.schedule.ok,false);
  const snapshot=calls.find(c=>c.url.includes('on_conflict=center_key,snapshot_date'));assert.equal(Object.hasOwn(JSON.parse(snapshot.body).metrics,'ptBookings'),false);
  assert.equal(JSON.parse(calls.find(c=>c.url.includes('/rpc/')).body).target_date,'2026-11-03');
  calls=[];assert.equal((await request({action:'refresh-analysis',dateKey:'2026-11-01'})).body.analysisUpdated,true);assert.ok(calls.every(c=>!c.method||c.url.includes('/rpc/')));
  stored=false;assert.equal((await request({action:'refresh-analysis',dateKey:'2026-11-01'})).code,409);
  failRpc=true;stored=true;const partial=await request({dateKey:'2026-11-02',metrics:{visits:0,sales:0},domains});assert.equal(partial.code,200);assert.equal(partial.body.analysisDeferred,true);
 }finally{global.fetch=oldFetch;for(const[k,v]of Object.entries(env))if(v===undefined)delete process.env[k];else process.env[k]=v;delete require.cache[require.resolve('../api/dagym-browser-daily')];}
});
