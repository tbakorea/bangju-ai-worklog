// Keep only aggregate amounts; product names and authenticated headers never enter audits.
function normalizeComposition(value, dateKey, sales) {
  if (!value || value.startDate !== dateKey.slice(0,7)+'-01' || value.endDate !== dateKey
      || !['total','public','pt','refund'].every(k=>Number.isSafeInteger(value[k]))
      || value.total !== sales || value.public+value.pt !== sales || value.refund<0
      || !Number.isFinite(Date.parse(value.capturedAt))) return null;
  return Object.fromEntries(['startDate','endDate','total','public','pt','refund','capturedAt'].map(k=>[k,value[k]]));
}
function projectProducts(items, summary, dateKey, sales) {
  if (!Array.isArray(items)||!Number.isSafeInteger(summary?.totalCount)||items.some(x=>typeof x.name!=='string'||!Number.isSafeInteger(x.price)||!Number.isSafeInteger(x.count))) return null;
  if(items.reduce((n,x)=>n+x.count,0)!==summary.totalCount)return null;
  const value={startDate:dateKey.slice(0,7)+'-01',endDate:dateKey,total:summary.paidPrice,refund:summary.refundPrice,public:0,pt:0,capturedAt:new Date().toISOString()};
  for(const x of items)value[/PT|피티|퍼스널|개인레슨/i.test(x.name.normalize('NFKC'))?'pt':'public']+=x.price;
  return normalizeComposition(value,dateKey,sales);
}
async function captureSalesComposition(context, requests, dateKey, sales) {
 const filter=requests.get('GetSaleFilters'),summary=requests.get('GetSalesSummary');
 if(!filter||!summary)return null;
 const origin='https://www.dagym-manager.com';
 const variables={startDate:dateKey.slice(0,7)+'-01T00:00:00+09:00',endDate:dateKey+'T23:59:59+09:00'};
 async function read(request,vars){
  if(new URL(request.url()).origin!==origin)throw Error('source');
  const payload=request.postDataJSON();
  const headers=Object.fromEntries(Object.entries(await request.allHeaders()).filter(([k])=>/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k)&&!['cookie','host','content-length'].includes(k.toLowerCase())));
  const r=await context.request.post(request.url(),{headers,data:{...payload,variables:vars},timeout:15000,maxRedirects:0});
  if(!r.ok())throw Error('source');const body=await r.json();if(body.errors?.length)throw Error('source');return body.data;
 }
 const products=await read(filter,variables), totals=await read(summary,{filter:variables});
 return projectProducts(products?.saleFilters?.saleNames,totals?.saleSummary,dateKey,sales);
}
module.exports={normalizeComposition,projectProducts,captureSalesComposition};
