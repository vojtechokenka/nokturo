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

  const activeCount = sections.filter((s) => s.value.length > 0).length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 h-9 px-3 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2 w-fit focus:outline-none focus:ring-2 focus:ring-nokturo-400 focus:ring-offset-2 focus:ring-offset-nokturo-50 dark:focus:ring-offset-nokturo-900"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FilterChevronIcon className="w-4 h-4 text-nokturo-500 shrink-0" />
        <span>{t('common.filter')}</span>
        {activeCount > 0 && (
          <span className="ml-1 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded-full bg-nokturo-400 text-white text-xs font-medium">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-nokturo-200 dark:border-nokturo-700 bg-nokturo-50 dark:bg-nokturo-700/50">
            <p className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100">{t(titleKey)}</p>
          </div>
          <div className="py-2 max-h-72 overflow-y-auto">
            {sections.map((section) => (
              <div key={section.labelKey} className="mb-2 last:mb-0">
                <p className="px-3 py-1 text-xs font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-wider">
                  {t(section.labelKey)}
                </p>
                <div className="space-y-px px-1 py-0.5">
                  {section.options
                    .filter((opt) => opt.value !== 'all')
                    .map((opt) => {
                      const checked = section.value.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors"
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
                            className="w-4 h-4 rounded border-nokturo-300 text-nokturo-500 focus:ring-nokturo-300"
                          />
                          <span className="text-sm text-nokturo-800 dark:text-nokturo-200 flex-1 whitespace-nowrap">
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
