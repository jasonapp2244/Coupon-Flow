import { useState } from 'react';
import { Download, RotateCcw, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, Button, PageHeader } from '../components/ui';
import { FormLoadState } from '../components/FormParts';
import { StateBadge, UsageBar } from '../components/CouponUsage';
import { api, withQuery } from '../lib/api';
import { StorePicker } from '../components/StorePicker';
import { useApi } from '../lib/hooks';
import { date, money, number, tooltipNumber } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { AnalyticsData, StoreProfit } from '../lib/types';

const RANGES = [{ label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }, { label: '3 Months', days: 90 }, { label: '12 Months', days: 365 }];

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

      <ProfitByStore rows={data.profit_by_store ?? []} range={range} />
    </>
  );
}

/** Confirmed sales and the profit they earned, per store, best first. */
function ProfitByStore({ rows, range }: { rows: StoreProfit[]; range: string }) {
  const sorted = [...rows].sort((a, b) => b.profit_cents - a.profit_cents);
  const totals = rows.reduce((t, r) => ({ sales: t.sales + r.sales, order: t.order + r.order_value_cents, profit: t.profit + r.profit_cents }), { sales: 0, order: 0, profit: 0 });

  return (
    <Card padding={false}>
      <div className="p-5 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Profit by Store: {range}</h2>
        <p className="text-xs text-slate-400 mt-0.5">Sales confirmed on the Redemptions page, and the commission they earned.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 font-medium border-b border-slate-100">
              {['Store', 'Sales', 'Order value', 'Profit'].map(h => <th key={h} className="px-5 py-3 text-left whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-xs text-slate-400">No confirmed sales in this period</td></tr>}
            {sorted.map(r => (
              <tr key={r.store_id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{r.store}</td>
                <td className="px-5 py-3 text-slate-700">{number(r.sales)}</td>
                <td className="px-5 py-3 text-slate-700">{money(r.order_value_cents)}</td>
                <td className="px-5 py-3 font-semibold text-emerald-600">{money(r.profit_cents)}</td>
              </tr>
            ))}
          </tbody>
          {sorted.length > 1 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60 text-xs font-semibold text-slate-700">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3">{number(totals.sales)}</td>
                <td className="px-5 py-3">{money(totals.order)}</td>
                <td className="px-5 py-3 text-emerald-700">{money(totals.profit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { showToast } = useApp();
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
        subtitle="Coupon uses per day, the most-used coupons and profit by store"
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

      {!data ? <FormLoadState loading={loading} error={error} onRetry={reload} /> : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <UsesView data={data} range={range} />
        </div>
      )}
    </div>
  );
}
