import { useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { Card, Input, Select, Textarea, Toggle, Button, PageHeader } from '../components/ui';
import { FieldError, FormLoadState } from '../components/FormParts';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useApp, useCan } from '../store/AppContext';
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import { ROLE_LABELS } from '../lib/permissions';
import type { HomepageSlide, Settings, StaffRole, User } from '../lib/types';

type Section = 'general' | 'homepage' | 'seo' | 'notifications' | 'security' | 'account';
const SECTIONS: Section[] = ['general', 'homepage', 'seo', 'notifications', 'security', 'account'];

const cardTitle = 'text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100';

/** Saves one settings group and reports field errors back to the form. */
function useSaveGroup<K extends keyof Settings>(group: K) {
  const { showToast } = useApp();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async (values: Partial<Settings[K]>, message: string) => {
    setSaving(true);
    try {
      await api.put(`/admin/settings/${group}`, values);
      setErrors({});
      showToast('success', message);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      showToast('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, errors };
}

function GeneralSettings({ initial }: { initial: Settings['general'] }) {
  const [values, setValues] = useState(initial);
  const { save, saving, errors } = useSaveGroup('general');

  return (
    <Card>
      <h2 className={cardTitle}>General Settings</h2>
      <div className="space-y-4">
        <div>
          <Input label="Website Name" value={values.site_name} onChange={v => setValues(s => ({ ...s, site_name: v }))}
            helperText="Shown in the public site's header, page titles and emails." />
          <FieldError message={errors.site_name} />
        </div>
        <div>
          <Input label="Support Email" type="email" placeholder="support@yourdomain.com" value={values.support_email ?? ''}
            onChange={v => setValues(s => ({ ...s, support_email: v }))} helperText="Shown to shoppers on the Contact page." />
          <FieldError message={errors.support_email} />
        </div>
        <div>
          <Select label="Timezone" options={['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Karachi', 'Asia/Kolkata']}
            value={values.timezone} onChange={v => setValues(s => ({ ...s, timezone: v }))} />
          <p className="text-xs text-slate-400 mt-1">Coupons expire at midnight in this timezone.</p>
          <FieldError message={errors.timezone} />
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setValues(initial)} disabled={saving}>Discard</Button>
        <Button size="sm" onClick={() => save(values, 'Settings saved')} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </Card>
  );
}

function SeoSettings({ initial }: { initial: Settings['seo'] }) {
  const [values, setValues] = useState(initial);
  const { save, saving, errors } = useSaveGroup('seo');

  return (
    <Card>
      <h2 className={cardTitle}>SEO Settings</h2>
      <div className="space-y-4">
        <div>
          <Input label="Default Meta Title" placeholder="Urban Goods Guide — Best Coupons & Deals" value={values.meta_title} onChange={v => setValues(s => ({ ...s, meta_title: v }))} />
          <FieldError message={errors.meta_title} />
        </div>
        <div>
          <Textarea label="Default Meta Description" placeholder="Find the best coupons, promo codes and deals from top stores..." rows={3}
            value={values.meta_description} onChange={v => setValues(s => ({ ...s, meta_description: v }))} />
          <FieldError message={errors.meta_description} />
        </div>
        <Input label="Default Meta Keywords" placeholder="coupons, deals, promo codes, discount codes" value={values.meta_keywords} onChange={v => setValues(s => ({ ...s, meta_keywords: v }))} />
      </div>
      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
        <Button size="sm" onClick={() => save(values, 'SEO settings saved')} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </Card>
  );
}

/** One image slot: preview, upload / replace, remove. Uploads right away; the path is kept when the form is saved. */
function ImagePicker({ label, path, url, onChange, hint, error }: {
  label: string; path: string | null; url: string | undefined; hint: string; error?: string;
  onChange: (path: string | null, url?: string) => void;
}) {
  const { showToast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set('image', file);
      const res = await api.upload<{ data: { path: string; url: string } }>('/admin/settings/homepage/images', form);
      onChange(res.data.path, res.data.url);
    } catch (err) {
      const message = err instanceof ApiError && err.status === 422 ? (err.fieldErrors().image ?? err.message) : (err as Error).message;
      showToast('error', message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
      <div className="flex items-center gap-4">
        <div className="w-40 h-24 shrink-0 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
          {path && url
            ? <img src={url} alt="" className="w-full h-full object-cover" />
            : <ImageIcon size={22} className="text-slate-300" aria-hidden="true" />}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => pick(e.target.files?.[0])} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
              <Upload size={14} /> {uploading ? 'Uploading…' : path ? 'Replace' : 'Upload image'}
            </Button>
            {path && <Button variant="ghost" size="sm" onClick={() => onChange(null)} disabled={uploading}>Remove</Button>}
          </div>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
      </div>
      <FieldError message={error} />
    </div>
  );
}

const MAX_SLIDES = 3;
const emptySlide = (): HomepageSlide => ({ image: '', title: '', subtitle: null, button_text: null, link: null });

function HomepageSettings({ initial, imageUrls }: { initial: Settings['homepage']; imageUrls: Record<string, string> }) {
  const [values, setValues] = useState(initial);
  const [urls, setUrls] = useState(imageUrls);
  const { save, saving, errors } = useSaveGroup('homepage');

  const remember = (path: string | null, url?: string) => { if (path && url) setUrls(u => ({ ...u, [path]: url })); };
  const setSlide = (i: number, patch: Partial<HomepageSlide>) =>
    setValues(s => ({ ...s, slides: s.slides.map((slide, j) => (j === i ? { ...slide, ...patch } : slide)) }));
  const moveSlide = (i: number, by: -1 | 1) => setValues(s => {
    const slides = [...s.slides];
    [slides[i], slides[i + by]] = [slides[i + by], slides[i]];
    return { ...s, slides };
  });

  const incomplete = values.slides.some(s => !s.image || !s.title.trim());

  return (
    <div className="space-y-5">
      <Card>
        <h2 className={cardTitle}>Hero Text</h2>
        <div className="space-y-4">
          <div>
            <Textarea label="Headline" rows={2} value={values.headline} onChange={v => setValues(s => ({ ...s, headline: v }))} />
            <p className="text-xs text-slate-400 mt-1">The big line at the top of the home page. Up to 140 characters.</p>
            <FieldError message={errors.headline} />
          </div>
          <div>
            <Textarea label="Sub-text" rows={2} value={values.subtext ?? ''} onChange={v => setValues(s => ({ ...s, subtext: v }))} />
            <FieldError message={errors.subtext} />
          </div>
          <div>
            <Input label="Search Box Placeholder" value={values.search_placeholder} onChange={v => setValues(s => ({ ...s, search_placeholder: v }))} />
            <FieldError message={errors.search_placeholder} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className={cardTitle}>Background Image</h2>
        <ImagePicker label="Hero background" path={values.hero_image} url={values.hero_image ? urls[values.hero_image] : undefined}
          hint="Wide photo, at least 1600 × 900. JPG, PNG or WebP up to 4 MB. A dark overlay keeps the text readable."
          error={errors.hero_image}
          onChange={(path, url) => { remember(path, url); setValues(s => ({ ...s, hero_image: path })); }} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Banner Slides</h2>
          <span className="text-xs text-slate-400">{values.slides.length} of {MAX_SLIDES}</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Shown beside the headline and rotated every few seconds. With no slides, the home page shows featured coupons instead.
        </p>
        <div className="space-y-4">
          {values.slides.map((slide, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Slide {i + 1}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => moveSlide(i, -1)} disabled={i === 0}><ArrowUp size={14} /><span className="sr-only">Move up</span></Button>
                  <Button variant="ghost" size="sm" onClick={() => moveSlide(i, 1)} disabled={i === values.slides.length - 1}><ArrowDown size={14} /><span className="sr-only">Move down</span></Button>
                  <Button variant="ghost" size="sm" onClick={() => setValues(s => ({ ...s, slides: s.slides.filter((_, j) => j !== i) }))}><Trash2 size={14} /><span className="sr-only">Remove slide</span></Button>
                </div>
              </div>
              <ImagePicker label="Slide image" path={slide.image || null} url={slide.image ? urls[slide.image] : undefined}
                hint="Landscape, about 1200 × 800. JPG, PNG or WebP up to 4 MB." error={errors[`slides.${i}.image`]}
                onChange={(path, url) => { remember(path, url); setSlide(i, { image: path ?? '' }); }} />
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Input label="Title" required value={slide.title} onChange={v => setSlide(i, { title: v })} /><FieldError message={errors[`slides.${i}.title`]} /></div>
                <div><Input label="Sub-title" value={slide.subtitle ?? ''} onChange={v => setSlide(i, { subtitle: v })} /><FieldError message={errors[`slides.${i}.subtitle`]} /></div>
                <div><Input label="Button Text" placeholder="Shop now" value={slide.button_text ?? ''} onChange={v => setSlide(i, { button_text: v })} /><FieldError message={errors[`slides.${i}.button_text`]} /></div>
                <div>
                  <Input label="Button Link" placeholder="/stores/nike or https://…" value={slide.link ?? ''} onChange={v => setSlide(i, { link: v })} />
                  <FieldError message={errors[`slides.${i}.link`]} />
                </div>
              </div>
            </div>
          ))}
          {values.slides.length < MAX_SLIDES && (
            <Button variant="outline" size="sm" onClick={() => setValues(s => ({ ...s, slides: [...s.slides, emptySlide()] }))}>
              <Plus size={14} /> Add slide
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {incomplete && <p className="text-xs text-amber-600">Each slide needs an image and a title.</p>}
        <Button variant="outline" size="sm" onClick={() => setValues(initial)} disabled={saving}>Discard</Button>
        <Button size="sm" onClick={() => save(values, 'Homepage saved')} disabled={saving || incomplete}>{saving ? 'Saving…' : 'Save Homepage'}</Button>
      </div>
    </div>
  );
}

function NotificationSettings({ initial }: { initial: Settings['notifications'] }) {
  const [values, setValues] = useState(initial);
  const { save, saving } = useSaveGroup('notifications');

  const rows: { key: keyof Settings['notifications']; label: string; desc: string }[] = [
    { key: 'email', label: 'Email Notifications', desc: 'Email admins about important alerts. Turning this off stops all admin emails.' },
    { key: 'redemption_alerts', label: 'Coupon Usage Alerts', desc: 'Email admins and editors when a coupon reaches 80% of its usage limit and when it is used up.' },
    { key: 'sync_alerts', label: 'Brand Feed Alerts', desc: 'Email admins and editors when a brand feed import fails or skips bad rows.' },
  ];

  return (
    <Card>
      <h2 className={cardTitle}>Notification Preferences</h2>
      <div className="space-y-3">
        {rows.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{desc}</p></div>
            <Toggle checked={values[key]} onChange={v => setValues(s => ({ ...s, [key]: v }))} ariaLabel={label} />
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
        <Button size="sm" onClick={() => save(values, 'Preferences saved')} disabled={saving}>{saving ? 'Saving…' : 'Save Preferences'}</Button>
      </div>
    </Card>
  );
}

function SecuritySettings({ initial }: { initial: Settings['security'] }) {
  const [values, setValues] = useState(initial);
  const { save, saving } = useSaveGroup('security');

  return (
    <Card>
      <h2 className={cardTitle}>Security</h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Require Two-Step Login</p>
          <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
            Every staff account must sign in with a password and a code from an authenticator app. Anyone without it is asked
            to set it up before they can use the admin. Set yours up first in My Account.
          </p>
        </div>
        <Toggle checked={values.require_two_factor} onChange={v => setValues({ require_two_factor: v })} ariaLabel="Require two-step login" />
      </div>
      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
        <Button size="sm" onClick={() => save(values, 'Security settings saved')} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </Card>
  );
}

function AccountSettings() {
  const { user, setUser, showToast } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profilePassword, setProfilePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const emailChanged = email.trim() !== user.email;

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await api.put<{ data: User }>('/auth/profile', {
        name,
        ...(emailChanged ? { email: email.trim(), current_password: profilePassword } : {}),
      });
      setUser(res.data);
      setProfilePassword('');
      setProfileErrors({});
      showToast('success', 'Profile updated');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setProfileErrors(err.fieldErrors());
      showToast('error', (err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) { setPasswordErrors({ password: 'Passwords do not match' }); return; }
    setSavingPassword(true);
    try {
      await api.put('/auth/profile', { current_password: currentPassword, password: newPassword, password_confirmation: confirmPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordErrors({});
      showToast('success', 'Password updated');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setPasswordErrors(err.fieldErrors());
      showToast('error', (err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <h2 className={cardTitle}>Profile</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">{user.name.charAt(0).toUpperCase()}</div>
          <div><p className="text-sm font-semibold text-slate-800">{user.name}</p><p className="text-xs text-slate-400">{ROLE_LABELS[user.role as StaffRole]?.label ?? user.role}</p></div>
        </div>
        <div className="space-y-4">
          <div><Input label="Full Name" value={name} onChange={setName} /><FieldError message={profileErrors.name} /></div>
          <div><Input label="Email" type="email" value={email} onChange={setEmail} /><FieldError message={profileErrors.email} /></div>
          {emailChanged && (
            <div>
              <Input label="Current Password" type="password" value={profilePassword} onChange={setProfilePassword} helperText="Required to change your email address" />
              <FieldError message={profileErrors.current_password} />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={saveProfile} disabled={savingProfile || !name.trim()}>{savingProfile ? 'Updating…' : 'Update Profile'}</Button>
        </div>
      </Card>

      <Card>
        <h2 className={cardTitle}>Two-Step Login</h2>
        <TwoFactorSetup onEnabled={() => setUser({ ...user, two_factor: true })} />
      </Card>

      <Card>
        <h2 className={cardTitle}>Change Password</h2>
        <div className="space-y-4">
          <div><Input label="Current Password" type="password" value={currentPassword} onChange={setCurrentPassword} /><FieldError message={passwordErrors.current_password} /></div>
          <div><Input label="New Password" type="password" value={newPassword} onChange={setNewPassword} helperText="At least 8 characters" /><FieldError message={passwordErrors.password} /></div>
          <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={savePassword} disabled={savingPassword || !currentPassword || !newPassword}>{savingPassword ? 'Updating…' : 'Update Password'}</Button>
        </div>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { section } = useParams();
  const isAdmin = useCan('admin');
  const isSettingsGroup = section !== 'account';
  const { data, loading, error, reload } = useApi<{ data: Settings; meta?: { homepage_image_urls?: Record<string, string> } }>(isSettingsGroup && isAdmin ? '/admin/settings' : null);

  // Everyone has My Account; the site-wide groups are for admins.
  if (!SECTIONS.includes(section as Section) || (isSettingsGroup && !isAdmin)) return <Navigate to="/settings/account" replace />;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" />
      {section === 'account' && <AccountSettings />}
      {isSettingsGroup && !data && <FormLoadState loading={loading} error={error} onRetry={reload} />}
      {data && section === 'general' && <GeneralSettings initial={data.data.general} />}
      {data && section === 'homepage' && <HomepageSettings initial={data.data.homepage} imageUrls={data.meta?.homepage_image_urls ?? {}} />}
      {data && section === 'seo' && <SeoSettings initial={data.data.seo} />}
      {data && section === 'notifications' && <NotificationSettings initial={data.data.notifications} />}
      {data && section === 'security' && <SecuritySettings initial={data.data.security} />}
    </div>
  );
}
