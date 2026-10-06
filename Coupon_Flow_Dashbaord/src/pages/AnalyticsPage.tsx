import { useState } from 'react';
import { Download, RotateCcw, RefreshCw } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, Button, PageHeader } from '../components/ui';
import { FormLoadState } from '../components/FormParts';
import { StateBadge, UsageBar } from '../components/CouponUsage';
import { api, withQuery } from '../lib/api';
import { StorePicker } from '../components/StorePicker';
import { useApi } from '../lib/hooks';
import { date, money, number, tooltipMoney, tooltipNumber } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { AnalyticsData } from '../lib/types';

const RANGES = [{ label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }, { label: '3 Months', days: 90 }, { label: '12 Months', days: 365 }];
const METRICS = { Revenue: { key: 'revenue', color: '#10B981' }, Orders: { key: 'orders', color: '#2563EB' } } as const;
type Metric = keyof typeof METRICS;
type View = 'uses' | 'sales';

const selectClass = 'px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-600 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all';
const tooltipStyle = { background: '#0F172A', border: 'none', borderRadius: 8, color: '#F1F5F9', fontSize: 12 };
const shortDate = (d: string) => date(d).replace(/, \d{4}$/, '');

function Kpis({ items, range }: { items: { label: string; value: string }[]; range: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(k => (
        <Card key={k.label}>
          <div className="text-xl font-bold text-slate-900 truncate">{k.value}</div>
          <div className="text-xs text-slate-500 mt-1">{k.label} · {range}</div>
        </Card>
      ))}
    </div>
  );
}

function UsesView({ data, range }: { data: AnalyticsData; range: string }) {
  const total = data.uses.reduce((t, p) => t + p.uses, 0);
  const best = data.uses.reduce<(typeof data.uses)[number] | null>((b, p) => (!b || p.uses > b.uses ? p : b), null);
  const rows = data.uses.map(p => ({ date: shortDate(p.date), uses: p.uses }));

  return (
    <>
      <Kpis range={range} items={[
        { label: 'Coupon Uses', value: number(total) },
        { label: 'Average a Day', value: data.uses.length ? number(Math.round((total / data.uses.length) * 10) / 10) : '—' },
        { label: 'Busiest Day', value: best && best.uses > 0 ? `${date(best.date)} · ${number(best.uses)}` : '—' },
        { label: 'Coupons Used', value: number(data.top_coupons.length) + (data.top_coupons.length >= 10 ? '+' : '') },
      ]} />

      <Card padding={false}>
        <div className="p-5 pb-0">
          <h2 className="text-sm font-semibold text-slate-800">Uses per Day: {range}</h2>
          <p className="text-xs text-slate-400 mt-0.5">A use is a "Show coupon code" or "Get deal" click on the website.</p>
        </div>
        <div className="px-2 pb-4 pt-3 relative">
          {total === 0 && <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 z-10">No uses in this period</p>}
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rows} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="usesAnalyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipNumber} />
              <Area type="monotone" dataKey="uses" name="Uses" stroke="#2563EB" strokeWidth={2} fill="url(#usesAnalyticsGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padding={false}>
        <div className="p-5 pb-3 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-800">Most-Used Coupons</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100">
                {['Coupon', 'Store', 'State', 'Uses in period', 'Share', 'Limit used'].map(h => <th key={h} className="px-5 py-3 text-left whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.top_coupons.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-400">No uses in this period</td></tr>}
              {data.top_coupons.map(c => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800 max-w-64 truncate">{c.title}</td>
                  <td className="px-5 py-3 text-slate-600">{c.store ?? '—'}</td>
                  <td className="px-5 py-3"><StateBadge state={c.state} /></td>
                  <td className="px-5 py-3 font-semibold text-slate-800">{number(c.uses_in_period ?? 0)}</td>
                  <td className="px-5 py-3 text-blue-600 font-medium">{total ? `${(((c.uses_in_period ?? 0) / total) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="px-5 py-3"><UsageBar uses={c.uses_count} limit={c.usage_limit} percent={c.used_percent} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function SalesView({ data, range }: { data: AnalyticsData; range: string }) {
  const [metric, setMetric] = useState<Metric>('Revenue');
  const sales = data.sales;
  const totals = sales.reduce((t, p) => ({ orders: t.orders + p.orders, revenue: t.revenue + p.revenue_cents }), { orders: 0, revenue: 0 });
  const best = sales.reduce<(typeof sales)[number] | null>((b, p) => (!b || p.revenue_cents > b.revenue_cents ? p : b), null);
  const rows = sales.map(p => ({ date: shortDate(p.date), orders: p.orders, revenue: p.revenue_cents / 100 }));
  const topStores = data.top_stores;
  const { key, color } = METRICS[metric];

  return (
    <>
      <Kpis range={range} items={[
        { label: 'Paid Orders', value: number(totals.orders) },
        { label: 'Revenue', value: money(totals.revenue) },
        { label: 'Average Order', value: totals.orders ? money(Math.round(totals.revenue / totals.orders)) : '—' },
        { label: 'Best Day', value: best && best.revenue_cents > 0 ? `${date(best.date)} · ${money(best.revenue_cents)}` : '—' },
      ]} />

      <Card padding={false}>
        <div className="p-5 pb-0 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Exclusive Code Sales: {range}</h2>
          <div className="flex gap-1">
            {(Object.keys(METRICS) as Metric[]).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                style={metric === m ? { backgroundColor: METRICS[m].color + '18', color: METRICS[m].color, borderColor: METRICS[m].color } : {}}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${metric === m ? '' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="px-2 pb-4 pt-3 relative">
          {totals.orders === 0 && <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 z-10">No paid orders in this period</p>}
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rows} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={metric === 'Revenue'} />
              <Tooltip contentStyle={tooltipStyle} formatter={metric === 'Revenue' ? tooltipMoney : tooltipNumber} />
              <Area type="monotone" dataKey={key} name={metric} stroke={color} strokeWidth={2} fill="url(#analyticsGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card padding={false}>
          <div className="p-5 pb-3 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-800">Top Stores</h2></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100">
                {['Store', 'Orders', 'Revenue', 'Share'].map(h => <th key={h} className="px-5 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {topStores.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-xs text-slate-400">No sales in this period</td></tr>}
              {topStores.map(s => (
                <tr key={s.store_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{s.store}</td>
                  <td className="px-5 py-3 text-slate-600">{number(s.orders)}</td>
                  <td className="px-5 py-3 font-semibold text-slate-800">{money(s.revenue_cents)}</td>
                  <td className="px-5 py-3 text-emerald-600 font-medium">{totals.revenue ? `${((s.revenue_cents / totals.revenue) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card padding={false}>
          <div className="p-5 pb-3 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-800">Revenue by Store</h2></div>
          <div className="px-2 py-4">
            {topStores.length === 0 ? <p className="h-[220px] flex items-center justify-center text-xs text-slate-400">No sales in this period</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topStores.map(s => ({ store: s.store, revenue: s.revenue_cents / 100 }))} margin={{ top: 0, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="store" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={tooltipMoney} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  const { showToast } = useApp();
  const [view, setView] = useState<View>('uses');
  const [days, setDays] = useState(30);
  const [storeId, setStoreId] = useState('All');
  const [exporting, setExporting] = useState(false);

  const params = { days, store_id: storeId };
  const { data, loading, error, reload } = useApi<AnalyticsData>(withQuery('/admin/analytics', params));

  const isFiltered = days !== 30 || storeId !== 'All';
  const range = RANGES.find(r => r.days === days)!.label;

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.download(withQuery('/admin/analytics/export', params), `analytics-${days}d.csv`);
      showToast('success', 'Report downloaded');
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Coupon uses and, when exclusive codes are sold, card sales"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isFiltered && (
              <button onClick={() => { setDays(30); setStoreId('All'); }} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors font-medium">
                <RotateCcw size={12} /> Reset Filters
              </button>
            )}
            <select value={days} onChange={e => setDays(Number(e.target.value))} className={selectClass} aria-label="Date range">
              {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
            <StorePicker compact allLabel="All stores" value={storeId === 'All' ? '' : storeId} onChange={id => setStoreId(id || 'All')} />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <><RefreshCw size={13} className="animate-spin" /> Preparing…</> : <><Download size={13} /> Export CSV</>}
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit" role="tablist" aria-label="Report">
        {([['uses', 'Coupon uses'], ['sales', 'Sales']] as [View, string][]).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      {!data ? <FormLoadState loading={loading} error={error} onRetry={reload} /> : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {view === 'uses' ? <UsesView data={data} range={range} /> : <SalesView data={data} range={range} />}
        </div>
      )}
    </div>
  );
}
