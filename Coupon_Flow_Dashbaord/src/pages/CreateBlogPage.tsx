import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Upload, X } from 'lucide-react';
import { Card, Input, Textarea, Toggle, Button, PageHeader } from '../components/ui';
import { FieldError, FormLoadState, ImagePicker } from '../components/FormParts';
import { ArticleEditor } from '../components/ArticleEditor';
import { api, ApiError, toFormData } from '../lib/api';
import { useApi, useCategories } from '../lib/hooks';
import { slugify } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { Blog } from '../lib/types';

function BlogForm({ blog }: { blog: Blog | null }) {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const categories = useCategories('blog');
  const isEdit = blog !== null;

  const [title, setTitle] = useState(blog?.title ?? '');
  const [slug, setSlug] = useState(blog?.slug ?? '');
  const [categoryId, setCategoryId] = useState(blog?.category_id ? String(blog.category_id) : '');
  const [publishDate, setPublishDate] = useState(blog?.published_at?.slice(0, 10) ?? '');
  const [excerpt, setExcerpt] = useState(blog?.excerpt ?? '');
  const [body, setBody] = useState(blog?.body ?? '');
  const [metaTitle, setMetaTitle] = useState(blog?.meta_title ?? '');
  const [metaDesc, setMetaDesc] = useState(blog?.meta_description ?? '');
  const [metaKeywords, setMetaKeywords] = useState(blog?.meta_keywords ?? '');
  const [featured, setFeatured] = useState(blog?.is_featured ?? false);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => { if (errors[field]) setErrors(p => ({ ...p, [field]: '' })); };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { setErrors({ title: 'Blog title is required' }); return; }
    setSaving(true);

    const form = toFormData({
      title, slug: slug || undefined, category_id: categoryId || undefined,
      excerpt, body, meta_title: metaTitle, meta_description: metaDesc, meta_keywords: metaKeywords,
      is_featured: featured,
      status: publish ? 'Published' : 'Draft',
      // A future date schedules the post: it stays hidden on the public site until then.
      // Sent even when empty, so clearing the date on an existing post takes effect.
      published_at: publishDate,
      featured_image: image ?? undefined,
      remove_featured_image: removeImage || undefined,
    });

    try {
      if (isEdit) await api.upload(`/admin/blogs/${blog.id}`, form, 'PATCH');
      else await api.upload('/admin/blogs', form);
      showToast('success', publish ? (isEdit ? 'Blog updated and published' : 'Blog published successfully') : 'Blog saved as draft');
      navigate('/blogs');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      showToast('error', (err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title={isEdit ? 'Edit Blog' : 'Create Blog'} subtitle={isEdit ? 'Update blog post' : 'Write and publish a new blog post'} />

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Post Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Blog Title" placeholder="e.g. Best Amazon Deals This September" value={title} required
              onChange={v => { setTitle(v); clearError('title'); if (!isEdit) setSlug(slugify(v)); }} />
            <FieldError message={errors.title} />
          </div>
          <div>
            <Input label="Blog Slug" placeholder="e.g. best-amazon-deals" value={slug} helperText="URL: /blog/{slug}"
              onChange={v => { setSlug(v); clearError('slug'); }} />
            <FieldError message={errors.slug} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium text-slate-700">Category</label>
            <select id="category" value={categoryId} onChange={e => { setCategoryId(e.target.value); clearError('category_id'); }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <FieldError message={errors.category_id} />
          </div>
          <div>
            <Input label="Publish Date" type="date" value={publishDate} onChange={v => { setPublishDate(v); clearError('published_at'); }}
              helperText="Optional. Leave empty to publish immediately." />
            <FieldError message={errors.published_at} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Featured Image</h2>
        <ImagePicker label="Image" hint="PNG, JPG, WebP up to 5MB" file={image} currentUrl={blog?.featured_image_url ?? null}
          onChange={f => { setImage(f); clearError('featured_image'); }} icon={<Upload size={20} />} removeIcon={<X size={10} />}
          maxMb={5} removed={removeImage} onRemoveSaved={isEdit ? setRemoveImage : undefined} />
        <FieldError message={errors.featured_image} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Content</h2>
        <div className="space-y-4">
          <div>
            <Textarea label="Short Description" placeholder="One or two sentences that make readers want the full article. Shown on blog cards and under the title." rows={3} value={excerpt} onChange={v => { setExcerpt(v); clearError('excerpt'); }} />
            <p className={`text-xs text-right mt-0.5 ${excerpt.length > 300 ? 'text-amber-600' : 'text-slate-400'}`}>{excerpt.length}/300 recommended</p>
            <FieldError message={errors.excerpt} />
          </div>
          <div>
            <ArticleEditor label="Article" value={body} error={errors.body}
              placeholder={'## Start with a heading\n\nWrite a paragraph. Leave a blank line between paragraphs.\n\n- Use the toolbar for lists, bold text, links and tips'}
              onChange={v => { setBody(v); clearError('body'); }} />
            <FieldError message={errors.body} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">SEO</h2>
        <div className="space-y-4">
          <div>
            <Input label="Meta Title" placeholder="SEO page title (60 chars max)" value={metaTitle} onChange={setMetaTitle} />
            <p className={`text-xs text-right mt-0.5 ${metaTitle.length > 60 ? 'text-amber-600' : 'text-slate-400'}`}>{metaTitle.length}/60</p>
          </div>
          <div>
            <Textarea label="Meta Description" placeholder="SEO description (160 chars max)" rows={3} value={metaDesc} onChange={setMetaDesc} />
            <p className={`text-xs text-right mt-0.5 ${metaDesc.length > 160 ? 'text-amber-600' : 'text-slate-400'}`}>{metaDesc.length}/160</p>
          </div>
          <Input label="Meta Keywords" placeholder="comma, separated, keywords" value={metaKeywords} onChange={setMetaKeywords} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Display Settings</h2>
        <div className="flex items-center justify-between py-2">
          <div><p className="text-sm font-medium text-slate-700">Featured on Homepage</p><p className="text-xs text-slate-400">Show in the homepage featured section</p></div>
          <Toggle checked={featured} onChange={setFeatured} ariaLabel="Featured post" />
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-6 px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between z-10">
        <Button variant="ghost" onClick={() => navigate('/blogs')} disabled={saving}>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>{saving ? 'Publishing…' : isEdit ? 'Update & Publish' : 'Publish'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function CreateBlogPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<{ data: Blog }>(id ? `/admin/blogs/${id}` : null);

  if (id && (loading || error || !data)) return <FormLoadState loading={loading} error={error} onRetry={reload} />;

  return <BlogForm key={id ?? 'new'} blog={data?.data ?? null} />;
}
