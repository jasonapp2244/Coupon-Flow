import { useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { Card, Button, PageHeader } from '../components/ui';
import { ConfirmModal } from '../components/Modal';
import { TableBodyState } from '../components/DataTable';
import { api } from '../lib/api';
import { useAction, useApi } from '../lib/hooks';
import { dateTime } from '../lib/format';
import { useApp, useCan } from '../store/AppContext';
import type { TrashItem, TrashType } from '../lib/types';

const tabs: { key: TrashType; label: string; restoresAs: string }[] = [
  { key: 'store', label: 'Stores', restoresAs: 'Inactive' },
  { key: 'coupon', label: 'Coupons', restoresAs: 'Draft' },
  { key: 'blog', label: 'Blogs', restoresAs: 'Draft' },
];

export default function TrashPage() {
  const { run, busy } = useAction();
  const { showToast } = useApp();
  const canWrite = useCan('write');
  const isAdmin = useCan('admin');
  const [activeTab, setActiveTab] = useState<TrashType>('store');
  const [purgeItem, setPurgeItem] = useState<TrashItem | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const { data, loading, error, reload } = useApi<{ data: TrashItem[] }>('/admin/trash');
  const all = data?.data ?? [];
  const items = all.filter(t => t.type === activeTab);
  const tab = tabs.find(t => t.key === activeTab)!;
  const count = (type: TrashType) => all.filter(t => t.type === type).length;

  const handleRestore = async (item: TrashItem) => {
    if (await run(() => api.post(`/admin/trash/${item.type}/${item.id}/restore`), `"${item.name}" restored as ${tab.restoresAs}`)) reload();
  };

  const handlePurge = async () => {
    if (!purgeItem) return;
    const item = purgeItem;
    setPurgeItem(null);
    if (await run(() => api.delete(`/admin/trash/${item.type}/${item.id}`), `"${item.name}" permanently deleted`)) reload();
  };

  const handleEmpty = async () => {
    setConfirmEmpty(false);
    try {
      // The API's message says how many items it kept (sold coupons are never purged).
      const res = await api.delete<{ message: string; kept: number }>(`/admin/trash?type=${activeTab}`);
      showToast(res.kept > 0 ? 'warning' : 'success', res.message);
      reload();
    } catch (e) {
      showToast('error', (e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trash"
        subtitle="Deleted items — restore or permanently remove them"
        actions={isAdmin && items.length > 0 ? (
          <Button variant="danger" size="sm" onClick={() => setConfirmEmpty(true)} disabled={busy}>
            <Trash2 size={13} /> Empty {tab.label} Trash
          </Button>
        ) : undefined}
      />

      <Card padding={false}>
        <div className="flex border-b border-slate-100">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              <span className="ml-1.5 bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded-full">{count(t.key)}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {['Item', 'Deleted', 'Status before deletion', 'Actions'].map(h => <th key={h} className="px-5 py-3 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={4} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<Trash2 size={22} />} emptyTitle={`No ${tab.label.toLowerCase()} in trash`} emptyText="Deleted items will appear here." onRetry={reload}
              />
              {!error && items.map(item => (
                <tr key={`${item.type}-${item.id}`} className="border-b border-slate-50 hover:bg-slate-50 last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-slate-200 rounded-lg flex items-center justify-center"><Trash2 size={13} className="text-slate-400" /></div>
                      <span className="font-medium text-slate-700 max-w-xs truncate">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{dateTime(item.deleted_at)}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{item.original_status}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {canWrite && (
                        <button onClick={() => handleRestore(item)} disabled={busy} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium disabled:opacity-50">
                          <RotateCcw size={11} /> Restore
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setPurgeItem(item)} disabled={busy} className="flex items-center gap-1 text-xs text-red-600 hover:underline font-medium disabled:opacity-50">
                          <Trash2 size={11} /> Delete Permanently
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length > 0 && (
          <p className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Restored {tab.label.toLowerCase()} come back as <strong>{tab.restoresAs}</strong> so nothing reappears on the public site unreviewed.
          </p>
        )}
      </Card>

      <ConfirmModal
        open={purgeItem !== null}
        onClose={() => setPurgeItem(null)}
        onConfirm={handlePurge}
        title="Delete Permanently?"
        message={`"${purgeItem?.name}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete Permanently"
      />
      <ConfirmModal
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={handleEmpty}
        title={`Empty ${tab.label} Trash?`}
        message="All items in this section will be permanently deleted. Coupons that have been sold are kept to preserve order history."
        confirmLabel="Empty Trash"
      />
    </div>
  );
}
