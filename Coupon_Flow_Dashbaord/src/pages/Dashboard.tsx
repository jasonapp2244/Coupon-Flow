import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Bell, CalendarClock, CalendarPlus, Gauge, History, MousePointerClick, Plug, ShieldAlert, Tag } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge, Button, Card, SectionTitle, statusBadge } from '../components/ui';
import { FormLoadState } from '../components/FormParts';
import { StateBadge, UsageBar } from '../components/CouponUsage';
import { useApi } from '../lib/hooks';
import { date, dateTime, dateTimeFull, money, number, timeAgo, timeUntil, tooltipMoney, tooltipNumber } from '../lib/format';
import { useApp, useCan } from '../store/AppContext';
import type { AnalyticsData, CouponUsage, DashboardData, SalesPoint } from '../lib/types';

const RANGES = [{ label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }, { label: '3 Months', days: 90 }];
const SALES_METRICS = { Orders: { key: 'orders', color: '#2563EB' }, Revenue: { key: 'revenue', color: '#10B981' } } as const;
type SalesMetric = keyof typeof SALES_METRICS;

const tooltipStyle = { background: '#0F172A', border: 'none', borderRadius: 8, color: '#F1F5F9', fontSize: 12 };
const shortDate = (d: string) => date(d).replace(/, \d{4}$/, '');

function Kpi({ label, value, hint, icon, color, onClick, alert = false }: {
  label: string; value: string; hint?: string; icon: ReactNode; color: string; onClick: () => void; alert?: boolean;
}) {
  return (
    <Card className={`min-w-0 cursor-pointer hover:shadow-md transition-shadow ${alert ? 'border-amber-300 hover:border-amber-400' : 'hover:border-blue-200'}`} onClick={onClick}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-900 leading-none truncate">{value}</div>
      <div className="text-xs text-slate-500 mt-1 font-medium">{label}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{hint}</div>}
    </Card>
  );
}

function RangeButtons({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
      {RANGES.map(r => (
        <button key={r.days} onClick={() => onChange(r.days)} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${days === r.days ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>{r.label}</button>
      ))}
    </div>
  );
}

/** Coupon uses (clicks on "Show coupon code" / "Get deal") per day. */
function UsesChart() {
  const [days, setDays] = useState(30);
  const { data, loading } = useApi<AnalyticsData>(`/admin/analytics?days=${days}`);
  const rows = (data?.uses ?? []).map(p => ({ date: shortDate(p.date), uses: p.uses }));
  const total = rows.reduce((sum, r) => sum + r.uses, 0);

  return (
    <Card className="xl:col-span-2" padding={false}>
      <div className="p-5 pb-0 flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Coupon Uses</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${number(total)} uses in this period.` : 'Loading…'} A use is a "Show coupon code" or "Get deal" click.
          </p>
        </div>
        <RangeButtons days={days} onChange={setDays} />
      </div>
      <div className={`px-2 pb-4 relative transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {data && total === 0 && !loading && <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 z-10">No uses in this period yet</p>}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows} margin={{ top: 0, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="usesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={tooltipNumber} />
            <Area type="monotone" dataKey="uses" name="Uses" stroke="#2563EB" strokeWidth={2} fill="url(#usesGrad)" dot={false} activeDot={{ r: 4, fill: '#2563EB' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SalesChart() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<SalesMetric>('Revenue');
  const { data, loading } = useApi<AnalyticsData>(`/admin/analytics?days=${days}`);
  const { key, color } = SALES_METRICS[metric];
  const rows = (data?.sales ?? []).map((p: SalesPoint) => ({ date: shortDate(p.date), orders: p.orders, revenue: p.revenue_cents / 100 }));
  const empty = rows.every(r => r.orders === 0);

  return (
    <Card className="xl:col-span-2" padding={false}>
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Exclusive Code Sales</h2>
            <p className="text-xs text-slate-400 mt-0.5">Paid orders over the selected period</p>
          </div>
          <RangeButtons days={days} onChange={setDays} />
        </div>
        <div className="flex gap-1 mb-4">
          {(Object.keys(SALES_METRICS) as SalesMetric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${metric === m ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>{m}</button>
          ))}
        </div>
      </div>
      <div className={`px-2 pb-4 relative transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {empty && !loading && <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 z-10">No paid orders in this period yet</p>}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows} margin={{ top: 0, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={metric === 'Revenue'} />
            <Tooltip contentStyle={tooltipStyle} formatter={metric === 'Revenue' ? tooltipMoney : tooltipNumber} />
            <Area type="monotone" dataKey={key} name={metric} stroke={color} strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** A short list of coupons with their usage, deal times and a link to edit. */
function CouponList({ title, hint, coupons, empty, show, onOpen }: {
  title: string; hint: string; coupons: CouponUsage[]; empty: string; show: 'usage' | 'ends' | 'starts'; onOpen: (id: number) => void;
}) {
  return (
    <Card padding={false}>
      <div className="p-5 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
      </div>
      {coupons.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-slate-50">
          {coupons.map(c => (
            <li key={c.id}>
              <button onClick={() => onOpen(c.id)} className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800 truncate">{c.title}</span>
                  <span className="block text-xs text-slate-400 truncate">{c.store ?? '—'}</span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  {show === 'usage' && <UsageBar uses={c.uses_count} limit={c.usage_limit} percent={c.used_percent} compact />}
                  {show === 'ends' && <><span className="block font-medium text-amber-700">{timeUntil(c.expires_at)}</span><span className="text-slate-400">{dateTimeFull(c.expires_at)}</span></>}
                  {show === 'starts' && <><span className="block font-medium text-blue-700">{timeUntil(c.starts_at)}</span><span className="text-slate-400">{dateTimeFull(c.starts_at)}</span></>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { notifications } = useApp();
  const canWrite = useCan('write');
  const { data, loading, error, reload } = useApi<DashboardData>('/admin/dashboard');
  const openCoupon = (id: number) => navigate(canWrite ? `/coupons/${id}/edit` : '/coupons');

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <FormLoadState loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  const { usage, kpis } = data;
  const feedsOk = usage.feeds_total - usage.feeds_failing;
  const cards = [
    { label: 'Live Coupons', value: number(usage.live), hint: `${number(usage.scheduled)} scheduled · ${number(usage.used_up)} used up`, icon: <Tag size={18} />, color: 'bg-emerald-100 text-emerald-600', path: '/coupons?state=live' },
    { label: 'Uses Today', value: number(usage.uses_today), hint: 'Code and deal clicks', icon: <MousePointerClick size={18} />, color: 'bg-blue-100 text-blue-600', path: '/redemptions' },
    { label: 'Uses, Last 7 Days', value: number(usage.uses_7d), hint: `${number(usage.uses_30d)} in 30 days`, icon: <History size={18} />, color: 'bg-sky-100 text-sky-600', path: '/analytics' },
    { label: 'Nearly Used Up', value: number(usage.near_limit), hint: '80% or more of their limit', icon: <Gauge size={18} />, color: 'bg-amber-100 text-amber-600', path: '/coupons?near=1', alert: usage.near_limit > 0 },
    { label: 'Ending in 48 Hours', value: number(usage.ending_48h), hint: `${number(usage.ended)} ended so far`, icon: <CalendarClock size={18} />, color: 'bg-rose-100 text-rose-600', path: '/coupons?state=live' },
    { label: 'Brand Feeds OK', value: usage.feeds_total ? `${feedsOk} / ${usage.feeds_total}` : '—', hint: usage.feeds_failing ? `${usage.feeds_failing} need attention` : 'All imports fine', icon: <Plug size={18} />, color: 'bg-violet-100 text-violet-600', path: '/feeds', alert: usage.feeds_failing > 0 },
  ];
  const topStores = data.top_stores.map(s => ({ name: s.store, revenue: s.revenue_cents / 100 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Coupon use, what needs attention, and brand feed health at a glance.</p>
      </div>

      {data.two_factor_missing && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <ShieldAlert size={18} className="text-amber-600 shrink-0" />
          <p className="flex-1 min-w-52 text-sm text-amber-800">Your account has no two-step login. Turn it on so a stolen password alone can't open the admin.</p>
          <Button size="sm" variant="outline" onClick={() => navigate('/settings/account')}>Set it up</Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map(c => <Kpi key={c.label} {...c} onClick={() => navigate(c.path)} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <UsesChart />
        <Card padding={false}>
          <div className="p-5 pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Most-Used Coupons</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 30 days, with how much of each limit is gone</p>
          </div>
          {data.top_coupons.length === 0 ? <p className="px-5 py-10 text-center text-xs text-slate-400">No uses yet.</p> : (
            <ul className="divide-y divide-slate-50">
              {data.top_coupons.map(c => (
                <li key={c.id}>
                  <button onClick={() => openCoupon(c.id)} className="w-full text-left px-5 py-2.5 hover:bg-slate-50 flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800 truncate">{c.title}</span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="truncate">{c.store ?? '—'}</span><StateBadge state={c.state} /></span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold text-slate-800">{number(c.uses_in_period ?? 0)}</span>
                      {c.usage_limit !== null && <span className="text-[11px] text-slate-400">{c.used_percent}% of limit</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CouponList title="Nearly Used Up" hint="80% or more of the usage limit taken" coupons={data.watch.near_limit} show="usage"
          empty="No coupon is close to its limit." onOpen={openCoupon} />
        <CouponList title="Ending Soon" hint="Deal window closes in the next 48 hours" coupons={data.watch.ending_soon} show="ends"
          empty="Nothing ends in the next 48 hours." onOpen={openCoupon} />
        <CouponList title="Starting Soon" hint="Scheduled to go live in the next 48 hours" coupons={data.watch.starting_soon} show="starts"
          empty="Nothing scheduled in the next 48 hours." onOpen={openCoupon} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card padding={false} className="xl:col-span-2">
          <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <SectionTitle>Brand Feeds</SectionTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/feeds')}>Manage</Button>
          </div>
          {data.feeds.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-400">No brand feeds yet. Add one under Brand Feeds to import a brand's coupons.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400 font-medium border-b border-slate-100">{['Brand / company', 'Last run', 'Status', 'Problems (7 days)'].map(h => <th key={h} className="px-5 py-2.5 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {data.feeds.map(f => (
                  <tr key={f.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{f.name}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{f.last_run_at ? timeAgo(f.last_run_at) : 'Never'}</td>
                    <td className="px-5 py-3">{f.last_status ? statusBadge(f.last_status) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-xs">{f.problem_runs_7d > 0
                      ? <span className="inline-flex items-center gap-1 text-amber-700 font-medium"><AlertTriangle size={12} /> {f.problem_runs_7d}</span>
                      : <span className="text-slate-400">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Recent Activity</SectionTitle>
            {data.recent_activity && <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>Activity log</Button>}
          </div>
          <div className="space-y-3">
            {data.recent_activity
              ? (data.recent_activity.length === 0 ? <p className="text-xs text-slate-400">Nothing logged yet.</p> : data.recent_activity.map(a => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-100 text-slate-500"><History size={13} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-snug"><span className="font-medium">{a.user_name}</span> {a.action.replace(/_/g, ' ')}{a.subject_label ? `: ${a.subject_label}` : ''}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              )))
              : (notifications.length === 0 ? <p className="text-xs text-slate-400">No activity yet.</p> : notifications.slice(0, 6).map(n => (
                <div key={n.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-50 text-blue-600"><Bell size={13} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 font-medium leading-snug">{n.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              )))}
          </div>
        </Card>
      </div>

      {data.shop_enabled && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <SalesChart />
            <Card padding={false}>
              <div className="p-5 pb-0">
                <h2 className="text-base font-semibold text-slate-800">Top Stores by Sales</h2>
                <p className="text-xs text-slate-400 mt-0.5">{money(kpis.revenue_cents)} from {number(kpis.paid_orders)} paid orders in total</p>
              </div>
              <div className="px-2 py-4">
                {topStores.length === 0 ? <p className="h-[220px] flex items-center justify-center text-xs text-slate-400">No sales yet</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topStores} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip contentStyle={tooltipStyle} formatter={tooltipMoney} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card padding={false}>
            <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <SectionTitle>Recent Orders</SectionTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>View all</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-400 font-medium border-b border-slate-100">{['Order', 'Customer', 'Total', 'Status', 'Date'].map(h => <th key={h} className="px-5 py-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {data.recent_orders.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">No orders yet.</td></tr>}
                  {data.recent_orders.map(o => (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer last:border-0" onClick={() => navigate('/orders')}>
                      <td className="px-5 py-3"><code className="text-xs font-mono text-blue-600">#{o.id}</code></td>
                      <td className="px-5 py-3 text-slate-700 text-xs">{o.email}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{money(o.total_cents, o.currency)}</td>
                      <td className="px-5 py-3"><Badge variant={o.status === 'paid' ? 'success' : o.status === 'pending' ? 'warning' : 'neutral'}>{o.status}</Badge></td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{dateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <CalendarPlus size={12} /> Coupons with a start time go live and come down on their own; nothing needs to be switched by hand.
      </div>
    </div>
  );
}
