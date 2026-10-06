import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RotateCcw } from 'lucide-react';
import { UsageBar } from '../components/CouponUsage';
import { Card, Input, Toggle, Button, PageHeader } from '../components/ui';
import { FieldError, FormLoadState } from '../components/FormParts';
import { CodeInput, CodePool, addCodes, describeAdd, parseCodes } from '../components/CodePool';
import { api, ApiError } from '../lib/api';
import { StorePicker } from '../components/StorePicker';
import { useApi } from '../lib/hooks';
import { fromCents, number, toCents } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { Coupon, CouponType, Settings } from '../lib/types';

const COUPON_TYPES: CouponType[] = ['Coupon Code', 'Deal', 'No Code Required'];

function CouponForm({ coupon }: { coupon: Coupon | null }) {
  const navigate = useNavigate();
  const { showToast } = useApp();
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
  const [isPaid, setIsPaid] = useState((coupon?.price_cents ?? 0) > 0);
  const settings = useApi<{ data: Settings }>('/admin/settings');
  const shopOff = settings.data?.data.general.shop_enabled === false;
  const timezone = settings.data?.data.general.timezone;
  const [price, setPrice] = useState(fromCents(coupon?.price_cents ?? 0));
  const [limitStock, setLimitStock] = useState(coupon?.stock !== null && coupon?.stock !== undefined);
  const [stock, setStock] = useState(coupon?.stock != null ? String(coupon.stock) : '');
  const [uniqueCodes, setUniqueCodes] = useState(coupon?.unique_codes ?? false);
  const [poolStock, setPoolStock] = useState(coupon?.stock ?? 0);
  const [queuedCodes, setQueuedCodes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Pooled: each buyer receives their own code from the pool, so there is no shared code or typed stock.
  const pooled = isPaid && uniqueCodes;
  // Otherwise paid coupons always need a code: it is what the buyer receives after paying.
  const needsCode = !pooled && (type === 'Coupon Code' || isPaid);
  // The pool can be managed live once the server knows the coupon uses one; until then codes are queued.
  const poolIsLive = isEdit && coupon.unique_codes && pooled;
  const clearError = (field: string) => { if (errors[field]) setErrors(p => ({ ...p, [field]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Offer name is required';
    if (!storeId) e.store_id = 'Store is required';
    if (needsCode && !code.trim()) e.code = isPaid ? 'A paid coupon needs a code: it is what the buyer receives' : 'Coupon code is required';
    if (isPaid && toCents(price) < 50) e.price_cents = 'A paid coupon must cost at least 0.50';
    if (!pooled && limitStock && (stock === '' || Number(stock) < 0 || !Number.isInteger(Number(stock)))) e.stock = 'Enter a whole number of 0 or more';
    if (startsAt && expiresAt && expiresAt <= startsAt) e.expires_at = 'The deal must end after it starts';
    if (usageLimit !== '' && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) < 1)) e.usage_limit = 'Enter a whole number of 1 or more, or leave it empty for unlimited';
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
      usage_limit: usageLimit === '' ? null : Number(usageLimit),
      status: publish ? 'Active' : 'Draft',
      is_featured: featured,
      is_verified: verified,
      is_exclusive: exclusive,
      price_cents: isPaid ? toCents(price) : 0,
      stock: isPaid && limitStock && !pooled ? Number(stock) : null,
      unique_codes: pooled,
    };

    let savedId: number | null = null;
    try {
      if (isEdit) await api.patch(`/admin/coupons/${coupon.id}`, payload);
      else savedId = (await api.post<{ data: Coupon }>('/admin/coupons', payload)).data.id;
      savedId ??= coupon?.id ?? null;
      let message = isEdit ? 'Coupon updated successfully' : publish ? 'Coupon published successfully' : 'Coupon saved as draft';
      const codes = pooled && !poolIsLive ? parseCodes(queuedCodes) : [];
      if (codes.length && savedId !== null) message += `. ${describeAdd(await addCodes(savedId, codes))}`;
      showToast('success', message);
      navigate('/coupons');
    } catch (err) {
      if (savedId !== null && !isEdit) {
        // The coupon exists; only its codes failed. Continue on its edit page so nothing is created twice.
        showToast('error', `Coupon saved, but the codes weren't added: ${(err as Error).message}`);
        navigate(`/coupons/${savedId}/edit`);
        return;
      }
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
          {needsCode && (
            <div className="sm:col-span-2">
              <Input label="Coupon Code" placeholder="e.g. SAVE20FALL" value={code} required helperText="Exact code users will enter at checkout"
                onChange={v => { setCode(v); clearError('code'); }} />
              <FieldError message={errors.code} />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 mb-1 pb-3 border-b border-slate-100">Pricing</h2>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Paid coupon</p>
            <p className="text-xs text-slate-400">Customers pay by card to reveal the code. Free coupons show their code publicly.</p>
          </div>
          <Toggle checked={isPaid} ariaLabel="Paid coupon" onChange={v => { setIsPaid(v); clearError('price_cents'); }} />
        </div>
        {isPaid && shopOff && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Selling exclusive codes is switched off, so this coupon is hidden on the website.
            Turn it on in <Link to="/settings/general" className="font-semibold underline">Settings → General</Link>, or make the coupon free.
          </p>
        )}
        {isPaid && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <Input label="Price (USD)" type="number" placeholder="2.99" value={price} required helperText="Minimum 0.50"
                onChange={v => { setPrice(v); clearError('price_cents'); }} />
              <FieldError message={errors.price_cents} />
            </div>
            <div className="sm:col-span-2 sm:row-start-2">
              <p className="text-sm font-medium text-slate-700 mb-2">Code delivery</p>
              <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="Code delivery">
                {[
                  { value: false, label: 'Same code for every buyer', hint: 'One code, sold as many times as stock allows' },
                  { value: true, label: 'Unique code per buyer', hint: 'Each buyer gets their own code from a pool you upload' },
                ].map(o => (
                  <button key={String(o.value)} type="button" role="radio" aria-checked={uniqueCodes === o.value}
                    onClick={() => { setUniqueCodes(o.value); clearError('unique_codes'); clearError('code'); }}
                    className={`flex-1 min-w-48 px-3 py-2.5 rounded-lg border text-left transition-colors ${uniqueCodes === o.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className={`block text-sm font-medium ${uniqueCodes === o.value ? 'text-blue-700' : 'text-slate-700'}`}>{o.label}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{o.hint}</span>
                  </button>
                ))}
              </div>
              <FieldError message={errors.unique_codes} />
            </div>
            {pooled ? (
              <div className="sm:row-start-1 sm:col-start-2">
                <p className="text-sm font-medium text-slate-700 mb-1">Available to buy</p>
                <p className="text-2xl font-semibold text-slate-800">{number(poolIsLive ? poolStock : parseCodes(queuedCodes).length)}</p>
                <p className="text-xs text-slate-400">
                  {poolIsLive
                    ? `Unsold codes${coupon?.reserved_stock ? `, not counting ${coupon.reserved_stock} held by unpaid checkouts` : ''}. Sold out when this reaches 0.`
                    : 'Codes you add below. Sold out when every code is sold.'}
                </p>
              </div>
            ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-700">Limit quantity</p>
                <Toggle checked={limitStock} ariaLabel="Limit quantity" onChange={v => { setLimitStock(v); clearError('stock'); }} />
              </div>
              {limitStock
                ? <Input type="number" placeholder="e.g. 50" value={stock} helperText={coupon?.reserved_stock ? `Units left to sell. ${coupon.reserved_stock} more are held by unpaid checkouts and come back if those aren't paid.` : 'Units left to sell; a unit is held while a shopper is paying'} onChange={v => { setStock(v); clearError('stock'); }} />
                : <p className="text-xs text-slate-400 py-2">Unlimited — can be sold any number of times.</p>}
              <FieldError message={errors.stock} />
            </div>
            )}
          </div>
        )}
      </Card>

      {pooled && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Code pool</h2>
          <p className="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-100">
            {poolIsLive
              ? `${number(coupon?.codes_available ?? 0)} unsold, ${number(coupon?.codes_sold ?? 0)} sold when this page opened. A sold code stays with its buyer, even after a refund.`
              : 'These codes are added when you save. Each is sold once, to one buyer.'}
          </p>
          {poolIsLive
            ? <CodePool couponId={coupon.id} onStock={setPoolStock} />
            : <CodeInput value={queuedCodes} onChange={setQueuedCodes} />}
        </Card>
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
          <div>
            <Input label="Usage limit" type="number" placeholder="Unlimited" value={usageLimit}
              onChange={v => { setUsageLimit(v); clearError('usage_limit'); }}
              helperText="How many times shoppers can use it. Each 'Show coupon code' / 'Get deal' click uses one. Empty = unlimited." />
            <FieldError message={errors.usage_limit} />
          </div>
          {isEdit && (
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
        <h2 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Tracking</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Tracking URL" placeholder="https://track.example.com/amazon?coupon=..." value={trackingUrl}
              onChange={v => { setTrackingUrl(v); clearError('tracking_url'); }} helperText="Leave blank to use the store's default tracking URL" />
            <FieldError message={errors.tracking_url} />
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
