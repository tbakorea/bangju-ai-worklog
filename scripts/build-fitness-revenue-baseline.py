"""Build an aggregate-only baseline from previously reconciled DaGym exports.
No member/order/product identifiers are emitted. Run from the repository root.
"""
import json, hashlib, datetime
from pathlib import Path
history_path=Path('work/dagym-revenue-2024-2026/monthly-public-pt.json')
sales_path=Path('work/public-diagnostic-2026/sales-2026.json')
history=json.loads(history_path.read_text()); sales=json.loads(sales_path.read_text())
rows=[]
for r in history['rows']:
    month=f"{r['year']}-{r['month']:02}"
    if not '2024-07'<=month<='2026-10': continue
    assert r['status']=='complete' and r['reconciled'] and r['public']+r['pt']==r['total']
    rows.append(dict(month=month,total=r['total'],public=r['public'],pt=r['pt'],refund=r['refund']))
refreshed_path=Path('work/revenue-feedback-20261126/refreshed.json')
refreshed=json.loads(refreshed_path.read_text())
for fresh in refreshed['rows'][:28]:
    month=fresh['startDate'][:7]
    assert fresh['reconciled'] and fresh['public']+fresh['pt']==fresh['total']
    old=next(r for r in rows if r['month']==month)
    old.update({k:fresh[k] for k in ['total','public','pt','refund']})
assert len(rows)==28 and len({r['month'] for r in rows})==28
assert len(sales['rows'])==sales['count']==len({r['id'] for r in sales['rows']})
daily={}; tz=datetime.timezone(datetime.timedelta(hours=9))
for r in sales['rows']:
    date=datetime.datetime.fromisoformat(r['incomeAt'].replace('Z','+00:00')).astimezone(tz).date().isoformat()
    if date[:7]!='2026-10': continue
    assert isinstance(r['income'],int)
    b=daily.setdefault(date,dict(total=0,public=0,pt=0))
    # Use the same product-name classification as the reconciled monthly source.
    import re
    group='pt' if re.search(r'PT|피티|퍼스널|개인레슨',r['saleName'],re.I) else 'public'
    b['total']+=r['income'];b[group]+=r['income']
last=rows[-1]
for key in ['total','public','pt']: assert sum(d[key] for d in daily.values())==last[key],key
# Complete October source means absence of transactions on a date is measured zero.
for day in range(1,32):daily.setdefault(f'2026-10-{day:02}',dict(total=0,public=0,pt=0))
result={'metric':'다짐 매출 · 환불 차감 후 결제액','timezone':'Asia/Seoul','historyCapturedAt':refreshed['capturedAt'],'dailyCapturedAt':sales['capturedAt'],'source':'다짐 매출 화면 및 결제 내역','sourceHashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [history_path,sales_path,refreshed_path]},'periodsCapturedAt':refreshed['capturedAt'],'periods':[{k:r[k] for k in ['startDate','endDate','total','public','pt','refund','reconciled']} for r in refreshed['rows'][28:]],'months':rows,'daily':dict(sorted(daily.items()))}
Path('api/_lib/fitness-revenue-baseline.cjs').write_text('// Aggregate-only reconciled source; regenerate with scripts/build-fitness-revenue-baseline.py.\nmodule.exports = '+json.dumps(result,ensure_ascii=False,indent=2)+';\n')
print('Validated 28 months; October daily totals and PT/public split reconcile exactly.')
