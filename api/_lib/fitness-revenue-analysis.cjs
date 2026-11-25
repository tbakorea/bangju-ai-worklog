'use strict';
const {normalizeComposition}=require('../../scripts/dagym-sales-composition.cjs');
const baseline=require('./fitness-revenue-baseline.cjs');
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const prior=s=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);};
const prevMonth=s=>{const d=new Date(s.slice(0,7)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);};
const lastDay=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?(a-b)/b*100:null;
const money=x=>new Intl.NumberFormat('ko-KR').format(x)+'원';
function validSnapshot(r){const s=r?.domains?.sales;return dateOK(r?.snapshot_date)&&['partial','complete'].includes(r.quality)&&s?.ok===true&&s.authenticated===true&&s.rangeVerified===true&&s.period==='month-to-date'&&Number.isFinite(r.metrics?.sales)&&r.metrics.sales>=0;}
function analyze({date,rows=[],data=baseline}){
 if(!dateOK(date))throw Error('date');
 const target=prior(date), month=target.slice(0,7), previous=prevMonth(target);
 const usable=rows.filter(r=>validSnapshot(r)&&r.snapshot_date<=target).sort((a,b)=>b.snapshot_date.localeCompare(a.snapshot_date));
 const current=usable.find(r=>r.snapshot_date.slice(0,7)===month);
 const history=data.months.filter(r=>r.month<month).map(r=>({...r}));
 // Only an actual calendar month-end snapshot can extend closed-month history.
 for(const r of usable){const m=r.snapshot_date.slice(0,7);if(m>=month||+r.snapshot_date.slice(8)!==lastDay(m)||history.some(x=>x.month===m))continue;const c=normalizeComposition(r.metrics.salesComposition,r.snapshot_date,r.metrics.sales);history.push({month:m,total:r.metrics.sales,public:c?.public??null,pt:c?.pt??null,refund:c?.refund??null});}
 history.sort((a,b)=>a.month.localeCompare(b.month));
 const result={date,targetDate:target,sourceDate:current?.snapshot_date||null,status:!current?'missing':current.snapshot_date===target?'ready':'stale',metric:data.metric,historyCapturedAt:data.historyCapturedAt,history,signals:[],current:null,previous:history.find(r=>r.month===previous)||null,comparison:null,composition:null,limits:[]};
 const signal=(key,title,detail)=>result.signals.push({key,title,detail});
 if(!current){result.limits.push('해당 월 매출 자료 미확인: 실적을 0이나 부진으로 판단하지 않습니다.');return result;}
 const day=+current.snapshot_date.slice(8), previousDay=Math.min(day,lastDay(previous)), cutoff=`${previous}-${String(previousDay).padStart(2,'0')}`;
 let comparable=null;
 const exact=usable.find(r=>r.snapshot_date===cutoff);
 if(exact){comparable={total:exact.metrics.sales,source:'daily-snapshot',startDate:previous+'-01',endDate:cutoff};const c=normalizeComposition(exact.metrics.salesComposition,cutoff,exact.metrics.sales);if(c)Object.assign(comparable,{public:c.public,pt:c.pt});}
 else if(Array.from({length:previousDay},(_,i)=>`${previous}-${String(i+1).padStart(2,'0')}`).every(d=>data.daily[d])){
  comparable={total:0,public:0,pt:0,source:'reconciled-transactions',startDate:previous+'-01',endDate:cutoff};
  for(let n=1;n<=previousDay;n++){const b=data.daily[`${previous}-${String(n).padStart(2,'0')}`];for(const k of ['total','public','pt'])comparable[k]+=b[k];}
 }
 const matchedPeriod=data.periods?.find(r=>r.startDate===previous+'-01'&&r.endDate===cutoff&&r.reconciled&&r.public+r.pt===r.total);
 if(comparable&&matchedPeriod?.total===comparable.total)Object.assign(comparable,{public:matchedPeriod.public,pt:matchedPeriod.pt});
 result.current={total:current.metrics.sales,startDate:month+'-01',endDate:current.snapshot_date,days:day};
 if(result.status==='stale')result.limits.push(`수집 지연: ${current.snapshot_date} 자료이며 ${target} 자료는 아직 확인되지 않았습니다.`);
 if(comparable){result.comparison={...comparable,change:current.metrics.sales-comparable.total,changePct:pct(current.metrics.sales,comparable.total)};
  if(result.comparison.changePct!==null&&result.comparison.changePct<=-15)signal('pace','전월 같은 기간보다 매출 감소',`${month} 1~${day}일 ${money(current.metrics.sales)}, ${previous} 1~${previousDay}일 ${money(comparable.total)} 대비 ${Math.abs(result.comparison.changePct).toFixed(1)}% 감소했습니다.`);
 }else result.limits.push('전월 같은 날짜까지의 매출 미확인: 전월 전체와 증감률을 계산하지 않습니다.');
 // Composition is valid only at the exact same cutoff and reconciled to the live total.
 const liveComposition=normalizeComposition(current.metrics.salesComposition,current.snapshot_date,current.metrics.sales);
 const composition=liveComposition?{...liveComposition,reconciled:true}:data.periods?.find(r=>r.startDate===month+'-01'&&r.endDate===current.snapshot_date);
 if(composition&&composition.reconciled&&composition.total===current.metrics.sales&&composition.public+composition.pt===composition.total){
  result.composition={public:composition.public,pt:composition.pt,refund:composition.refund,capturedAt:liveComposition?.capturedAt||data.periodsCapturedAt};
  if(comparable&&Number.isFinite(comparable.public)&&Number.isFinite(comparable.pt)){
   result.composition.changes={public:composition.public-comparable.public,pt:composition.pt-comparable.pt};
   for(const k of ['public','pt']){const change=pct(composition[k],comparable[k]);if(change!==null&&change<=-15)signal(k,k==='pt'?'PT 매출 흐름 확인':'일반·부대매출 흐름 확인',`전월 같은 기간 대비 ${Math.abs(change).toFixed(1)}% 감소했습니다. 상담·방문·재등록 흐름에서 원인을 확인하세요.`);}
  }
 }else result.limits.push('당월 상품별 구성은 동일 기준일에 대조된 자료가 없어 원인 분석을 보류합니다.');
 const last=result.previous;
 if(last&&last.total>0&&Number.isFinite(last.pt)&&last.pt/last.total>=.65)signal('concentration','전월 PT 매출 집중',`${previous} 매출 중 PT 비중 ${(last.pt/last.total*100).toFixed(1)}%. 일반·부대매출과 함께 확인할 필요가 있습니다.`);
 const year=+month.slice(0,4), completed=+month.slice(5)-1;
 const a=history.filter(r=>r.month.startsWith(String(year))&&+r.month.slice(5)<=completed),b=history.filter(r=>r.month.startsWith(String(year-1))&&+r.month.slice(5)<=completed);
 if(completed&&a.length===completed&&b.length===completed&&[...a,...b].every(r=>Number.isFinite(r.public))){const sum=(rs,k)=>rs.reduce((n,r)=>n+r[k],0);result.yearComparison={year,throughMonth:completed,totalPct:pct(sum(a,'total'),sum(b,'total')),publicPct:pct(sum(a,'public'),sum(b,'public')),ptPct:pct(sum(a,'pt'),sum(b,'pt'))};
 if(result.yearComparison.publicPct<=-15)signal('public-trend','일반·부대매출의 장기 약화',`${year}년 1~${completed}월 일반·부대매출이 전년 같은 기간보다 ${Math.abs(result.yearComparison.publicPct).toFixed(1)}% 낮습니다. 문의 유입과 기존 회원의 재등록 이유를 함께 확인하세요.`);}
 const recent=usable.filter(r=>r.snapshot_date.slice(0,7)===month&&r.snapshot_date>=month+'-'+String(Math.max(1,day-6)).padStart(2,'0'));
 if(recent.length<Math.min(day,7))result.limits.push('최근 7일 중 일부 일별 자료가 없어 일간 증감의 연속성은 확인이 필요합니다. 월 누계는 날짜별로 합산하지 않습니다.');
 result.limits.push('관측된 매출 차이는 원인 확정이 아닙니다. 상담·방문·등록 전환 자료로 확인합니다.');
 return result;
}
module.exports={analyze,validSnapshot,dateOK};
