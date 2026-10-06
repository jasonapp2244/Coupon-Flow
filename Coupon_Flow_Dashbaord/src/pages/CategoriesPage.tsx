import { useState } from 'react';
import { Plus, X, Edit, Trash2, FolderOpen } from 'lucide-react';
import { Card, Button, PageHeader, statusBadge } from '../components/ui';
import { ConfirmModal } from '../components/Modal';
import { FieldError } from '../components/FormParts';
import { Pagination, SearchInput, SortableTh, TableBodyState } from '../components/DataTable';
import { api, ApiError } from '../lib/api';
import { useAction, useApiList, useDebounced, useListControls } from '../lib/hooks';
import { date, slugify, plural } from '../lib/format';
import { useApp, useCan } from '../store/AppContext';
import type { Category, CategoryType } from '../lib/types';

const inputClass = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-400';

interface CategoryModalProps {
  type: CategoryType;
  initial: Category | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Create/edit dialog. Rendered with a key per category, so its state always starts from `initial`. */
function CategoryModal({ type, initial, onClose, onSaved }: CategoryModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [slugManual, setSlugManual] = useState(!!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { setErrors({ name: 'Category name is required' }); return; }
    setSaving(true);
    const payload = { name: name.trim(), slug: slug.trim() || undefined, description: description || null, is_active: active };
    try {
      if (initial) await api.patch(`/admin/categories/${initial.id}`, payload);
      else await api.post('/admin/categories', { ...payload, type });
      onSaved(initial ? 'Category updated successfully' : 'Category created successfully');
    } catch (err) {
      setErrors(err instanceof ApiError && err.status === 422 ? err.fieldErrors() : { name: (err as Error).message });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800">{initial ? 'Edit Category' : 'Create Category'}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="category-name" className="text-sm font-medium text-slate-700 block mb-1">Category Name <span className="text-red-500">*</span></label>
            <input id="category-name" value={name} placeholder="e.g. Shopping Deals" className={inputClass}
              onChange={e => { setName(e.target.value); if (!slugManual) setSlug(slugify(e.target.value)); setErrors({}); }} />
            <FieldError message={errors.name} />
          </div>
          <div>
            <label htmlFor="category-slug" className="text-sm font-medium text-slate-700 block mb-1">Slug</label>
            <input id="category-slug" value={slug} placeholder="e.g. shopping-deals" className={`${inputClass} font-mono`}
              onChange={e => { setSlugManual(true); setSlug(e.target.value); setErrors({}); }} />
            <p className="text-xs text-slate-400 mt-0.5">Auto-generated from name</p>
            <FieldError message={errors.slug} />
          </div>
          <div>
            <label htmlFor="category-description" className="text-sm font-medium text-slate-700 block mb-1">Description</label>
            <textarea id="category-description" value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Optional description for this category" className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label htmlFor="category-status" className="text-sm font-medium text-slate-700 block mb-1">Status</label>
            <select id="category-status" value={active ? 'Active' : 'Inactive'} onChange={e => setActive(e.target.value === 'Active')} className={inputClass}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Category'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage({ type }: { type: CategoryType }) {
  const list = useListControls('name', 'asc');
  const { run } = useAction();
  const [search, setSearch] = useState('');
  // undefined = closed, null = creating, Category = editing
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const { showToast } = useApp();
  const canWrite = useCan('write');

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Category>('/admin/categories', { ...list.params, type, q });

  const title = type === 'store' ? 'Store Categories' : 'Blog Categories';
  const itemsLabel = type === 'store' ? 'Stores' : 'Blogs';

  const handleSaved = (message: string) => {
    setEditing(undefined);
    showToast('success', message);
    reload();
  };

  const handleDelete = async () => {
    if (!deleteCat) return;
    const cat = deleteCat;
    setDeleteCat(null);
    if (await run(() => api.delete(`/admin/categories/${cat.id}`), `"${cat.name}" deleted`)) reload();
  };

  const toggleStatus = async (cat: Category) => {
    if (await run(() => api.patch(`/admin/categories/${cat.id}`, { is_active: !cat.is_active }), `"${cat.name}" ${cat.is_active ? 'deactivated' : 'activated'}`)) reload();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={meta ? plural(meta.total, 'category', 'categories') : 'Loading…'}
        actions={canWrite ? <Button size="sm" onClick={() => setEditing(null)}><Plus size={13} /> Create Category</Button> : undefined}
      />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); list.setPage(1); }} placeholder="Search by name…" />
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-sm transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                <SortableTh label="Category Name" field="name" sort={list.sort} dir={list.dir} onSort={list.onSort} className="px-5 py-3" />
                <th className="px-5 py-3 text-left">Slug</th>
                <th className="px-5 py-3 text-left">{itemsLabel}</th>
                <th className="px-5 py-3 text-left">Status</th>
                <SortableTh label="Updated" field="updated_at" sort={list.sort} dir={list.dir} onSort={list.onSort} className="px-5 py-3" />
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={6} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<FolderOpen size={22} />} emptyTitle="No categories found" onRetry={reload}
                onClear={search ? () => setSearch('') : undefined}
              />
              {!error && items.map(cat => (
                <tr key={cat.id} className="border-b border-slate-50 hover:bg-slate-50 last:border-0">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{cat.name}</td>
                  <td className="px-5 py-3.5"><code className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{cat.slug}</code></td>
                  <td className="px-5 py-3.5 text-slate-700 font-medium">{cat.items_count ?? 0}</td>
                  <td className="px-5 py-3.5">
                    {canWrite
                      ? <button onClick={() => toggleStatus(cat)} title="Toggle status">{statusBadge(cat.is_active ? 'Active' : 'Inactive')}</button>
                      : statusBadge(cat.is_active ? 'Active' : 'Inactive')}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{date(cat.updated_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className={`flex items-center gap-1 ${canWrite ? '' : 'hidden'}`}>
                      <button onClick={() => setEditing(cat)} title="Edit" aria-label={`Edit ${cat.name}`}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"><Edit size={13} /></button>
                      <button onClick={() => setDeleteCat(cat)} title="Delete" aria-label={`Delete ${cat.name}`}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {editing !== undefined && (
        <CategoryModal key={editing?.id ?? 'new'} type={type} initial={editing} onClose={() => setEditing(undefined)} onSaved={handleSaved} />
      )}
      <ConfirmModal
        open={!!deleteCat}
        onClose={() => setDeleteCat(null)}
        onConfirm={handleDelete}
        title="Delete Category?"
        message={`Delete "${deleteCat?.name}"? ${itemsLabel} in it are kept and become uncategorised.`}
        confirmLabel="Delete Category"
      />
    </div>
  );
}
