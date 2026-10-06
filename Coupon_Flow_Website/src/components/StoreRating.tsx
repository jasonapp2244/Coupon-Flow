import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../store/toast';
import type { StoreRatingSummary } from '../lib/types';

const votedKey = (slug: string) => `cf_rated_${slug}`;

function readVote(slug: string): number | null {
  try {
    const n = Number(localStorage.getItem(votedKey(slug)));
    return n >= 1 && n <= 5 ? n : null;
  } catch {
    return null;
  }
}

/** Five stars filled to `value` (fractions allowed), for the read-only average. */
function Stars({ value, size = 20 }: { value: number; size?: number }) {
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <span className="flex text-line">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}</span>
      <span className="absolute inset-0 flex overflow-hidden text-marigold" style={{ width: `${(value / 5) * 100}%` }}>
        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} fill="currentColor" strokeWidth={0} className="shrink-0" />)}
      </span>
    </span>
  );
}

/**
 * "Rate {store}" box from the reference coupon sites: five clickable stars, then the average and
 * vote count. No sign-in; the API keeps one vote per visitor, and voting again changes it.
 */
export default function StoreRating({ slug, name, initial }: { slug: string; name: string; initial?: StoreRatingSummary }) {
  const toast = useToast();
  const [summary, setSummary] = useState<StoreRatingSummary>(initial ?? { average: null, count: 0 });
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);

  // The page refetches after a pre-rendered snapshot, and the visitor's own vote lives in the browser only.
  useEffect(() => { if (initial) setSummary(initial); }, [initial?.average, initial?.count]);
  useEffect(() => { setMine(readVote(slug)); }, [slug]);

  const rate = async (rating: number) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.post<{ rating: number; average: number; count: number }>(`/public/stores/${encodeURIComponent(slug)}/rating`, { rating });
      setSummary({ average: res.average, count: res.count });
      setMine(res.rating);
      try { localStorage.setItem(votedKey(slug), String(res.rating)); } catch { /* remembered for this visit only */ }
      toast(mine ? 'Your rating was updated. Thanks!' : 'Thanks for rating!');
    } catch (e) {
      toast(e instanceof ApiError && e.status === 429 ? 'Too many ratings at once. Try again in a minute.' : "Couldn't save your rating. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const shown = hover || mine || 0;

  return (
    <div className="rounded-xl bg-card p-5 text-center ring-1 ring-line">
      <h2 id="rate-heading" className="font-semibold">Rate {name}</h2>
      <div role="group" aria-labelledby="rate-heading" className="mt-3 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            aria-pressed={mine === i}
            aria-label={`Rate ${i} out of 5`}
            disabled={saving}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            onClick={() => rate(i)}
            className={`rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-wait ${i <= shown ? 'text-ink' : 'text-line'}`}
          >
            <Star size={26} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      {mine && <p className="mt-1 text-xs text-muted">You rated {mine} of 5</p>}

      {summary.count > 0 && summary.average !== null ? (
        <div className="mt-3">
          <p className="text-sm text-ink-soft">Average rating: {summary.average} of 5</p>
          <p className="mt-1 flex items-center justify-center gap-2">
            <Stars value={summary.average} />
            <span className="text-sm text-muted">({summary.count} {summary.count === 1 ? 'vote' : 'votes'})</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No ratings yet. Be the first.</p>
      )}
    </div>
  );
}
