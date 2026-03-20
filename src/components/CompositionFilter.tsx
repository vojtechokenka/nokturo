import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON_CLASS } from '../lib/inputStyles';
import { FilterChevronIcon } from './FilterSelect';
import type { TargetProductOption } from '../lib/compositionUtils';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const position = useDropdownPosition({
    open,
    triggerRef,
    dropdownWidth: 420,
    desiredHeight: 384,
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
        {activeCount > 0 && (
          <span className="ml-1 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded-[9999px] bg-nokturo-900 text-white text-xs font-medium">
            {activeCount}
          </span>
        )}
      </button>

      {open && position && createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 w-[420px] rounded-[6px] overflow-hidden p-6 bg-[#E6E6E6] dark:bg-[#1a1a1a]"
          style={{
            ...(position.top !== undefined && { top: position.top }),
            ...(position.bottom !== undefined && { bottom: position.bottom }),
            left: position.left,
            maxHeight: position.maxHeight,
            maxWidth: position.maxWidth,
          }}
        >
          {/* Composition section: heading + checkbox+text items */}
          <div>
            <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 opacity-60 mb-3">{t('common.composition')}</p>
            {fibers.length === 0 ? (
              <p className="text-sm text-nokturo-500">{t(emptyLabelKey)}</p>
            ) : (
              <div className="flex flex-wrap gap-x-8 gap-y-4 max-h-48 overflow-y-auto">
                {fibers.map((fiber) => {
                  const checked = selectedFibers.includes(fiber);
                  return (
                    <label
                      key={fiber}
                      className="flex items-center gap-2 cursor-pointer text-sm text-nokturo-800 dark:text-nokturo-200 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFiber(fiber)}
                        className="w-4 h-4 rounded-[4px] border-nokturo-300 text-nokturo-500 focus:ring-nokturo-300 shrink-0"
                      />
                      <span className="min-w-0 break-words">{getFiberLabel(fiber)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target product section: 40px margin, heading, same design as composition (checkbox + text) */}
          {hasTargetProductSection && (
            <div className="mt-10">
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 opacity-60 mb-3">{t('common.product')}</p>
              <div className="flex flex-wrap gap-x-8 gap-y-4 max-h-48 overflow-y-auto">
                {targetProducts.map((tp) => {
                  const checked = selectedTargetProductIds.includes(tp.id);
                  return (
                    <label
                      key={tp.id}
                      className="flex items-center gap-2 cursor-pointer text-sm text-nokturo-800 dark:text-nokturo-200 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTargetProduct(tp.id)}
                        className="w-4 h-4 rounded-[4px] border-nokturo-300 text-nokturo-500 focus:ring-nokturo-300 shrink-0"
                      />
                      <span className="min-w-0 break-words">{tp.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
