import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FilterChevronIcon } from './FilterSelect';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const position = useDropdownPosition({
    open,
    triggerRef,
    matchWidth: true,
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inTrigger && !inDropdown) {
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
    <div className={className}>
      <button
        ref={triggerRef}
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

      {open && position && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 py-2 rounded-[8px] bg-elevated overflow-hidden min-w-0"
          style={{
            ...(position.top !== undefined && { top: position.top }),
            ...(position.bottom !== undefined && { bottom: position.bottom }),
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            maxWidth: position.maxWidth,
          }}
        >
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
                  className={`w-full text-left px-3 py-2 text-sm transition-colors rounded-[4px] text-nokturo-900 dark:text-white ${
                    value === opt.value
                      ? 'bg-nokturo-200 dark:bg-white/10 font-medium'
                      : 'hover:bg-nokturo-200 dark:hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
