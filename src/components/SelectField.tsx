import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FilterChevronIcon } from './FilterSelect';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

const triggerBaseClass =
  'w-full h-11 flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-[6px] bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 focus:outline-none focus:ring-2 focus:ring-nokturo-500 transition-colors cursor-pointer text-left pr-10';

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** Override base input classes (merge with base) */
  className?: string;
  onChange?: (e: { target: { value: string } }) => void;
}

function parseOptionsFromChildren(children: React.ReactNode): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  if (!children) return options;

  const process = (node: React.ReactNode) => {
    if (React.isValidElement(node) && node.type === 'option') {
      const props = node.props as { value?: string; children?: React.ReactNode };
      const value = props.value ?? '';
      const label = typeof props.children === 'string' ? props.children : (Array.isArray(props.children) ? props.children.join('') : String(props.children ?? ''));
      options.push({ value, label });
    } else if (Array.isArray(node)) {
      node.forEach(process);
    }
  };

  process(children);
  return options;
}

export const SelectField = React.forwardRef<HTMLDivElement, SelectFieldProps>(
  ({ className = '', children, value = '', onChange, disabled, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const position = useDropdownPosition({
      open,
      triggerRef,
      matchWidth: true,
    });

    const options = useMemo(() => parseOptionsFromChildren(children), [children]);
    const valueStr = value == null ? '' : String(value);
    const selected = options.find((o) => o.value === valueStr);
    const displayText = selected ? selected.label : '';

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

    const handleSelect = (val: string) => {
      onChange?.({ target: { value: val } });
      setOpen(false);
    };

    const setRefs = (el: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    };

    return (
      <div ref={setRefs} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={`${triggerBaseClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim()}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={displayText || 'Select option'}
        >
          <span className={`truncate ${valueStr ? 'text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-500 dark:text-nokturo-400'}`}>
            {displayText || '—'}
          </span>
          <FilterChevronIcon
            className={`w-4 h-4 text-nokturo-500 dark:text-nokturo-400 shrink-0 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && position && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[100] bg-white dark:bg-nokturo-800 rounded-[12px] shadow-lg overflow-hidden min-w-0"
            style={{
              ...(position.top !== undefined && { top: position.top }),
              ...(position.bottom !== undefined && { bottom: position.bottom }),
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              maxWidth: position.maxWidth,
            }}
          >
            <ul role="listbox" className="py-1 max-h-60 overflow-y-auto">
              {options.map((opt, i) => (
                <li key={opt.value !== '' ? opt.value : `opt-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={valueStr === opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      valueStr === opt.value
                        ? 'bg-nokturo-100 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100 font-medium'
                        : 'text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-50 dark:hover:bg-nokturo-700'
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
);

SelectField.displayName = 'SelectField';
