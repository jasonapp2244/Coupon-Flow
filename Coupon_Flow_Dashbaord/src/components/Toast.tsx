import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../store/AppContext';

const config = {
  success: { icon: <CheckCircle size={15} />, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', iconColor: 'text-emerald-500' },
  error: { icon: <XCircle size={15} />, bg: 'bg-red-50 border-red-200', text: 'text-red-800', iconColor: 'text-red-500' },
  warning: { icon: <AlertTriangle size={15} />, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', iconColor: 'text-amber-500' },
  info: { icon: <Info size={15} />, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', iconColor: 'text-blue-500' },
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {toasts.map(toast => {
        const c = config[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto max-w-sm ${c.bg}`}
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            <span className={c.iconColor}>{c.icon}</span>
            <p className={`text-sm font-medium flex-1 ${c.text}`}>{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className={`${c.iconColor} opacity-60 hover:opacity-100 transition-opacity`}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
