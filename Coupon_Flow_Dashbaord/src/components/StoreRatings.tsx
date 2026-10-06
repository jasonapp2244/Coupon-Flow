import { useState } from 'react';
import { RotateCcw, Star, Trash2 } from 'lucide-react';
import { Button } from './ui';
import { ConfirmModal } from './Modal';
import { Pagination, TableBodyState, filterSelectClass } from './DataTable';
import { api } from '../lib/api';
import { useApi, useApiList } from '../lib/hooks';
import { dateTime, plural } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { StoreRatingSummary, StoreRatingVote } from '../lib/types';

/** Five small stars filled to `value` (fractions allowed). */
export function RatingStars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="relative inline-flex align-middle" aria-hidden="true">
      <span className="flex text-slate-200">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} className="fill-current" strokeWidth={0} />)}</span>
      <span className="absolute inset-0 flex overflow-hidden text-amber-400" style={{ width: `${(value / 5) * 100}%` }}>
        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} className="fill-current shrink-0" strokeWidth={0} />)}
      </span>
    </span>
  );
}

/** "4.5 ★★★★½ (12)" for tables; a dash when nobody has voted. */
export function RatingCell({ rating }: { rating?: { average: number | null; count: number } }) {
  if (!rating || rating.average === null) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`${rating.average} of 5 from ${plural(rating.count, 'vote')}`}>
      <span className="font-medium text-slate-800">{rating.average}</span>
      <RatingStars value={rating.average} />
      <span className="text-xs text-slate-400">({rating.count})</span>
    </span>
  );
}

/**
 * Visitor ratings of one store: average, how the votes split per star, every vote (signed-in
 * shoppers by name, guests as "Guest"), remove a single vote, or reset the store's rating.
 */
export function StoreRatings({ storeId, storeName }: { storeId: number; storeName: string }) {
  const { showToast } = useApp();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<StoreRatingVote | null>(null);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);

  const summary = useApi<StoreRatingSummary>(`/admin/stores/${storeId}/ratings/summary`);
  const votes = useApiList<StoreRatingVote>(`/admin/stores/${storeId}/ratings`, { rating: filter, page, per_page: 10 });
  const s = summary.data;

  const refresh = () => { summary.reload(); votes.reload(); };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      showToast('success', message);
      refresh();
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setBusy(false);
      setRemoving(null);
      setResetting(false);
    }
  };

  const pickStar = (star: string) => { setFilter(filter === star ? '' : star); setPage(1); };

  if (summary.error) {
    return (
      <p className="text-sm text-red-600">
        Couldn't load ratings: {summary.error} <button onClick={summary.reload} className="underline">Retry</button>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-32">
          {s && s.average !== null ? (
            <>
              <p className="text-3xl font-bold text-slate-800">{s.average}<span className="text-base font-medium text-slate-400"> / 5</span></p>
              <RatingStars value={s.average} size={16} />
              <p className="mt-1 text-xs text-slate-500">{plural(s.count, 'vote')}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">{summary.loading ? 'Loading…' : 'No votes yet.'}</p>
          )}
        </div>

        {s && s.count > 0 && (
          <div className="flex-1 min-w-52 space-y-1">
            {['5', '4', '3', '2', '1'].map(star => {
              const n = s.breakdown[star] ?? 0;
              return (
                <button key={star} type="button" onClick={() => pickStar(star)} aria-pressed={filter === star}
                  aria-label={`${star} stars: ${plural(n, 'vote')}. ${filter === star ? 'Show all votes' : `Show only ${star}-star votes`}`}
                  className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-50 ${filter === star ? 'bg-blue-50' : ''}`}>
                  <span className="w-8 text-left text-slate-600">{star} ★</span>
                  <span className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / s.count) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-slate-500">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setResetting(true)} disabled={!s?.count || busy}>
            <RotateCcw size={13} /> Reset rating
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex gap-2 p-3 border-b border-slate-100">
          <select aria-label="Filter votes" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className={filterSelectClass}>
            <option value="">All votes</option>
            {['5', '4', '3', '2', '1'].map(star => <option key={star} value={star}>{star} star{star === '1' ? '' : 's'}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Rating</th>
                <th className="px-4 py-2.5 text-left">Voter</th>
                <th className="px-4 py-2.5 text-left">Voted</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {votes.items.length === 0 || votes.error ? (
                <TableBodyState colSpan={4} loading={votes.loading} error={votes.error} empty={votes.items.length === 0}
                  emptyIcon={<Star size={20} className="text-slate-300" />}
                  emptyTitle={filter ? `No ${filter}-star votes` : 'No votes yet'}
                  emptyText={filter ? 'Try another filter.' : 'Visitors rate the store from its public page.'}
                  onRetry={votes.reload} onClear={filter ? () => setFilter('') : undefined} />
              ) : votes.items.map(vote => (
                <tr key={vote.id}>
                  <td className="px-4 py-2.5"><span className="sr-only">{vote.rating} of 5</span><RatingStars value={vote.rating} /></td>
                  <td className="px-4 py-2.5">
                    {vote.voter
                      ? <><span className="text-slate-700">{vote.voter.name}</span> <span className="text-xs text-slate-400">{vote.voter.email}</span></>
                      : <span className="text-slate-500">Guest</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {vote.updated_at ? dateTime(vote.updated_at) : '—'}
                    {vote.created_at && vote.updated_at && vote.created_at !== vote.updated_at && <span className="text-slate-400"> (changed)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setRemoving(vote)} aria-label={`Remove this ${vote.rating}-star vote`} disabled={busy}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(votes.meta?.total ?? 0) > 0 && <Pagination meta={votes.meta} onPage={setPage} />}
      </div>

      <ConfirmModal open={removing !== null} onClose={() => setRemoving(null)} loading={busy}
        onConfirm={() => removing && run(() => api.delete(`/admin/stores/${storeId}/ratings/${removing.id}`), 'Vote removed')}
        title="Remove vote?" confirmLabel="Remove"
        message={`This ${removing?.rating ?? ''}-star vote${removing?.voter ? ` by ${removing.voter.name}` : ''} will be deleted and the average recalculated. The visitor can vote again.`} />

      <ConfirmModal open={resetting} onClose={() => setResetting(false)} loading={busy}
        onConfirm={() => run(() => api.delete(`/admin/stores/${storeId}/ratings`), `Rating of ${storeName} reset`)}
        title="Reset rating?" confirmLabel="Reset rating"
        message={`All ${plural(s?.count ?? 0, 'vote')} for ${storeName} will be deleted and the store page will show "No ratings yet". This can't be undone.`} />
    </div>
  );
}
