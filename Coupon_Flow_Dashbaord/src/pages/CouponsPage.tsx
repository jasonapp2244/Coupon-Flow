import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Star, CheckCircle, Zap, Eye, Edit, Copy, Trash2, X, RotateCcw } from 'lucide-react';
import { Badge, Card, Button, statusBadge, Checkbox, PageHeader } from '../components/ui';
import { StateBadge, UsageBar } from '../components/CouponUsage';
import { ConfirmModal, Drawer } from '../components/Modal';
import { Pagination, RowMenu, RowMenuItem, SearchInput, SortableTh, TableBodyState, filterSelectClass } from '../components/DataTable';
import { api, forEachId } from '../lib/api';
import { StorePicker } from '../components/StorePicker';
import { useAction, useApi, useApiList, useDebounced, useListControls } from '../lib/hooks';
import { dateTimeFull, money, number, plural, timeUntil } from '../lib/format';
import { useCan } from '../store/AppContext';
import type { Coupon, FeedSource } from '../lib/types';

const STATES: [string, string][] = [
  ['All', 'State: All'], ['live', 'Live'], ['scheduled', 'Scheduled'], ['ended', 'Ended'], ['used_up', 'Used up'], ['draft', 'Draft'], ['inactive', 'Inactive'],
];

/** "Ends Oct 25, 2026, 11:59 PM · in 5 hr", or when it starts for a scheduled coupon. */
function DealWindow({ coupon }: { coupon: Coupon }) {
  if (coupon.state === 'scheduled' && coupon.starts_at) {
    return <span className="text-blue-700">Starts {dateTimeFull(coupon.starts_at)}<span className="block text-slate-400">{timeUntil(coupon.starts_at)}</span></span>;
  }
  if (!coupon.expires_at) return <span className="text-slate-400">No end date</span>;
  const soon = timeUntil(coupon.expires_at);
  const within48h = soon !== '' && new Date(coupon.expires_at).getTime() - Date.now() < 48 * 3600 * 1000;
  return (
    <span>
      {coupon.state === 'ended' ? 'Ended' : 'Ends'} {dateTimeFull(coupon.expires_at)}
      {soon && <span className={`block ${within48h ? 'font-medium text-amber-700' : 'text-slate-400'}`}>{soon}</span>}
    </span>
  );
}

const typeColor: Record<string, string> = {
  'Coupon Code': 'bg-blue-50 text-blue-700',
  'Deal': 'bg-amber-50 text-amber-700',
  'No Code Required': 'bg-emerald-50 text-emerald-700',
};

function priceLabel(c: Coupon) {
  return c.price_cents > 0 ? money(c.price_cents, c.currency) : 'Free';
}

function CouponDrawer({ coupon, onClose, onEdit }: { coupon: Coupon; onClose: () => void; onEdit?: () => void }) {
  return (
    <Drawer open title="Coupon Details" onClose={onClose} width="w-80">
      <div className="space-y-3 text-xs">
        {([
          ['Offer', coupon.title],
          ['Store', coupon.store ?? '—'],
          ['Type', coupon.type],
          ['Code', coupon.unique_codes ? 'Unique code per buyer' : coupon.code ? <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{coupon.code}</code> : '—'],
          ['Price', priceLabel(coupon)],
          ['Stock', coupon.stock === null ? 'Unlimited' : coupon.unique_codes ? `${number(coupon.stock)} unsold codes` : number(coupon.stock)],
          ['State', <StateBadge state={coupon.state} />],
          ['Status', statusBadge(coupon.status)],
          ['Starts', coupon.starts_at ? dateTimeFull(coupon.starts_at) : 'Straight away'],
          ['Ends', coupon.expires_at ? dateTimeFull(coupon.expires_at) : 'No end date'],
          ['Uses', <UsageBar uses={coupon.uses_count} limit={coupon.usage_limit} percent={coupon.used_percent} />],
          ['Source', coupon.feed_source ? `${coupon.feed_source}${coupon.external_id ? ` (${coupon.external_id})` : ''}` : 'Added by hand'],
          ['Featured', coupon.is_featured ? '✓ Yes' : 'No'],
          ['Verified', coupon.is_verified ? '✓ Yes' : 'No'],
          ['Exclusive', coupon.is_exclusive ? '✓ Yes' : 'No'],
        ] as [string, React.ReactNode][]).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50">
            <span className="text-slate-400 font-medium flex-shrink-0">{label}</span>
            <span className="text-slate-700 text-right">{value}</span>
          </div>
        ))}
      </div>
      {coupon.description && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 font-medium mb-1">Description</p>
          <p className="text-xs text-slate-700 whitespace-pre-line">{coupon.description}</p>
        </div>
      )}
      {onEdit && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Button onClick={onEdit} className="w-full justify-center">Edit Coupon</Button>
        </div>
      )}
    </Drawer>
  );
}

export default function CouponsPage({ expiredOnly = false }: { expiredOnly?: boolean }) {
  const navigate = useNavigate();
  const canWrite = useCan('write');
  const [params] = useSearchParams();
  const list = useListControls(expiredOnly ? 'expires_at' : 'updated_at', 'desc');
  const { run, busy } = useAction();
  const sources = useApi<{ data: FeedSource[] }>('/admin/feed-sources').data?.data ?? [];

  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState('All');
  const [type, setType] = useState('All');
  const [state, setState] = useState(params.get('state') ?? 'All');
  const [usage, setUsage] = useState(params.get('near') === '1' ? 'near' : 'All');
  const [source, setSource] = useState(params.get('feed_source_id') ?? 'All');
  const [featured, setFeatured] = useState('All');
  const [pricing, setPricing] = useState('All');
  const [selected, setSelected] = useState<number[]>([]);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [viewCoupon, setViewCoupon] = useState<Coupon | null>(null);
  const [deleteCoupon, setDeleteCoupon] = useState<Coupon | null>(null);
  const [bulkAction, setBulkAction] = useState('');

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Coupon>('/admin/coupons', {
    ...list.params,
    q,
    store_id: storeId,
    type,
    state,
    near_limit: usage === 'near' || undefined,
    feed_source_id: source,
    expired: expiredOnly || undefined,
    is_featured: featured === 'All' ? undefined : featured === 'Yes',
    is_paid: pricing === 'All' ? undefined : pricing === 'Paid',
  });

  const filterChanged = <T,>(set: (v: T) => void) => (v: T) => { set(v); list.setPage(1); setSelected([]); };
  const hasFilters = search || storeId !== 'All' || type !== 'All' || state !== 'All' || usage !== 'All' || source !== 'All' || featured !== 'All' || pricing !== 'All';
  const clearFilters = () => { setSearch(''); setStoreId('All'); setType('All'); setState('All'); setUsage('All'); setSource('All'); setFeatured('All'); setPricing('All'); list.setPage(1); };

  const allSelected = items.length > 0 && items.every(c => selected.includes(c.id));
  const toggleAll = () => setSelected(allSelected ? [] : items.map(c => c.id));
  const toggleSelect = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const act = async (action: () => Promise<unknown>, message: string) => {
    setOpenMenu(null);
    if (await run(action, message)) reload();
  };

  const handleBulkAction = async () => {
    const ids = [...selected];
    if (!bulkAction || !ids.length) return;
    const each = (fn: (id: number) => Promise<unknown>) => () => forEachId(ids, fn);
    const actions: Record<string, [() => Promise<unknown>, string]> = {
      Activate: [each(id => api.patch(`/admin/coupons/${id}/status`, { status: 'Active' })), `${ids.length} coupon(s) activated`],
      Deactivate: [each(id => api.patch(`/admin/coupons/${id}/status`, { status: 'Inactive' })), `${ids.length} coupon(s) deactivated`],
      Delete: [each(id => api.delete(`/admin/coupons/${id}`)), `${ids.length} coupon(s) moved to trash`],
    };
    const [fn, message] = actions[bulkAction];
    await act(fn, message);
    setSelected([]);
    setBulkAction('');
  };

  const handleDelete = async () => {
    if (!deleteCoupon) return;
    const coupon = deleteCoupon;
    setDeleteCoupon(null);
    await act(() => api.delete(`/admin/coupons/${coupon.id}`), `"${coupon.title}" moved to trash`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={expiredOnly ? 'Ended Coupons' : 'All Coupons'}
        subtitle={meta ? `${plural(meta.total, 'coupon')}${expiredOnly ? ' whose deal window is over' : ''}` : 'Loading…'}
        actions={!expiredOnly && canWrite ? <Button size="sm" onClick={() => navigate('/coupons/new')}><Plus size={13} /> Create Coupon</Button> : undefined}
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={filterChanged(setSearch)} placeholder="Search offers or codes..." />
          <StorePicker compact allLabel="All stores" value={storeId === 'All' ? '' : storeId} onChange={id => filterChanged(setStoreId)(id || 'All')} />
          <select value={type} onChange={e => filterChanged(setType)(e.target.value)} className={filterSelectClass} aria-label="Type">
            {['All', 'Coupon Code', 'Deal', 'No Code Required'].map(t => <option key={t} value={t}>{t === 'All' ? 'Type: All' : t}</option>)}
          </select>
          {!expiredOnly && (
            <select value={state} onChange={e => filterChanged(setState)(e.target.value)} className={filterSelectClass} aria-label="State">
              {STATES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          )}
          <select value={usage} onChange={e => filterChanged(setUsage)(e.target.value)} className={filterSelectClass} aria-label="Usage">
            <option value="All">Usage: All</option><option value="near">80% or more used</option>
          </select>
          {sources.length > 0 && (
            <select value={source} onChange={e => filterChanged(setSource)(e.target.value)} className={filterSelectClass} aria-label="Brand feed">
              <option value="All">Source: All</option>
              {sources.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select value={pricing} onChange={e => filterChanged(setPricing)(e.target.value)} className={filterSelectClass} aria-label="Pricing">
            {['All', 'Paid', 'Free'].map(p => <option key={p} value={p}>{p === 'All' ? 'Price: All' : p}</option>)}
          </select>
          <select value={featured} onChange={e => filterChanged(setFeatured)(e.target.value)} className={filterSelectClass} aria-label="Featured">
            <option value="All">Featured: All</option><option value="Yes">Featured: Yes</option><option value="No">Featured: No</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100"><X size={12} /> Clear</button>
          )}
        </div>

        {canWrite && selected.length > 0 && (
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <span className="text-xs font-medium text-blue-700">{selected.length} selected</span>
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
              <option value="">Bulk action…</option>
              {['Activate', 'Deactivate', 'Delete'].map(a => <option key={a}>{a}</option>)}
            </select>
            <Button size="sm" variant="secondary" onClick={handleBulkAction} disabled={!bulkAction || busy}>{busy ? 'Applying…' : 'Apply'}</Button>
            <button onClick={() => setSelected([])} aria-label="Clear selection" className="ml-auto text-xs text-slate-400 hover:text-slate-600"><X size={12} /></button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className={`w-full text-sm transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {canWrite && <th className="px-4 py-3 text-left w-8"><Checkbox checked={allSelected} onChange={toggleAll} /></th>}
                <SortableTh label="Offer" field="title" sort={list.sort} dir={list.dir} onSort={list.onSort} className="px-3 py-3" />
                <th className="px-3 py-3 text-left">Store</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Code</th>
                <SortableTh label="Price" field="price_cents" sort={list.sort} dir={list.dir} onSort={list.onSort} className="px-3 py-3" />
                <SortableTh label="Usage" field="used_percent" sort={list.sort} dir={list.dir} onSort={list.onSort} className="px-3 py-3" />
                <SortableTh label="Deal window" field="expires_at" sort={list.sort} dir={list.dir} onSort={list.onSort} className="px-3 py-3" />
                <th className="px-3 py-3 text-left">State</th>
                <th className="px-3 py-3 text-left" title="Featured / Verified / Exclusive">Flags</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={canWrite ? 11 : 10} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<Star size={22} />} emptyTitle="No coupons found" onRetry={reload}
                onClear={hasFilters ? clearFilters : undefined}
              />
              {!error && items.map(coupon => (
                <tr key={coupon.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected.includes(coupon.id) ? 'bg-blue-50/40' : ''}`}>
                  {canWrite && <td className="px-4 py-3.5"><Checkbox checked={selected.includes(coupon.id)} onChange={() => toggleSelect(coupon.id)} /></td>}
                  <td className="px-3 py-3.5 max-w-52">
                    <p className="font-medium text-slate-800 truncate">{coupon.title}</p>
                    {coupon.feed_source && <p className="text-[11px] text-slate-400 truncate">from {coupon.feed_source}</p>}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center text-white text-[8px] font-bold">{(coupon.store ?? '?').slice(0, 2)}</div>
                      <span className="text-slate-600 text-xs">{coupon.store ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5"><span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${typeColor[coupon.type] ?? 'bg-slate-100 text-slate-600'}`}>{coupon.type}</span></td>
                  <td className="px-3 py-3.5">{coupon.code ? <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-mono font-medium">{coupon.code}</code> : <span className="text-slate-300 text-xs">—</span>}</td>
                  <td className="px-3 py-3.5 text-xs font-medium whitespace-nowrap">{coupon.price_cents > 0 ? <span className="text-slate-800">{priceLabel(coupon)}</span> : <span className="text-slate-400">Free</span>}</td>
                  <td className="px-3 py-3.5"><UsageBar uses={coupon.uses_count} limit={coupon.usage_limit} percent={coupon.used_percent} compact /></td>
                  <td className="px-3 py-3.5 text-xs text-slate-500 whitespace-nowrap"><DealWindow coupon={coupon} /></td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-col items-start gap-1">
                      <StateBadge state={coupon.state} />
                      {coupon.feed_source && coupon.status === 'Draft' && <Badge variant="warning">Imported · review</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Star size={13} className={coupon.is_featured ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} aria-label={coupon.is_featured ? 'Featured' : 'Not featured'} />
                      <CheckCircle size={13} className={coupon.is_verified ? 'text-emerald-500' : 'text-slate-200'} aria-label={coupon.is_verified ? 'Verified' : 'Not verified'} />
                      <Zap size={13} className={coupon.is_exclusive ? 'text-violet-500' : 'text-slate-200'} aria-label={coupon.is_exclusive ? 'Exclusive' : 'Not exclusive'} />
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <RowMenu open={openMenu === coupon.id} onToggle={() => setOpenMenu(openMenu === coupon.id ? null : coupon.id)} width="w-36">
                      <RowMenuItem icon={<Eye size={13} />} onClick={() => { setViewCoupon(coupon); setOpenMenu(null); }}>View</RowMenuItem>
                      {canWrite && <>
                      <RowMenuItem icon={<Edit size={13} />} onClick={() => navigate(`/coupons/${coupon.id}/edit`)}>Edit</RowMenuItem>
                      <RowMenuItem icon={<Copy size={13} />} onClick={() => act(() => api.post(`/admin/coupons/${coupon.id}/duplicate`), 'Coupon duplicated as draft')}>Duplicate</RowMenuItem>
                      <RowMenuItem onClick={() => act(
                        () => api.patch(`/admin/coupons/${coupon.id}/status`, { status: coupon.status === 'Active' ? 'Inactive' : 'Active' }),
                        `Coupon ${coupon.status === 'Active' ? 'disabled' : 'enabled'}`,
                      )}>{coupon.status === 'Active' ? 'Disable' : 'Enable'}</RowMenuItem>
                      {coupon.uses_count > 0 && (
                        <RowMenuItem icon={<RotateCcw size={13} />} onClick={() => act(() => api.post(`/admin/coupons/${coupon.id}/reset-uses`), 'Uses reset to 0')}>Reset uses</RowMenuItem>
                      )}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <RowMenuItem danger icon={<Trash2 size={13} />} onClick={() => { setDeleteCoupon(coupon); setOpenMenu(null); }}>Delete</RowMenuItem>
                      </div>
                      </>}
                    </RowMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {viewCoupon && <CouponDrawer coupon={viewCoupon} onClose={() => setViewCoupon(null)} onEdit={canWrite ? () => navigate(`/coupons/${viewCoupon.id}/edit`) : undefined} />}

      <ConfirmModal
        open={!!deleteCoupon}
        onClose={() => setDeleteCoupon(null)}
        onConfirm={handleDelete}
        title="Delete Coupon?"
        message={`Are you sure you want to delete "${deleteCoupon?.title}"? It will be moved to Trash.`}
        confirmLabel="Delete Coupon"
      />
    </div>
  );
}
