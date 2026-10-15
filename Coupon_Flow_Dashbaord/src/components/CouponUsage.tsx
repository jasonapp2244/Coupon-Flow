import { Badge } from './ui';
import { number } from '../lib/format';
import type { CouponState } from '../lib/types';

const STATE: Record<CouponState | 'deleted', { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'; hint: string }> = {
  live: { label: 'Live', variant: 'success', hint: 'Shown on the website now.' },
  scheduled: { label: 'Scheduled', variant: 'info', hint: 'Its deal window has not started yet.' },
  ended: { label: 'Ended', variant: 'neutral', hint: 'Its deal window is over.' },
  used_up: { label: 'Used up', variant: 'danger', hint: 'Every allowed use is taken.' },
  draft: { label: 'Draft', variant: 'neutral', hint: 'Not published.' },
  inactive: { label: 'Inactive', variant: 'neutral', hint: 'Switched off.' },
  deleted: { label: 'Deleted', variant: 'neutral', hint: 'In the trash.' },
};

/** Where a coupon is in its life: live, scheduled, ended, used up, draft or inactive. */
export function StateBadge({ state }: { state: CouponState | 'deleted' | null | undefined }) {
  if (!state) return null;
  const s = STATE[state];
  return <span title={s.hint}><Badge variant={s.variant}>{s.label}</Badge></span>;
}

/** Bar fill colour: amber from 80% used, red when everything is taken. */
const barColor = (percent: number) => (percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-blue-500');

/** Code-list coupon: "12 codes left" over a bar of the share already given out. */
export function CodesLeftBar({ left, total, compact = false }: { left: number; total: number; compact?: boolean }) {
  const used = Math.max(0, total - left);
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 1000) / 10) : 0;
  if (total === 0) return <span className="text-xs font-medium text-amber-700 whitespace-nowrap">No codes yet</span>;

  return (
    <div className={compact ? 'min-w-28' : 'min-w-36'} title={`${number(used)} of ${number(total)} codes given out, ${number(left)} left`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`font-medium whitespace-nowrap ${left === 0 ? 'text-red-600' : 'text-slate-700'}`}>{number(left)} {left === 1 ? 'code' : 'codes'} left</span>
        {!compact && <span className="text-slate-400 whitespace-nowrap">of {number(total)}</span>}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Share of codes given out">
        <div className={`h-full rounded-full ${barColor(percent)}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * "125 / 500 · 25%" with a bar; "125 uses · no limit" when unlimited. The bar turns amber at
 * 80% and red when used up, matching the alerts staff get.
 */
export function UsageBar({ uses, limit, percent, compact = false }: { uses: number; limit: number | null; percent: number | null; compact?: boolean }) {
  if (limit === null || percent === null) {
    return <span className="text-xs text-slate-500 whitespace-nowrap">{number(uses)} {uses === 1 ? 'use' : 'uses'}{!compact && ' · no limit'}</span>;
  }

  const color = barColor(percent);
  return (
    <div className={compact ? 'min-w-28' : 'min-w-36'} title={`${number(uses)} of ${number(limit)} uses taken, ${number(Math.max(0, limit - uses))} left`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-700 font-medium whitespace-nowrap">{number(uses)} / {number(limit)}</span>
        <span className={`whitespace-nowrap ${percent >= 80 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{percent}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Share of uses taken">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}
