import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterChevronIcon } from './FilterSelect';
import type { TargetProductOption } from '../lib/compositionUtils';

export interface CompositionFilterProps {
  fibers: string[];
  selectedFibers: string[];
  onChange: (fibers: string[]) => void;
  titleKey: string;
  emptyLabelKey: string;
  /** Optional: target product filter section */
  targetProducts?: TargetProductOption[];
  selectedTargetProductIds?: string[];
  onTargetProductsChange?: (ids: string[]) => void;
  targetProductTitleKey?: string;
  targetProductEmptyLabelKey?: string;
  /** Optional: show badge with active filter count */
  activeCount?: number;
  className?: string;
}

export function CompositionFilter({
  fibers,
  selectedFibers,
  onChange,
  titleKey,
  emptyLabelKey,
  targetProducts = [],
  selectedTargetProductIds = [],
  onTargetProductsChange,
  targetProductTitleKey = 'materials.filterTargetProduct',
  targetProductEmptyLabelKey = 'materials.filterTargetProductEmpty',
  activeCount = 0,
  className = '',
}: CompositionFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Position dropdown to avoid overflow off right edge of viewport
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const minDropdownWidth = 350;
    const padding = 16;
    const spaceOnRight = window.innerWidth - rect.left - padding;
    setAlignRight(spaceOnRight < minDropdownWidth);
  }, [open]);

  const toggleFiber = (fiber: string) => {
    const next = selectedFibers.includes(fiber)
      ? selectedFibers.filter((f) => f !== fiber)
      : [...selectedFibers, fiber];
    onChange(next);
  };

  const getFiberLabel = (fiber: string) => {
    const key = `materials.fibers.${fiber}`;
    const translated = t(key);
    return translated !== key ? translated : fiber;
  };

  const hasTargetProductSection = targetProducts.length > 0 && onTargetProductsChange;
  if (fibers.length === 0 && !hasTargetProductSection) return null;

  const toggleTargetProduct = (id: string) => {
    if (!onTargetProductsChange) return;
    const next = selectedTargetProductIds.includes(id)
      ? selectedTargetProductIds.filter((x) => x !== id)
      : [...selectedTargetProductIds, id];
    onTargetProductsChange(next);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 h-9 px-3 text-sm font-medium rounded-[6px] transition-colors inline-flex items-center gap-2 w-fit focus:outline-none focus:ring-2 focus:ring-nokturo-400 focus:ring-offset-2 focus:ring-offset-nokturo-50 dark:focus:ring-offset-nokturo-900"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FilterChevronIcon className="w-4 h-4 text-nokturo-500 shrink-0" />
        <span>{t('common.filter')}</span>
        {activeCount > 0 && (
          <span className="ml-1 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded-full bg-nokturo-900 text-white text-xs font-medium">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          className={`absolute top-full mt-1.5 z-50 min-w-[200px] bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl overflow-hidden ${
            alignRight ? 'right-0 left-auto' : 'left-0'
          }`}
        >
          {/* Composition section */}
          <div className="px-3 py-2.5 border-b border-nokturo-200 dark:border-nokturo-700 bg-nokturo-50 dark:bg-nokturo-700/50">
            <p className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100">{t(titleKey)}</p>
          </div>
          <div className="py-2 max-h-48 overflow-y-auto">
            {fibers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-nokturo-500">{t(emptyLabelKey)}</p>
            ) : (
              <div className="space-y-px px-1">
                {fibers.map((fiber) => {
                  const checked = selectedFibers.includes(fiber);
                  return (
                    <label
                      key={fiber}
                      className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFiber(fiber)}
                        className="w-4 h-4 rounded-[4px] border-nokturo-300 text-nokturo-500 focus:ring-nokturo-300"
                      />
                      <span className="text-sm text-nokturo-800 dark:text-nokturo-200 flex-1">
                        {getFiberLabel(fiber)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target product section */}
          {hasTargetProductSection && (
            <>
              <div className="px-3 py-2.5 border-t border-b border-nokturo-200 dark:border-nokturo-700 bg-nokturo-50 dark:bg-nokturo-700/50">
                <p className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100">{t(targetProductTitleKey)}</p>
              </div>
              <div className="py-2 max-h-48 overflow-y-auto">
                <div className="space-y-px px-1">
                  {targetProducts.map((tp) => {
                    const checked = selectedTargetProductIds.includes(tp.id);
                    return (
                      <label
                        key={tp.id}
                        className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTargetProduct(tp.id)}
                          className="w-4 h-4 rounded-[4px] border-nokturo-300 text-nokturo-500 focus:ring-nokturo-300"
                        />
                        <span className="text-sm text-nokturo-800 dark:text-nokturo-200 flex-1 truncate">
                          {tp.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
