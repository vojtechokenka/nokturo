import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON_CLASS } from '../lib/inputStyles';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

// Chevron-down icon (user-provided SVG) – exported for reuse
export function FilterChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    >
      <path d="M5.307 8.713A.75.75 0 0 1 6 8.25h12a.75.75 0 0 1 .53 1.28l-6 6a.75.75 0 0 1-1.06 0l-6-6a.75.75 0 0 1-.163-.817" />
    </svg>
  );
}

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: FilterSelectOption[];
  titleKey?: string;
  className?: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  titleKey = 'common.filter',
  className = '',
}: FilterSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const position = useDropdownPosition({
    open,
    triggerRef,
    minWidth: 220,
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

  const filterOptions = options.filter((opt) => opt.value !== 'all');

  const toggle = (v: string) => {
    const next = value.includes(v)
      ? value.filter((x) => x !== v)
      : [...value, v];
    onChange(next);
  };

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${SECONDARY_BUTTON_CLASS} w-fit focus:outline-none focus:ring-2 focus:ring-nokturo-400 focus:ring-offset-2 focus:ring-offset-nokturo-50 dark:focus:ring-offset-nokturo-900`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FilterChevronIcon className="w-4 h-4 text-nokturo-500 shrink-0" />
        <span>{t('common.filter')}</span>
      </button>

      {open && position && createPortal(
        <div
          ref={dropdownRef}
          className="filter-dropdown fixed z-50 min-w-[220px] bg-elevated rounded-[8px] overflow-hidden"
          style={{
            ...(position.top !== undefined && { top: position.top }),
            ...(position.bottom !== undefined && { bottom: position.bottom }),
            left: position.left,
            maxHeight: position.maxHeight,
            maxWidth: position.maxWidth,
          }}
        >
          <div className="px-3 py-2.5 bg-nokturo-200/60 dark:bg-white/10">
            <p className="text-sm font-medium text-nokturo-900 dark:text-white">{t(titleKey)}</p>
          </div>
          <div className="py-2 overflow-y-auto max-h-60" style={{ maxHeight: position.maxHeight }}>
            <div className="space-y-px px-1">
              {filterOptions.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-2 rounded-[4px] cursor-pointer hover:bg-nokturo-200 dark:hover:bg-white/10 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="w-4 h-4 rounded outline-none focus:ring-2 focus:ring-nokturo-400"
                    />
                    <span className="text-sm text-nokturo-900 dark:text-white flex-1">
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
