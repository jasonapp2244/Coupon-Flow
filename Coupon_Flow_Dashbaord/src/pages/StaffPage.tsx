import { useState } from 'react';
import { Mail, Plus, ShieldCheck, ShieldOff, UserCheck, UserX, Users } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui';
import { ConfirmModal, Modal } from '../components/Modal';
import { RowMenu, RowMenuItem, TableBodyState } from '../components/DataTable';
import { FieldError } from '../components/FormParts';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime } from '../lib/format';
import { allows, ROLE_LABELS } from '../lib/permissions';
import { useApp } from '../store/AppContext';
import type { StaffMember, StaffRole } from '../lib/types';

const ROLES = Object.keys(ROLE_LABELS) as StaffRole[];

const ROLE_BADGE: Record<StaffRole, 'purple' | 'info' | 'neutral'> = { super_admin: 'purple', admin: 'info', editor: 'neutral', viewer: 'neutral' };

function RolePicker({ value, onChange }: { value: StaffRole; onChange: (role: StaffRole) => void }) {
  // Only a super admin may hand out the super admin role (the API enforces the same rule).
  const owner = allows(useApp().user.role, 'owner');
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700 mb-1.5">Role</legend>
      {ROLES.filter(role => owner || role !== 'super_admin').map(role => (
        <label key={role} className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${value === role ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
          <input type="radio" name="staff-role" value={role} checked={value === role} onChange={() => onChange(role)} className="mt-0.5 accent-blue-600" />
          <span>
            <span className="block text-sm font-medium text-slate-800">{ROLE_LABELS[role].label}</span>
            <span className="block text-xs text-slate-500">{ROLE_LABELS[role].description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function AddStaff({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('editor');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ invite_sent: boolean }>('/admin/staff', { name, email, role });
      showToast(res.invite_sent ? 'success' : 'warning', res.invite_sent
        ? `${name} was added. They'll get an email to set their password.`
        : `${name} was added, but the email couldn't be sent. Use "Send set-password link" in a minute.`);
      onAdded();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else showToast('error', (err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add staff member"
      footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || !name.trim() || !email.trim()}>{saving ? 'Adding…' : 'Add and email link'}</Button></>}>
      <div className="space-y-4">
        <div><Input label="Name" value={name} onChange={v => { setName(v); setErrors(e => ({ ...e, name: '' })); }} required /><FieldError message={errors.name} /></div>
        <div><Input label="Email" type="email" value={email} onChange={v => { setEmail(v); setErrors(e => ({ ...e, email: '' })); }} required /><FieldError message={errors.email} /></div>
        <RolePicker value={role} onChange={setRole} />
        <p className="text-xs text-slate-400">They choose their own password from the emailed link. Nobody else ever sees it.</p>
      </div>
    </Modal>
  );
}

type Pending = { member: StaffMember; action: 'disable' | 'enable' | 'reset2fa' | 'invite' };

export default function StaffPage() {
  const { user, showToast } = useApp();
  const { data, loading, error, reload } = useApi<{ data: StaffMember[] }>('/admin/staff');
  const [adding, setAdding] = useState(false);
  const [roleFor, setRoleFor] = useState<StaffMember | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>('editor');
  const [pending, setPending] = useState<Pending | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const staff = data?.data ?? [];

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); showToast('success', message); reload(); }
    catch (err) { showToast('error', (err as Error).message); }
    finally { setBusy(false); setPending(null); setRoleFor(null); }
  };

  const confirm = () => {
    if (!pending) return;
    const { member, action } = pending;
    if (action === 'disable') run(() => api.patch(`/admin/staff/${member.id}`, { disabled: true }), `${member.name} can no longer sign in`);
    if (action === 'enable') run(() => api.patch(`/admin/staff/${member.id}`, { disabled: false }), `${member.name} can sign in again`);
    if (action === 'reset2fa') run(() => api.delete(`/admin/staff/${member.id}/two-factor`), `Two-step login reset for ${member.name}`);
    if (action === 'invite') run(() => api.post(`/admin/staff/${member.id}/invite`), `Set-password link sent to ${member.email}`);
  };

  const messages: Record<Pending['action'], (m: StaffMember) => [string, string, string]> = {
    disable: m => ['Switch off this account?', `${m.name} is signed out everywhere and can't sign in until you switch the account back on.`, 'Switch off'],
    enable: m => ['Switch this account back on?', `${m.name} can sign in again with their password.`, 'Switch on'],
    reset2fa: m => ['Reset two-step login?', `For a lost phone: ${m.name}'s two-step login is turned off and they are signed out. They can set it up again after signing in.`, 'Reset'],
    invite: m => ['Send a set-password link?', `${m.email} gets an email to choose a new password. Their current password keeps working until they do.`, 'Send link'],
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title="Staff" subtitle="Who can sign in to the admin and what they can do"
        actions={<Button size="sm" onClick={() => setAdding(true)}><Plus size={13} /> Add staff member</Button>} />

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {['Name', 'Role', 'Two-step login', 'Last sign-in', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <TableBodyState colSpan={6} loading={loading} error={error} empty={staff.length === 0} emptyIcon={<Users size={22} />} emptyTitle="No staff yet" onRetry={reload} />
              {!error && staff.map(m => (
                <tr key={m.id} className={`border-b border-slate-50 ${m.disabled ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">{m.name}{m.id === user.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}</div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </td>
                  <td className="px-4 py-3.5"><Badge variant={ROLE_BADGE[m.role]}>{ROLE_LABELS[m.role].label}</Badge></td>
                  <td className="px-4 py-3.5">
                    {m.two_factor
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck size={13} /> On</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><ShieldOff size={13} /> Off</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{m.last_login_at ? dateTime(m.last_login_at) : 'Never'}</td>
                  <td className="px-4 py-3.5">{m.disabled ? <Badge variant="danger">Switched off</Badge> : <Badge variant="success">Active</Badge>}</td>
                  <td className="px-4 py-3.5 text-right">
                    {(m.role !== 'super_admin' || allows(user.role, 'owner')) && <RowMenu open={openMenu === m.id} onToggle={() => setOpenMenu(openMenu === m.id ? null : m.id)} width="w-56">
                      <RowMenuItem icon={<Users size={13} />} onClick={() => { setRoleFor(m); setNewRole(m.role); setOpenMenu(null); }}>Change role</RowMenuItem>
                      {!m.disabled && <RowMenuItem icon={<Mail size={13} />} onClick={() => { setPending({ member: m, action: 'invite' }); setOpenMenu(null); }}>Send set-password link</RowMenuItem>}
                      {m.two_factor && <RowMenuItem icon={<ShieldOff size={13} />} onClick={() => { setPending({ member: m, action: 'reset2fa' }); setOpenMenu(null); }}>Reset two-step login</RowMenuItem>}
                      {m.id !== user.id && (
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          {m.disabled
                            ? <RowMenuItem icon={<UserCheck size={13} />} onClick={() => { setPending({ member: m, action: 'enable' }); setOpenMenu(null); }}>Switch on</RowMenuItem>
                            : <RowMenuItem danger icon={<UserX size={13} />} onClick={() => { setPending({ member: m, action: 'disable' }); setOpenMenu(null); }}>Switch off</RowMenuItem>}
                        </div>
                      )}
                    </RowMenu>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <AddStaff onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload(); }} />}

      <Modal open={roleFor !== null} onClose={() => setRoleFor(null)} title={`Role for ${roleFor?.name ?? ''}`}
        footer={<><Button variant="ghost" onClick={() => setRoleFor(null)} disabled={busy}>Cancel</Button>
          <Button onClick={() => roleFor && run(() => api.patch(`/admin/staff/${roleFor.id}`, { role: newRole }), `${roleFor.name} is now ${ROLE_LABELS[newRole].label}`)} disabled={busy || newRole === roleFor?.role}>Save role</Button></>}>
        <RolePicker value={newRole} onChange={setNewRole} />
      </Modal>

      {pending && (() => {
        const [title, message, label] = messages[pending.action](pending.member);
        return <ConfirmModal open onClose={() => setPending(null)} onConfirm={confirm} loading={busy} title={title} message={message} confirmLabel={label}
          variant={pending.action === 'disable' || pending.action === 'reset2fa' ? 'danger' : 'primary'} />;
      })()}
    </div>
  );
}
