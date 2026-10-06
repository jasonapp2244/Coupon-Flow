import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Plus, Star, Edit, Copy, Trash2, X } from 'lucide-react';
import { Card, Button, statusBadge, Checkbox, PageHeader } from '../components/ui';
import { ConfirmModal } from '../components/Modal';
import { Pagination, RowMenu, RowMenuItem, SearchInput, SortableTh, TableBodyState, filterSelectClass } from '../components/DataTable';
import { api, forEachId } from '../lib/api';
import { useAction, useApiList, useCategories, useDebounced, useListControls } from '../lib/hooks';
import { date, plural } from '../lib/format';
import { useCan } from '../store/AppContext';
import type { Blog } from '../lib/types';

export default function BlogsPage() {
  const navigate = useNavigate();
  const canWrite = useCan('write');
  const categories = useCategories('blog');
  const list = useListControls('updated_at', 'desc');
  const { run, busy } = useAction();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('All');
  const [status, setStatus] = useState('All');
  const [featured, setFeatured] = useState('All');
  const [selected, setSelected] = useState<number[]>([]);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [deleteBlog, setDeleteBlog] = useState<Blog | null>(null);

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Blog>('/admin/blogs', {
    ...list.params,
    q,
    category_id: categoryId,
    status,
    is_featured: featured === 'All' ? undefined : featured === 'Yes',
  });

  const filterChanged = <T,>(set: (v: T) => void) => (v: T) => { set(v); list.setPage(1); setSelected([]); };
  const hasFilters = search || categoryId !== 'All' || status !== 'All' || featured !== 'All';
  const clearFilters = () => { setSearch(''); setCategoryId('All'); setStatus('All'); setFeatured('All'); list.setPage(1); };

  const allSelected = items.length > 0 && items.every(b => selected.includes(b.id));
  const toggleAll = () => setSelected(allSelected ? [] : items.map(b => b.id));
  const toggleSelect = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const act = async (action: () => Promise<unknown>, message: string) => {
    setOpenMenu(null);
    if (await run(action, message)) reload();
  };

  const bulk = async (fn: (id: number) => Promise<unknown>, message: string) => {
    const ids = [...selected];
    await act(() => forEachId(ids, fn), message.replace('{n}', String(ids.length)));
    setSelected([]);
  };

  const setStatusOf = (id: number, value: string) => api.patch(`/admin/blogs/${id}/status`, { status: value });

  const handleDelete = async () => {
    if (!deleteBlog) return;
    const blog = deleteBlog;
    setDeleteBlog(null);
    await act(() => api.delete(`/admin/blogs/${blog.id}`), `"${blog.title}" moved to trash`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blogs"
        subtitle={meta ? plural(meta.total, 'blog') : 'Loading…'}
        actions={canWrite ? <Button size="sm" onClick={() => navigate('/blogs/new')}><Plus size={13} /> Create Blog</Button> : undefined}
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={filterChanged(setSearch)} placeholder="Search blogs..." />
          <select value={categoryId} onChange={e => filterChanged(setCategoryId)(e.target.value)} className={filterSelectClass} aria-label="Category">
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={e => filterChanged(setStatus)(e.target.value)} className={filterSelectClass} aria-label="Status">
            {['All', 'Published', 'Draft', 'Archived'].map(s => <option key={s} value={s}>{s === 'All' ? 'Status: All' : s}</option>)}
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
            <button disabled={busy} className="text-xs text-blue-700 hover:underline disabled:opacity-50" onClick={() => bulk(id => setStatusOf(id, 'Published'), '{n} blog(s) published')}>Publish</button>
            <button disabled={busy} className="text-xs text-blue-700 hover:underline disabled:opacity-50" onClick={() => bulk(id => setStatusOf(id, 'Draft'), '{n} blog(s) unpublished')}>Unpublish</button>
            <button disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50" onClick={() => bulk(id => api.delete(`/admin/blogs/${id}`), '{n} blog(s) moved to trash')}>Delete</button>
            <button onClick={() => setSelected([])} aria-label="Clear selection" className="ml-auto"><X size={12} className="text-slate-400" /></button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className={`w-full text-sm transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {canWrite && <th className="px-4 py-3 w-8"><Checkbox checked={allSelected} onChange={toggleAll} /></th>}
                <SortableTh label="Title" field="title" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Author</th>
                <th className="px-4 py-3 text-left">Status</th>
                <SortableTh label="Published" field="published_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Featured</th>
                <SortableTh label="Updated" field="updated_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={9} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<Search size={22} />} emptyTitle="No blogs found" onRetry={reload}
                onClear={hasFilters ? clearFilters : undefined}
              />
              {!error && items.map(blog => (
                <tr key={blog.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected.includes(blog.id) ? 'bg-blue-50/40' : ''}`}>
                  {canWrite && <td className="px-4 py-3.5"><Checkbox checked={selected.includes(blog.id)} onChange={() => toggleSelect(blog.id)} /></td>}
                  <td className="px-4 py-3.5 max-w-72">
                    <div className="flex items-center gap-3">
                      {blog.featured_image_url
                        ? <img src={blog.featured_image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg flex-shrink-0" />}
                      <p className="font-medium text-slate-800 truncate">{blog.title}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{blog.category ?? '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{blog.author ?? '—'}</td>
                  <td className="px-4 py-3.5">{statusBadge(blog.status)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{date(blog.published_at)}</td>
                  <td className="px-4 py-3.5">{blog.is_featured ? <Star size={13} className="text-amber-400 fill-amber-400" /> : <span className="text-slate-200">—</span>}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{date(blog.updated_at)}</td>
                  <td className="px-4 py-3.5">
                    <RowMenu open={openMenu === blog.id} onToggle={() => setOpenMenu(openMenu === blog.id ? null : blog.id)}>
                      {canWrite && <>
                      <RowMenuItem icon={<Edit size={13} />} onClick={() => navigate(`/blogs/${blog.id}/edit`)}>Edit</RowMenuItem>
                      <RowMenuItem icon={<Copy size={13} />} onClick={() => act(() => api.post(`/admin/blogs/${blog.id}/duplicate`), 'Blog duplicated as draft')}>Duplicate</RowMenuItem>
                      <RowMenuItem onClick={() => act(
                        () => setStatusOf(blog.id, blog.status === 'Published' ? 'Draft' : 'Published'),
                        blog.status === 'Published' ? 'Blog unpublished' : 'Blog published',
                      )}>{blog.status === 'Published' ? 'Unpublish' : 'Publish'}</RowMenuItem>
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <RowMenuItem danger icon={<Trash2 size={13} />} onClick={() => { setDeleteBlog(blog); setOpenMenu(null); }}>Delete</RowMenuItem>
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

      <ConfirmModal open={!!deleteBlog} onClose={() => setDeleteBlog(null)} onConfirm={handleDelete} title="Delete Blog?" message={`Delete "${deleteBlog?.title}"? It will be moved to Trash.`} confirmLabel="Delete Blog" />
    </div>
  );
}
