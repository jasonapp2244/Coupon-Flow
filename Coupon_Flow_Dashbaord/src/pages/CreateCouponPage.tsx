import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { RotateCcw } from 'lucide-react';
import { CodesLeftBar, UsageBar } from '../components/CouponUsage';
import { Card, Input, Toggle, Button, PageHeader } from '../components/ui';
import { FieldError, FormLoadState } from '../components/FormParts';
import { api, ApiError } from '../lib/api';
import { StorePicker } from '../components/StorePicker';
import { useApi } from '../lib/hooks';
import { useApp, useCan } from '../store/AppContext';
import { addedMessage, CouponCodesCard, parseCodes } from '../components/CouponCodes';
import type { Coupon, CouponCodesAdded, CouponType, Settings } from '../lib/types';

const COUPON_TYPES: CouponType[] = ['Coupon Code', 'Deal', 'No Code Required'];

function CouponForm({ coupon }: { coupon: Coupon | null }) {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const canWrite = useCan('write');
  const isEdit = coupon !== null;

  const [title, setTitle] = useState(coupon?.title ?? '');
  const [storeId, setStoreId] = useState(coupon ? String(coupon.store_id) : '');
  const [type, setType] = useState<CouponType>(coupon?.type ?? 'Coupon Code');
  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [featured, setFeatured] = useState(coupon?.is_featured ?? false);
  const [verified, setVerified] = useState(coupon?.is_verified ?? false);
  const [exclusive, setExclusive] = useState(coupon?.is_exclusive ?? false);
  // "YYYY-MM-DDTHH:mm" in the store's timezone (Settings → General); the API converts to exact moments.
  const [startsAt, setStartsAt] = useState(coupon?.starts_at_local ?? '');
  const [expiresAt, setExpiresAt] = useState(coupon?.expires_at_local ?? '');
  const [usageLimit, setUsageLimit] = useState(coupon?.usage_limit != null ? String(coupon.usage_limit) : '');
  const [uses, setUses] = useState(coupon?.uses_count ?? 0);
  const [resetting, setResetting] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState(coupon?.tracking_url ?? '');
  const settings = useApi<{ data: Settings }>('/admin/settings');
  const timezone = settings.data?.data.general.timezone;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [commission, setCommission] = useState(coupon?.commission_percent != null ? String(coupon.commission_percent) : '');
  // Code list: shoppers each get the next unused code from a pasted list instead of one shared code.
  const [uniqueCodes, setUniqueCodes] = useState(coupon?.unique_codes ?? false);
  const [maxPerVisitor, setMaxPerVisitor] = useState(String(coupon?.max_codes_per_visitor ?? 5));
  const [newCodes, setNewCodes] = useState('');
  const [codeCounts, setCodeCounts] = useState(coupon ? { total: coupon.codes_total, left: coupon.codes_left } : null);

  const isCodeList = type === 'Coupon Code' && uniqueCodes;
  const needsCode = type === 'Coupon Code' && !uniqueCodes;
  const clearError = (field: string) => { if (errors[field]) setErrors(p => ({ ...p, [field]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Offer name is required';
    if (!storeId) e.store_id = 'Store is required';
    if (needsCode && !code.trim()) e.code = 'Coupon code is required';
    if (startsAt && expiresAt && expiresAt <= startsAt) e.expires_at = 'The deal must end after it starts';
    if (!isCodeList && usageLimit !== '' && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) < 1)) e.usage_limit = 'Enter a whole number of 1 or more, or leave it empty for unlimited';
    if (isCodeList && (maxPerVisitor.trim() === '' || !Number.isInteger(Number(maxPerVisitor)) || Number(maxPerVisitor) < 0 || Number(maxPerVisitor) > 1000)) e.max_codes_per_visitor = 'Enter a whole number from 0 to 1000 (0 = no limit)';
    if (isCodeList && parseCodes(newCodes).length > 5000) e.codes = 'Add at most 5,000 codes at a time';
    const rate = commission.trim();
    if (rate !== '' && (!/^\d{1,3}(\.\d{1,2})?$/.test(rate) || Number(rate) > 100)) e.commission_percent = 'Enter a percentage from 0 to 100, up to 2 decimals';
    return e;
  };

  const handleSave = async (publish: boolean) => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);

    const payload = {
      store_id: Number(storeId),
      title,
      type,
      code: needsCode ? code.trim() : null,
      description: description || null,
      tracking_url: trackingUrl || null,
      starts_at: startsAt || null,
      expires_at: expiresAt || null,
      // A code list's size is its limit; the API ignores usage_limit for it.
      usage_limit: isCodeList || usageLimit === '' ? null : Number(usageLimit),
      unique_codes: isCodeList,
      max_codes_per_visitor: isCodeList ? Number(maxPerVisitor) : (coupon?.max_codes_per_visitor ?? 5),
      commission_percent: commission.trim() === '' ? null : Number(commission),
      status: publish ? 'Active' : 'Draft',
      is_featured: featured,
      is_verified: verified,
      is_exclusive: exclusive,
    };

    try {
      if (isEdit) {
        await api.patch(`/admin/coupons/${coupon.id}`, payload);
      } else {
        const created = await api.post<{ data: Coupon }>('/admin/coupons', payload);
        const codes = isCodeList ? parseCodes(newCodes) : [];
        if (codes.length) {
          try {
            const res = await api.post<CouponCodesAdded>(`/admin/coupons/${created.data.id}/codes`, { codes: codes.join('\n') });
            showToast('success', addedMessage(res));
          } catch (codesErr) {
            // The coupon exists; open it so the codes can be added again from its Codes card.
            showToast('error', `Coupon saved, but its codes weren't added: ${(codesErr as Error).message}`);
            navigate(`/coupons/${created.data.id}/edit`);
            return;
          }
        }
      }
      showToast('success', isEdit ? 'Coupon updated successfully' : publish ? 'Coupon published successfully' : 'Coupon saved as draft');
      navigate('/coupons');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      showToast('error', (err as Error).message);
      setSaving(false);
    }
  };

  const resetUses = async () => {
    if (!coupon) return;
    setResetting(true);
    try {
      const res = await api.post<{ data: Coupon }>(`/admin/coupons/${coupon.id}/reset-uses`);
      setUses(res.data.uses_count);
      showToast('success', 'Uses reset to 0');
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  /** Quick picks fill the inputs with store-local wall-clock times. */
  const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return local(d); };
  const inDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 0, 0); return local(d); };

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title={isEdit ? 'Edit Coupon' : 'Create Coupon'} subtitle={isEdit ? 'Update coupon details' : 'Add a new coupon or deal'} />

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Offer Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Offer Name" placeholder="e.g. Save 20% on All Amazon Orders" value={title} required
              onChange={v => { setTitle(v); clearError('title'); }} />
            <FieldError message={errors.title} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-700">Store<span className="text-red-500 ml-0.5">*</span></p>
            <StorePicker value={storeId} label={coupon?.store} invalid={!!errors.store_id} onChange={id => { setStoreId(id); clearError('store_id'); }} />
            <FieldError message={errors.store_id} />
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-slate-700 block mb-2">Coupon Type</p>
            <div className="flex gap-3 flex-wrap">
              {COUPON_TYPES.map(t => (
                <button key={t} type="button" onClick={() => { setType(t); clearError('code'); }}
                  className={`flex-1 min-w-32 py-2.5 rounded-lg border text-sm font-medium transition-colors ${type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t}</button>
              ))}
            </div>
          </div>
          {type === 'Coupon Code' && (
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-slate-700 block mb-2">Code delivery</p>
              <div className="flex gap-3 flex-wrap">
                {([[false, 'Same code for everyone'], [true, 'Code list (next code per click)']] as const).map(([value, label]) => (
                  <button key={label} type="button" aria-pressed={uniqueCodes === value}
                    onClick={() => { setUniqueCodes(value); clearError('code'); clearError('unique_codes'); }}
                    className={`flex-1 min-w-48 py-2.5 rounded-lg border text-sm font-medium transition-colors ${uniqueCodes === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {uniqueCodes
                  ? 'Paste single-use codes. Every "Show coupon code" click gives the shopper the next unused one.'
                  : 'Every shopper sees the same code.'}
              </p>
              <FieldError message={errors.unique_codes} />
            </div>
          )}
          {needsCode && (
            <div className="sm:col-span-2">
              <Input label="Coupon Code" placeholder="e.g. SAVE20FALL" value={code} required helperText="Exact code shoppers enter at the store's checkout"
                onChange={v => { setCode(v); clearError('code'); }} />
              <FieldError message={errors.code} />
            </div>
          )}
          {isCodeList && !isEdit && (
            <div className="sm:col-span-2">
              <label htmlFor="new-codes" className="text-sm font-medium text-slate-700">Paste codes, one per line</label>
              <textarea id="new-codes" rows={6} value={newCodes} onChange={e => { setNewCodes(e.target.value); clearError('codes'); }}
                placeholder={'SAVE-8K2Q\nSAVE-91ZD\nSAVE-4MXP'}
                className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-slate-700 placeholder:text-slate-400 resize-y" />
              <p className="text-xs text-slate-400">
                {parseCodes(newCodes).length ? `${parseCodes(newCodes).length} codes will be added when you save. ` : ''}
                You can also add codes (or upload a CSV / TXT file) after saving, from the coupon's edit page.
              </p>
              <FieldError message={errors.codes} />
            </div>
          )}
        </div>
      </Card>

      {isCodeList && isEdit && (
        <CouponCodesCard couponId={coupon.id} canWrite={canWrite} onCountsChange={setCodeCounts} />
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Description</h2>
        <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Describe the offer in detail. Include terms, restrictions, and how to redeem..."
          className="w-full px-3 py-3 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-slate-700 placeholder:text-slate-400 resize-none" />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Display Settings</h2>
        <div className="space-y-3">
          {[
            { label: 'Featured on Homepage', desc: 'Show this coupon in the featured section', value: featured, set: setFeatured },
            { label: 'Verified Coupon', desc: 'Mark as tested and verified by the team', value: verified, set: setVerified },
            { label: 'Exclusive Offer', desc: 'This is an exclusive deal not found elsewhere', value: exclusive, set: setExclusive },
          ].map(({ label, desc, value, set }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{desc}</p></div>
              <Toggle checked={value} onChange={set} ariaLabel={label} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Deal Window & Usage</h2>
        <p className="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-100">
          The coupon shows on the website only between these times{timezone ? ` (${timezone.replace('_', ' ')} time)` : ''}, and until its uses run out.
          Outside the window, or when used up, it is hidden and its link sends shoppers back to the store page.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input label="Starts" type="datetime-local" value={startsAt} onChange={v => { setStartsAt(v); clearError('starts_at'); clearError('expires_at'); }} helperText="Empty: live as soon as it's published" />
            <FieldError message={errors.starts_at} />
          </div>
          <div>
            <Input label="Ends" type="datetime-local" value={expiresAt} onChange={v => { setExpiresAt(v); clearError('expires_at'); }} helperText="Empty: no end date" />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[['Tonight 11:59 PM', endOfToday()], ['+7 days', inDays(7)], ['+30 days', inDays(30)], ['No end', '']].map(([label, value]) => (
                <button key={label} type="button" onClick={() => { setExpiresAt(value); clearError('expires_at'); }}
                  className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">{label}</button>
              ))}
            </div>
            <FieldError message={errors.expires_at} />
          </div>
          {isCodeList ? (
            <div>
              <Input label="Max codes per visitor per day" type="number" placeholder="5" value={maxPerVisitor}
                onChange={v => { setMaxPerVisitor(v); clearError('max_codes_per_visitor'); }}
                helperText="0 = no limit" />
              <FieldError message={errors.max_codes_per_visitor} />
            </div>
          ) : (
            <div>
              <Input label="Usage limit" type="number" placeholder="Unlimited" value={usageLimit}
                onChange={v => { setUsageLimit(v); clearError('usage_limit'); }}
                helperText="How many times shoppers can use it. Each 'Show coupon code' / 'Get deal' click uses one. Empty = unlimited." />
              <FieldError message={errors.usage_limit} />
            </div>
          )}
          {isEdit && isCodeList && codeCounts && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Codes left</p>
              <CodesLeftBar left={codeCounts.left} total={codeCounts.total} />
            </div>
          )}
          {isEdit && !isCodeList && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Used so far</p>
              <UsageBar uses={uses} limit={usageLimit === '' ? null : Number(usageLimit) || null}
                percent={usageLimit === '' || !Number(usageLimit) ? null : Math.min(100, Math.round(uses / Number(usageLimit) * 1000) / 10)} />
              {uses > 0 && (
                <button type="button" onClick={resetUses} disabled={resetting} className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50">
                  <RotateCcw size={12} /> {resetting ? 'Resetting…' : 'Reset uses to 0'}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Tracking & Commission</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Tracking URL" placeholder="https://track.example.com/amazon?coupon=..." value={trackingUrl}
              onChange={v => { setTrackingUrl(v); clearError('tracking_url'); }} helperText="Leave blank to use the store's default tracking URL" />
            <FieldError message={errors.tracking_url} />
          </div>
          <div>
            <Input label="Commission % (optional)" type="number" placeholder="Store's rate" value={commission}
              onChange={v => { setCommission(v); clearError('commission_percent'); }} helperText="Overrides the store's rate for this coupon" />
            <FieldError message={errors.commission_percent} />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-6 px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between z-10">
        <Button variant="ghost" onClick={() => navigate('/coupons')} disabled={saving}>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>{saving ? 'Publishing…' : isEdit ? 'Update & Publish' : 'Publish Coupon'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function CreateCouponPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<{ data: Coupon }>(id ? `/admin/coupons/${id}` : null);

  if (id && (loading || error || !data)) return <FormLoadState loading={loading} error={error} onRetry={reload} />;

  return <CouponForm key={id ?? 'new'} coupon={data?.data ?? null} />;
}
