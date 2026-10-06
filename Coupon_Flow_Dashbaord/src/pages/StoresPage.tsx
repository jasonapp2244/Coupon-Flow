import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Star, Check, Trash2, Edit, Eye, CopyPlus, ExternalLink, Link2, X, Store as StoreIcon } from 'lucide-react';
import { Card, Button, statusBadge, Checkbox, PageHeader } from '../components/ui';
import { ConfirmModal, Drawer } from '../components/Modal';
import { Pagination, RowMenu, RowMenuItem, SearchInput, SortableTh, TableBodyState, filterSelectClass } from '../components/DataTable';
import { api, forEachId } from '../lib/api';
import { useAction, useApiList, useCategories, useDebounced, useListControls } from '../lib/hooks';
import { date, number, plural, storePublicUrl } from '../lib/format';
import { useCopyStoreLink } from '../components/StoreLink';
import { useCan } from '../store/AppContext';
import { RatingCell } from '../components/StoreRatings';
import type { Store } from '../lib/types';

function StoreDrawer({ store, onClose, onEdit }: { store: Store; onClose: () => void; onEdit: () => void }) {
  return (
    <Drawer open title={`Store: ${store.name}`} onClose={onClose} width="w-80">
      <div className="space-y-3 text-xs">
        {([
          ['Store Name', store.name],
          ['Slug', store.slug],
          ['Public link', <a href={storePublicUrl(store.slug)} target="_blank" rel="noreferrer" className="text-blue-600 break-all">{storePublicUrl(store.slug)}</a>],
          ['Category', store.category ?? '—'],
          ['Status', statusBadge(store.status)],
          ['Coupons', number(store.coupons_count ?? 0)],
          ['Visitor Rating', <RatingCell rating={store.rating} />],
          ['Direct URL', <a href={store.direct_url} target="_blank" rel="noreferrer" className="text-blue-600 break-all">{store.direct_url}</a>],
          ['Tracking URL', <span className="font-mono text-slate-600 break-all">{store.tracking_url ?? '—'}</span>],
          ['Top Store', store.is_top ? <Check size={13} className="text-emerald-500" /> : '—'],
          ['Editor Choice', store.is_editor_choice ? <Check size={13} className="text-emerald-500" /> : '—'],
          ['Last Updated', date(store.updated_at)],
        ] as [string, React.ReactNode][]).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50">
            <span className="text-slate-400 font-medium flex-shrink-0">{label}</span>
            <span className="text-slate-700 text-right">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <Button onClick={onEdit} className="w-full justify-center">Edit Store</Button>
      </div>
    </Drawer>
  );
}

export default function StoresPage() {
  const navigate = useNavigate();
  const canWrite = useCan('write');
  const copyLink = useCopyStoreLink();
  const categories = useCategories('store');
  const list = useListControls('name', 'asc');
  const { run, busy } = useAction();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [top, setTop] = useState('All');
  const [editor, setEditor] = useState('All');
  const [selected, setSelected] = useState<number[]>([]);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [viewStore, setViewStore] = useState<Store | null>(null);
  const [deleteStore, setDeleteStore] = useState<Store | null>(null);
  const [bulkAction, setBulkAction] = useState('');

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Store>('/admin/stores', {
    ...list.params,
    q,
    category_id: category,
    status,
    is_top: top === 'All' ? undefined : top === 'Yes',
    is_editor_choice: editor === 'All' ? undefined : editor === 'Yes',
  });

  const filterChanged = <T,>(set: (v: T) => void) => (v: T) => { set(v); list.setPage(1); setSelected([]); };
  const hasFilters = search || category !== 'All' || status !== 'All' || top !== 'All' || editor !== 'All';
  const clearFilters = () => { setSearch(''); setCategory('All'); setStatus('All'); setTop('All'); setEditor('All'); list.setPage(1); };

  const allSelected = items.length > 0 && items.every(s => selected.includes(s.id));
  const toggleAll = () => setSelected(allSelected ? [] : items.map(s => s.id));
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
      Activate: [each(id => api.patch(`/admin/stores/${id}/status`, { status: 'Active' })), `${ids.length} store(s) activated`],
      Deactivate: [each(id => api.patch(`/admin/stores/${id}/status`, { status: 'Inactive' })), `${ids.length} store(s) deactivated`],
      Delete: [each(id => api.delete(`/admin/stores/${id}`)), `${ids.length} store(s) moved to trash`],
    };
    const [fn, message] = actions[bulkAction];
    await act(fn, message);
    setSelected([]);
    setBulkAction('');
  };

  const handleDelete = async () => {
    if (!deleteStore) return;
    const store = deleteStore;
    setDeleteStore(null);
    await act(() => api.delete(`/admin/stores/${store.id}`), `"${store.name}" moved to trash`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="All Stores"
        subtitle={meta ? plural(meta.total, 'store') : 'Loading…'}
        actions={canWrite ? <Button size="sm" onClick={() => navigate('/stores/new')}><Plus size={13} /> Add Store</Button> : undefined}
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={filterChanged(setSearch)} placeholder="Search stores..." />
          <select value={category} onChange={e => filterChanged(setCategory)(e.target.value)} className={filterSelectClass} aria-label="Category">
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={e => filterChanged(setStatus)(e.target.value)} className={filterSelectClass} aria-label="Status">
            {['All', 'Active', 'Inactive', 'Draft'].map(s => <option key={s} value={s}>{s === 'All' ? 'Status: All' : s}</option>)}
          </select>
          <select value={top} onChange={e => filterChanged(setTop)(e.target.value)} className={filterSelectClass} aria-label="Top store">
            {['All', 'Yes', 'No'].map(o => <option key={o} value={o}>{o === 'All' ? 'Top Store' : `Top: ${o}`}</option>)}
          </select>
          <select value={editor} onChange={e => filterChanged(setEditor)(e.target.value)} className={filterSelectClass} aria-label="Editor choice">
            {['All', 'Yes', 'No'].map(o => <option key={o} value={o}>{o === 'All' ? 'Editor Choice' : `Editor: ${o}`}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">
              <X size={12} /> Clear
            </button>
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
                <SortableTh label="Store" field="name" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Category</th>
                <SortableTh label="Coupons" field="coupons_count" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <SortableTh label="Rating" field="ratings_avg_rating" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Tracking URL</th>
                <th className="px-4 py-3 text-left">Top</th>
                <th className="px-4 py-3 text-left">Editor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <SortableTh label="Updated" field="updated_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={11} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<StoreIcon size={22} />} emptyTitle="No stores found" onRetry={reload}
                onClear={hasFilters ? clearFilters : undefined}
              />
              {!error && items.map(store => (
                <tr key={store.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected.includes(store.id) ? 'bg-blue-50/40' : ''}`}>
                  {canWrite && <td className="px-4 py-3.5"><Checkbox checked={selected.includes(store.id)} onChange={() => toggleSelect(store.id)} /></td>}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {store.logo_url
                        ? <img src={store.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{store.name.slice(0, 2).toUpperCase()}</div>}
                      <div>
                        <div className="font-medium text-slate-800">{store.name}</div>
                        <button type="button" onClick={() => copyLink(store.slug)} title={`Copy ${storePublicUrl(store.slug)}`}
                          className="text-xs text-slate-400 hover:text-blue-600">/promotions/at/{store.slug}</button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs">{store.category ?? '—'}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{number(store.coupons_count ?? 0)}</td>
                  <td className="px-4 py-3.5"><RatingCell rating={store.rating} /></td>
                  <td className="px-4 py-3.5"><span className="text-xs text-slate-500 font-mono truncate max-w-28 block">{store.tracking_url ?? '—'}</span></td>
                  <td className="px-4 py-3.5">{store.is_top ? <Star size={14} className="text-amber-400 fill-amber-400" /> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3.5">{store.is_editor_choice ? <Check size={14} className="text-emerald-500" /> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3.5">{statusBadge(store.status)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{date(store.updated_at)}</td>
                  <td className="px-4 py-3.5">
                    <RowMenu open={openMenu === store.id} onToggle={() => setOpenMenu(openMenu === store.id ? null : store.id)}>
                      <RowMenuItem icon={<Eye size={13} />} onClick={() => { setViewStore(store); setOpenMenu(null); }}>View</RowMenuItem>
                      {canWrite && <RowMenuItem icon={<Edit size={13} />} onClick={() => navigate(`/stores/${store.id}/edit`)}>Edit</RowMenuItem>}
                      <RowMenuItem icon={<Link2 size={13} />} onClick={() => { copyLink(store.slug); setOpenMenu(null); }}>Copy link</RowMenuItem>
                      {store.status === 'Active' && (
                        <RowMenuItem icon={<ExternalLink size={13} />} onClick={() => { window.open(storePublicUrl(store.slug), '_blank', 'noopener'); setOpenMenu(null); }}>View on site</RowMenuItem>
                      )}
                      {canWrite && <>
                      <RowMenuItem icon={<CopyPlus size={13} />} onClick={() => act(() => api.post(`/admin/stores/${store.id}/duplicate`), `"${store.name}" duplicated`)}>Duplicate</RowMenuItem>
                      <RowMenuItem onClick={() => act(
                        () => api.patch(`/admin/stores/${store.id}/status`, { status: store.status === 'Active' ? 'Inactive' : 'Active' }),
                        `Store ${store.status === 'Active' ? 'deactivated' : 'activated'}`,
                      )}>{store.status === 'Active' ? 'Deactivate' : 'Activate'}</RowMenuItem>
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <RowMenuItem danger icon={<Trash2 size={13} />} onClick={() => { setDeleteStore(store); setOpenMenu(null); }}>Delete</RowMenuItem>
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

      {viewStore && <StoreDrawer store={viewStore} onClose={() => setViewStore(null)} onEdit={() => navigate(`/stores/${viewStore.id}/edit`)} />}

      <ConfirmModal
        open={!!deleteStore}
        onClose={() => setDeleteStore(null)}
        onConfirm={handleDelete}
        title="Delete Store?"
        message={`Are you sure you want to delete "${deleteStore?.name}"? The store will be moved to Trash.`}
        confirmLabel="Delete Store"
      />
    </div>
  );
}
