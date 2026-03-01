import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterChevronIcon } from './FilterSelect';

export interface FilterSectionOption {
  value: string;
  label: string;
}

export interface FilterSection {
  labelKey: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: FilterSectionOption[];
}

export interface FilterGroupProps {
  titleKey: string;
  sections: FilterSection[];
  className?: string;
}

export function FilterGroup({
  titleKey,
  sections,
  className = '',
}: FilterGroupProps) {
  const { t } = useTranslation();
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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 h-9 px-3 text-sm font-medium rounded-[6px] transition-colors inline-flex items-center gap-2 w-fit focus:outline-none focus:ring-2 focus:ring-nokturo-500/30 focus:ring-offset-0"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FilterChevronIcon className={`w-4 h-4 text-nokturo-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        <span>{t('common.filter')}</span>
      </button>

      {open && (
        <div className="filter-dropdown absolute left-0 top-full mt-1.5 z-50 min-w-[220px] bg-black rounded-[8px] overflow-hidden">
          <div className="px-3 py-2.5 bg-white/10">
            <p className="text-sm font-medium text-white">{t(titleKey)}</p>
          </div>
          <div className="py-2 max-h-60 overflow-y-auto">
            {sections.map((section) => (
              <div key={section.labelKey} className="mb-2 last:mb-0">
                <p className="px-2 py-0.5 text-[10px] font-medium text-white/60 uppercase tracking-wider">
                  {t(section.labelKey)}
                </p>
                <div className="space-y-px px-1">
                  {section.options
                    .filter((opt) => opt.value !== 'all')
                    .map((opt) => {
                      const checked = section.value.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 px-2 py-2 rounded-[4px] cursor-pointer hover:bg-white/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? section.value.filter((v) => v !== opt.value)
                                : [...section.value, opt.value];
                              section.onChange(next);
                            }}
                            className="w-4 h-4 rounded outline-none focus:ring-2 focus:ring-nokturo-400"
                          />
                          <span className="text-sm text-white flex-1 whitespace-nowrap">
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
