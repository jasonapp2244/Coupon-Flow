import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { storePublicUrl } from '../lib/format';
import { useApp } from '../store/AppContext';

/** Copies a store's public link, reporting the result as a toast. */
export function useCopyStoreLink() {
  const { showToast } = useApp();
  return async (slug: string) => {
    try {
      await navigator.clipboard.writeText(storePublicUrl(slug));
      showToast('success', 'Store link copied');
    } catch {
      showToast('error', "Couldn't copy automatically. Select the link and copy it.");
    }
  };
}

/**
 * The shareable public link for a store, as the slug currently reads. Opening it only works
 * once the store is saved and active; drafts and deactivated stores show "not found".
 */
export function StoreLinkBox({ slug, canOpen }: { slug: string; canOpen: boolean }) {
  const copy = useCopyStoreLink();
  const url = storePublicUrl(slug || '{slug}');

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">Public link</span>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <span className="flex items-center px-3 text-slate-400"><Link2 size={14} aria-hidden="true" /></span>
        <span className="flex-1 truncate py-2 pr-2 font-mono text-xs leading-5 text-slate-700 select-all" title={url}>{url}</span>
        <button type="button" disabled={!slug} onClick={() => copy(slug)}
          className="flex items-center gap-1 border-l border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
          <Copy size={13} aria-hidden="true" /> Copy
        </button>
        {canOpen && (
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 border-l border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-white">
            <ExternalLink size={13} aria-hidden="true" /> Open
          </a>
        )}
      </div>
      <p className="text-xs text-slate-400">Share this link. It opens the store's page with its coupons once the store is active.</p>
    </div>
  );
}
