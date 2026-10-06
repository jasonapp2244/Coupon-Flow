import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches render errors, most often a page chunk that no longer exists after a redeploy,
 * and offers a reload instead of leaving a blank screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle size={22} className="text-amber-500 mb-2" />
        <p className="text-sm font-medium text-slate-700">This page couldn't be loaded</p>
        <p className="text-xs text-slate-400 mt-1">The dashboard may have been updated since you opened it.</p>
        <button type="button" onClick={() => window.location.reload()}
          className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
          Reload the dashboard
        </button>
      </div>
    );
  }
}
