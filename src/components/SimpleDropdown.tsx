import { useState, useRef, useEffect } from 'react';
import { FilterChevronIcon } from './FilterSelect';

export interface SimpleDropdownOption {
  value: string;
  label: string;
}

export interface SimpleDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SimpleDropdownOption[];
  placeholder?: string;
  className?: string;
  /** When true, trigger uses compact height (h-9) like currency select */
  compact?: boolean;
}

const triggerBaseClass =
  'w-full flex items-center justify-between gap-2 px-3 rounded-[6px] bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-nokturo-500/30 appearance-none text-left';

export function SimpleDropdown({
  value,
  onChange,
  options,
  placeholder = '',
  className = '',
  compact = false,
}: SimpleDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative ${triggerBaseClass} ${compact ? 'h-9 text-sm font-medium pr-10' : 'h-11 py-2.5 text-sm pr-10'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate ${value ? 'text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-500 dark:text-nokturo-400'}`}>{displayText}</span>
        <FilterChevronIcon
          className={`w-4 h-4 text-nokturo-500 shrink-0 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-0.5 z-50 py-1 rounded-[4px] bg-black overflow-hidden min-w-0">
          <ul role="listbox" className="max-h-60 overflow-y-auto space-y-px px-1">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors rounded-[4px] text-white ${
                    value === opt.value
                      ? 'bg-white/10 font-medium'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
