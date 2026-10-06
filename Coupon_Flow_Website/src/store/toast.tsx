import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Toast { id: number; message: string; tone: 'ok' | 'error' }

const ToastContext = createContext<((message: string, tone?: Toast['tone']) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

  const show = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current;
    setToasts(list => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-5 z-50 flex flex-col gap-2 items-stretch sm:items-end" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${t.tone === 'ok' ? 'bg-ink text-white' : 'bg-raspberry text-white'}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
