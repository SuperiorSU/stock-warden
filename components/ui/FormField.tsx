import { cn } from '@/lib/utils'

// ── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label, error, hint, required, prefix, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?:    string
  error?:    string
  hint?:     string
  required?: boolean
  prefix?:   string
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-13 font-medium text-ink-1">
          {label}
          {required && <span className="text-status-negative ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-14 text-ink-3 pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          className={cn(
            'w-full h-9 bg-surface border border-border rounded-md',
            'text-14 text-ink-1 placeholder:text-ink-3',
            'px-3 transition-colors duration-150',
            'hover:border-border-strong',
            'focus:outline-none focus:border-border-focus focus:ring-1',
            'focus:ring-border-focus focus:ring-offset-0',
            'disabled:bg-sunken disabled:text-ink-3 disabled:cursor-not-allowed',
            error && 'border-status-negative focus:border-status-negative focus:ring-status-negative',
            prefix && 'pl-7',
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-12 text-ink-3">{hint}</p>}
      {error && <p className="text-12 text-status-negative">{error}</p>}
    </div>
  )
}

// ── Select ───────────────────────────────────────────────────────────────────
export function Select({
  label, error, hint, required, className, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?:    string
  error?:    string
  hint?:     string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-13 font-medium text-ink-1">
          {label}
          {required && <span className="text-status-negative ml-0.5">*</span>}
        </label>
      )}
      <select
        className={cn(
          'w-full h-9 bg-surface border border-border rounded-md',
          'text-14 text-ink-1 px-3 pr-8 appearance-none',
          // chevron SVG background
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")]",
          'bg-no-repeat bg-[right_10px_center]',
          'transition-colors duration-150 cursor-pointer',
          'hover:border-border-strong',
          'focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus',
          error && 'border-status-negative',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-12 text-ink-3">{hint}</p>}
      {error && <p className="text-12 text-status-negative">{error}</p>}
    </div>
  )
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({
  label, error, hint, required, className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?:    string
  error?:    string
  hint?:     string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-13 font-medium text-ink-1">
          {label}
          {required && <span className="text-status-negative ml-0.5">*</span>}
        </label>
      )}
      <textarea
        className={cn(
          'w-full bg-surface border border-border rounded-md',
          'text-14 text-ink-1 placeholder:text-ink-3',
          'px-3 py-2 resize-none transition-colors duration-150',
          'hover:border-border-strong',
          'focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus',
          error && 'border-status-negative',
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-12 text-ink-3">{hint}</p>}
      {error && <p className="text-12 text-status-negative">{error}</p>}
    </div>
  )
}
