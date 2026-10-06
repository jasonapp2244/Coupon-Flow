import { useId, type ReactNode } from 'react';

// Badge
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
const badgeStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
};

export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    Active: 'success', Published: 'success', Used: 'success', Completed: 'success', Connected: 'success',
    Pending: 'warning', Running: 'warning', Partial: 'warning', Scheduled: 'warning',
    Inactive: 'neutral', Draft: 'neutral', Clicked: 'neutral',
    Expired: 'neutral', Failed: 'danger', Disconnected: 'danger',
    'Editor Choice': 'purple', Featured: 'info',
  };
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>;
}

// Toggle
/**
 * On/off switch. A real button (Tab + Space/Enter work) exposed as role="switch".
 * Give it `label` (visible text) or `ariaLabel` when the text is shown elsewhere.
 */
export function Toggle({ checked, onChange, label, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: string; ariaLabel?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label ? undefined : ariaLabel}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 cursor-pointer select-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
      <span className={`relative block w-9 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </button>
  );
}

// Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
const btnStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border-transparent',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent shadow-sm',
  outline: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm',
};

export function Button({
  variant = 'primary', children, onClick, className = '', disabled, size = 'md', type = 'button',
}: {
  variant?: ButtonVariant; children: ReactNode; onClick?: () => void; className?: string;
  disabled?: boolean; size?: 'sm' | 'md' | 'lg'; type?: 'button' | 'submit';
}) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-2.5 text-sm' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg border transition-all duration-150 ${sizes[size]} ${btnStyles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
}

// Input
export function Input({ label, placeholder, value, onChange, type = 'text', helperText, required, className = '' }: {
  label?: string; placeholder?: string; value?: string; onChange?: (v: string) => void;
  type?: string; helperText?: string; required?: boolean; className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-400"
      />
      {helperText && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  );
}

// Select
export function Select({ label, options, value, onChange, required }: {
  label?: string; options: string[]; value?: string; onChange?: (v: string) => void; required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <select
        id={id}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all appearance-none cursor-pointer"
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

// Textarea
export function Textarea({ label, placeholder, rows = 4, required, value, onChange }: {
  label?: string; placeholder?: string; rows?: number; required?: boolean;
  value?: string; onChange?: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <textarea
        id={id}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-400 resize-none"
      />
    </div>
  );
}

// Card
export function Card({ children, className = '', padding = true, onClick }: { children: ReactNode; className?: string; padding?: boolean; onClick?: () => void }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${padding ? 'p-5' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

// PageHeader
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// EmptyState
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>
    </div>
  );
}

// Checkbox
export function Checkbox({ checked, onChange }: { checked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange?.(e.target.checked)}
      className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer accent-blue-600"
    />
  );
}

// SectionTitle
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-slate-800">{children}</h2>
      {action}
    </div>
  );
}

// Stat
export function Stat({ label, value, variant = 'neutral' }: { label: string; value: string; variant?: BadgeVariant }) {
  return (
    <div className={`flex flex-col gap-0.5 px-4 py-3 rounded-lg border ${badgeStyles[variant]} bg-opacity-30`}>
      <span className="text-xs font-medium opacity-80">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
