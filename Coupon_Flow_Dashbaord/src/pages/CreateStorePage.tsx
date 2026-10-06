import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Upload, X } from 'lucide-react';
import { Card, Input, Textarea, Toggle, Button, PageHeader } from '../components/ui';
import { FieldError, FormLoadState, ImagePicker } from '../components/FormParts';
import { StoreLinkBox } from '../components/StoreLink';
import { StoreRatings } from '../components/StoreRatings';
import { api, ApiError, toFormData } from '../lib/api';
import { useApi, useCategories } from '../lib/hooks';
import { slugify } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { Store } from '../lib/types';

function StoreForm({ store }: { store: Store | null }) {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const categories = useCategories('store');
  const isEdit = store !== null;

  const [name, setName] = useState(store?.name ?? '');
  const [slug, setSlug] = useState(store?.slug ?? '');
  const [categoryId, setCategoryId] = useState(store?.category_id ? String(store.category_id) : '');
  const [directUrl, setDirectUrl] = useState(store?.direct_url ?? '');
  const [trackingUrl, setTrackingUrl] = useState(store?.tracking_url ?? '');
  const [heading, setHeading] = useState(store?.heading ?? '');
  const [description, setDescription] = useState(store?.description ?? '');
  const [content, setContent] = useState(store?.content ?? '');
  const [metaTitle, setMetaTitle] = useState(store?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(store?.meta_description ?? '');
  const [metaKeywords, setMetaKeywords] = useState(store?.meta_keywords ?? '');
  const [topStore, setTopStore] = useState(store?.is_top ?? false);
  const [editorChoice, setEditorChoice] = useState(store?.is_editor_choice ?? false);
  const [deactivated, setDeactivated] = useState(store?.status === 'Inactive');
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const clearError = (field: string) => { if (errors[field]) setErrors(p => ({ ...p, [field]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Store name is required';
    if (!directUrl.trim()) e.direct_url = 'Direct URL is required';
    return e;
  };

  const handleSave = async (draft: boolean) => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);

    const form = toFormData({
      name, slug: slug || undefined, category_id: categoryId || undefined,
      direct_url: directUrl, tracking_url: trackingUrl, heading, description, content,
      meta_title: metaTitle, meta_description: metaDescription, meta_keywords: metaKeywords,
      is_top: topStore, is_editor_choice: editorChoice,
      status: draft ? 'Draft' : deactivated ? 'Inactive' : 'Active',
      logo: logo ?? undefined,
      remove_logo: removeLogo || undefined,
    });

    try {
      if (isEdit) await api.upload(`/admin/stores/${store.id}`, form, 'PATCH');
      else await api.upload('/admin/stores', form);
      showToast('success', isEdit ? 'Store updated successfully' : draft ? 'Store saved as draft' : 'Store created successfully');
      navigate('/stores');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      showToast('error', (err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title={isEdit ? `Edit Store: ${store.name}` : 'Create Store'} subtitle={isEdit ? 'Update store information' : 'Add a new store to the platform'} />

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Basic Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input label="Store Name" placeholder="e.g. Amazon" value={name} required
              onChange={v => { setName(v); clearError('name'); if (!isEdit) setSlug(slugify(v)); }} />
            <FieldError message={errors.name} />
          </div>
          <div>
            <Input label="Store Slug" placeholder="e.g. amazon" value={slug} helperText="Lowercase letters, numbers and dashes. Generated from the name if left empty."
              onChange={v => { setSlug(v); clearError('slug'); }} />
            <FieldError message={errors.slug} />
          </div>
          <div className="sm:col-span-2">
            <StoreLinkBox slug={slug || slugify(name)} canOpen={isEdit && store.status === 'Active' && slug === store.slug} />
          </div>
          <div className="sm:col-span-2"><Input label="Store Heading" placeholder="Short headline for the store page" value={heading} onChange={setHeading} /></div>
          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium text-slate-700">Category</label>
            <select id="category" value={categoryId} onChange={e => { setCategoryId(e.target.value); clearError('category_id'); }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <FieldError message={errors.category_id} />
          </div>
          <div className="sm:col-span-2">
            <ImagePicker label="Store Logo" hint="PNG, JPG, WebP up to 2MB" file={logo} currentUrl={store?.logo_url ?? null}
              onChange={f => { setLogo(f); clearError('logo'); }} icon={<Upload size={20} />} removeIcon={<X size={10} />}
              maxMb={2} removed={removeLogo} onRemoveSaved={isEdit ? setRemoveLogo : undefined} />
            <FieldError message={errors.logo} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">URLs & Tracking</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input label="Direct URL" placeholder="https://www.amazon.com" value={directUrl} required
              onChange={v => { setDirectUrl(v); clearError('direct_url'); }} />
            <FieldError message={errors.direct_url} />
          </div>
          <div>
            <Input label="Tracking URL" placeholder="https://track.example.com/amazon?ref=..." value={trackingUrl}
              onChange={v => { setTrackingUrl(v); clearError('tracking_url'); }} helperText="Include affiliate parameters for accurate conversion tracking." />
            <FieldError message={errors.tracking_url} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">SEO</h2>
        <div className="space-y-4">
          <Input label="Meta Title" placeholder="Best Amazon Coupons & Deals 2026 | Coupon Follow" value={metaTitle} onChange={setMetaTitle} />
          <Textarea label="Meta Description" placeholder="Find the latest Amazon promo codes and deals..." rows={3} value={metaDescription} onChange={setMetaDescription} />
          <Input label="Meta Keywords" placeholder="amazon coupons, amazon deals, amazon promo codes" value={metaKeywords} onChange={setMetaKeywords} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Display Settings</h2>
        <div className="space-y-4">
          {[
            { label: 'Top Store', desc: 'Feature in the Top Stores section', value: topStore, set: setTopStore },
            { label: 'Editor Choice', desc: "Mark as editor's pick", value: editorChoice, set: setEditorChoice },
            { label: 'Deactivate Store', desc: 'Hidden from the public site when deactivated', value: deactivated, set: setDeactivated },
          ].map(({ label, desc, value, set }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{desc}</p></div>
              <Toggle checked={value} onChange={set} ariaLabel={label} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Page Content</h2>
        <div className="space-y-4">
          <Textarea label="Store Description" placeholder="Short description shown in listings..." rows={3} value={description} onChange={setDescription} />
          <Textarea label="Store Content" placeholder="Full page content..." rows={6} value={content} onChange={setContent} />
        </div>
      </Card>

      {isEdit && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Visitor Rating</h2>
          <p className="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-100">Stars visitors give on the store page. Changes here apply immediately; no need to save the store.</p>
          <StoreRatings storeId={store.id} storeName={store.name} />
        </Card>
      )}

      <div className="sticky bottom-0 -mx-6 px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between z-10">
        <Button variant="ghost" onClick={() => navigate('/stores')} disabled={saving}>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update Store' : 'Save Store'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function CreateStorePage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<{ data: Store }>(id ? `/admin/stores/${id}` : null);

  if (id && (loading || error || !data)) return <FormLoadState loading={loading} error={error} onRetry={reload} />;

  // Keyed so switching between two edit URLs re-initialises the form state.
  return <StoreForm key={id ?? 'new'} store={data?.data ?? null} />;
}
