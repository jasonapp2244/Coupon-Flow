import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-500 mt-1">{message}</p> : null;
}

/** Spinner / error block shown while an edit form's record is loading. */
export function FormLoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <AlertTriangle size={22} className="text-red-400 mb-2" />
      <p className="text-sm font-medium text-slate-700">Couldn't load this record</p>
      <p className="text-xs text-slate-400 mt-1">{error ?? 'It may have been deleted.'}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>
    </div>
  );
}

/**
 * Image upload with preview. Shows the newly picked file, else the saved image.
 * Files over `maxMb` are refused here (the API would reject them anyway, after the upload).
 * `onRemoveSaved` lets the admin drop the saved image; the form then sends the matching remove flag.
 */
export function ImagePicker({ label, hint, file, currentUrl, onChange, icon, removeIcon, maxMb, removed = false, onRemoveSaved }: {
  label: string; hint: string; file: File | null; currentUrl: string | null;
  onChange: (file: File | null) => void; icon: ReactNode; removeIcon: ReactNode;
  maxMb: number; removed?: boolean; onRemoveSaved?: (removed: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > maxMb * 1024 * 1024) {
      setError(`That image is ${(picked.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxMb} MB.`);
      return;
    }
    setError('');
    onRemoveSaved?.(false);
    onChange(picked);
  };

  const shown = preview ?? (removed ? null : currentUrl);

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 block mb-1">{label}</p>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {shown ? (
        <div className="flex items-center gap-3">
          <div className="relative w-24 h-24 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            <img src={shown} alt="" className="w-full h-full object-cover" />
            {file && (
              <button type="button" onClick={() => onChange(null)} aria-label="Remove selected image"
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">{removeIcon}</button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={() => input.current?.click()}>Replace</Button>
            {!file && onRemoveSaved && (
              <Button variant="outline" size="sm" onClick={() => onRemoveSaved(true)}>Remove</Button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
          className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-400 hover:text-blue-500">
          {icon}
          <span className="text-xs mt-2 font-medium">Click to upload</span>
          <span className="text-xs mt-0.5">{hint}</span>
        </button>
      )}
      {removed && !file && currentUrl && (
        <p className="text-xs text-slate-500 mt-1">The image will be removed when you save. <button type="button" className="text-blue-600 underline" onClick={() => onRemoveSaved?.(false)}>Undo</button></p>
      )}
      <FieldError message={error} />
    </div>
  );
}
