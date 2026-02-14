import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  GripVertical,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { FilterChevronIcon } from './FilterSelect';
import { INPUT_CLASS } from '../lib/inputStyles';

// ── Types ─────────────────────────────────────────────────────
export interface NotionSelectOption {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface NotionSelectProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: NotionSelectOption[];
  onOptionsChange?: (options: NotionSelectOption[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  createHint?: string;
  /** i18n key path for known options (e.g. moodboard.categories) - enables translation */
  optionsI18nKey?: string;
  disabled?: boolean;
  className?: string;
  /** When true, allows selecting multiple options */
  multiple?: boolean;
  /** When true, shows filter icon + "Filtrovat" label (universal filter design) */
  filterStyle?: boolean;
  /** When false, hides delete option in dropdown (only founder can delete) */
  canDelete?: boolean;
  /** Z-index for dropdown when inside modal/slide-over (default 100) */
  dropdownZIndex?: number;
}

// Notion-style tag colors
const TAG_COLORS: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-amber-600 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-600 text-white',
  purple: 'bg-violet-600 text-white',
  pink: 'bg-pink-600 text-white',
  red: 'bg-red-600 text-white',
  yellow: 'bg-amber-500 text-nokturo-900',
};

const COLOR_OPTIONS = ['gray', 'orange', 'blue', 'green', 'purple', 'pink', 'red', 'yellow'];

// ── Component ──────────────────────────────────────────────────
export function NotionSelect({
  value,
  onChange,
  options,
  onOptionsChange,
  placeholder = '—',
  searchPlaceholder,
  createHint,
  optionsI18nKey,
  disabled = false,
  className = '',
  multiple = false,
  filterStyle = false,
  canDelete = true,
  dropdownZIndex = 100,
}: NotionSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const optionMenuRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left: number; width?: number; maxHeight?: number; maxWidth?: number } | null>(null);
  const [optionMenuPosition, setOptionMenuPosition] = useState<{ top?: number; bottom?: number; left: number; maxHeight?: number } | null>(null);

  const searchPh = searchPlaceholder ?? t('notionSelect.searchPlaceholder');
  const hint = createHint ?? (onOptionsChange ? t('notionSelect.selectOrCreate') : t('notionSelect.selectOption'));

  // Close on outside click (containerRef + dropdownRef + optionMenuRef when portaled)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      const inOptionMenu = optionMenuRef.current?.contains(target);
      if (!inContainer && !inDropdown && !inOptionMenu) {
        setOpen(false);
        setMenuOpenId(null);
        setEditingId(null);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Update dropdown position when open (for portal – avoids overflow clipping in modals)
  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setDropdownPosition(null);
      return;
    }
    const PADDING = 24;
    const MAX_DROPDOWN_HEIGHT = 256; // max-h-64

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - PADDING - rect.bottom;
      const spaceAbove = rect.top - PADDING;

      // If not enough space below, flip above; otherwise prefer side with more space
      const showAbove =
        spaceBelow < MAX_DROPDOWN_HEIGHT ||
        (spaceAbove >= MAX_DROPDOWN_HEIGHT && spaceAbove >= spaceBelow);

      let top: number | undefined;
      let bottom: number | undefined;
      let maxHeight: number | undefined;
      if (showAbove) {
        bottom = vh - rect.top + 4;
        maxHeight = rect.top - PADDING - 4;
      } else {
        top = rect.bottom + 4;
        if (top + MAX_DROPDOWN_HEIGHT > vh - PADDING) {
          maxHeight = vh - PADDING - top;
        }
      }

      let left = rect.left;
      const width = filterStyle ? undefined : rect.width;

      // Constrain to viewport with 24px padding
      left = Math.max(PADDING, left);
      if (width !== undefined) {
        left = Math.min(left, vw - PADDING - width);
      } else {
        left = Math.min(left, vw - PADDING - 180); // filterStyle min-width
      }

      if (top !== undefined) {
        top = Math.max(PADDING, top);
      }

      // maxWidth ensures dropdown doesn't overflow right edge
      const maxWidth = vw - PADDING - left;

      setDropdownPosition({
        top,
        bottom,
        left,
        width,
        maxHeight,
        maxWidth,
      });
    };
    updatePosition();
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, filterStyle]);

  // Option menu (Edit/Color/Delete) position – portal with viewport-aware flip
  const MENU_ESTIMATED_HEIGHT = 160;
  const MENU_WIDTH = 120;
  useLayoutEffect(() => {
    if (!menuOpenId || !optionMenuTriggerRef.current) {
      setOptionMenuPosition(null);
      return;
    }
    const PADDING = 24;

    const updatePosition = () => {
      const trigger = optionMenuTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - PADDING - rect.bottom;
      const spaceAbove = rect.top - PADDING;

      // If not enough space below, flip above; otherwise prefer side with more space
      const showAbove =
        spaceBelow < MENU_ESTIMATED_HEIGHT ||
        (spaceAbove >= MENU_ESTIMATED_HEIGHT && spaceAbove >= spaceBelow);

      let top: number | undefined;
      let bottom: number | undefined;
      let maxHeight: number | undefined;
      if (showAbove) {
        // Anchor menu bottom to trigger top
        bottom = vh - rect.top + 4;
        maxHeight = rect.top - PADDING - 4;
      } else {
        top = rect.bottom + 4;
        if (top + MENU_ESTIMATED_HEIGHT > vh - PADDING) {
          maxHeight = vh - PADDING - top;
        }
      }

      // Right-align menu to trigger; clamp to viewport
      let left = rect.right - MENU_WIDTH;
      left = Math.max(PADDING, Math.min(left, vw - PADDING - MENU_WIDTH));

      setOptionMenuPosition({ top, bottom, left, maxHeight });
    };
    updatePosition();
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [menuOpenId]);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const getDisplayName = (name: string): string => {
    if (optionsI18nKey) {
      const translated = t(`${optionsI18nKey}.${name}`);
      if (translated !== `${optionsI18nKey}.${name}`) return translated;
    }
    return name;
  };

  const getTagClass = (color: string) =>
    TAG_COLORS[color] ?? TAG_COLORS.gray;

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = options.find(
    (o) => o.name.toLowerCase() === search.trim().toLowerCase()
  );
  const canCreate = search.trim().length > 0 && !exactMatch && !!onOptionsChange;

  const selectedValues = multiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : [];

  const handleSelect = (name: string) => {
    if (multiple) {
      const next = selectedValues.includes(name)
        ? selectedValues.filter((v) => v !== name)
        : [...selectedValues, name];
      onChange(next);
    } else {
      onChange(name);
      setOpen(false);
    }
  };

  const handleCreate = () => {
    const name = search.trim();
    if (!name || exactMatch || !onOptionsChange) return;
    const newOpt: NotionSelectOption = {
      id: crypto.randomUUID(),
      name,
      color: 'gray',
      sort_order: options.length,
    };
    onOptionsChange([...options, newOpt]);
    if (multiple) {
      if (!selectedValues.includes(name)) {
        onChange([...selectedValues, name]);
      }
    } else {
      onChange(name);
      setOpen(false);
    }
    setSearch('');
  };

  const handleDelete = (id: string) => {
    const opt = options.find((o) => o.id === id);
    if (!opt || !onOptionsChange) return;
    onOptionsChange(options.filter((o) => o.id !== id));
    if (multiple) {
      onChange(selectedValues.filter((v) => v !== opt.name));
    } else if (value === opt.name) {
      onChange('');
    }
    setMenuOpenId(null);
  };

  const handleUpdateName = (id: string, newName: string) => {
    if (!onOptionsChange || !newName.trim()) return;
    const opt = options.find((o) => o.id === id);
    if (!opt) return;
    const oldName = opt.name;
    if (options.some((o) => o.id !== id && o.name.toLowerCase() === newName.trim().toLowerCase())) {
      setEditingId(null);
      return;
    }
    const updated = options.map((o) =>
      o.id === id ? { ...o, name: newName.trim() } : o
    );
    onOptionsChange(updated);
    if (multiple) {
      if (selectedValues.includes(oldName)) {
        onChange(selectedValues.map((v) => (v === oldName ? newName.trim() : v)));
      }
    } else if (value === oldName) {
      onChange(newName.trim());
    }
    setEditingId(null);
  };

  const handleUpdateColor = (id: string, color: string) => {
    if (!onOptionsChange) return;
    onOptionsChange(
      options.map((o) => (o.id === id ? { ...o, color } : o))
    );
    setMenuOpenId(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (!onOptionsChange || fromIndex === toIndex) return;
    const reordered = [...options];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    const withSortOrder = reordered.map((o, i) => ({ ...o, sort_order: i }));
    onOptionsChange(withSortOrder);
  };

  const selectedOptions = multiple
    ? options.filter((o) => selectedValues.includes(o.name))
    : options.find((o) => o.name === value)
      ? [options.find((o) => o.name === value)!]
      : [];

  return (
    <div ref={containerRef} className={`relative ${filterStyle ? 'w-fit' : ''} ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`rounded-lg px-3 text-sm text-left focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          filterStyle
            ? 'bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 h-9 font-medium inline-flex items-center gap-2 w-fit'
            : 'w-full flex items-center justify-between gap-2 py-1.5 bg-nokturo-200/60 dark:bg-nokturo-700/80 focus:ring-2 focus:ring-nokturo-500 ' + (selectedOptions.length === 0 ? 'text-nokturo-400 dark:text-nokturo-500' : 'text-nokturo-900 dark:text-nokturo-100')
        }`}
      >
        <span className="flex flex-wrap items-center gap-2 min-w-0">
          {filterStyle && (
            <>
              <FilterChevronIcon className="w-4 h-4 text-nokturo-500 shrink-0" />
              <span className="text-nokturo-900 dark:text-nokturo-100 shrink-0">{t('common.filter')}</span>
              {selectedOptions.length > 0 && <span className="text-nokturo-300">|</span>}
            </>
          )}
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getTagClass(opt.color)}`}
              >
                {getDisplayName(opt.name)}
              </span>
            ))
          ) : !filterStyle ? (
            <span>{placeholder}</span>
          ) : null}
        </span>
        {!filterStyle && (
          <FilterChevronIcon
            className={`w-4 h-4 text-nokturo-500 dark:text-nokturo-400 shrink-0 transition-transform ml-1 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown – portaled to body to avoid overflow clipping in modals */}
      {open && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className={`fixed bg-white dark:bg-nokturo-800 rounded-xl shadow-lg flex flex-col overflow-hidden ${
            filterStyle ? 'min-w-[180px] w-max' : ''
          }`}
          style={{
            zIndex: dropdownZIndex,
            ...(dropdownPosition.top !== undefined && { top: dropdownPosition.top }),
            ...(dropdownPosition.bottom !== undefined && { bottom: dropdownPosition.bottom }),
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
            maxWidth: dropdownPosition.maxWidth,
          }}
        >
          {/* Search */}
          <div className="p-1.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nokturo-500 dark:text-nokturo-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (canCreate) handleCreate();
                    else if (filtered.length === 1) handleSelect(filtered[0].name);
                  }
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={searchPh}
                className={`${INPUT_CLASS} pl-8 py-1.5`}
              />
            </div>
            <p className="text-nokturo-500 dark:text-nokturo-400 text-xs mt-1">{hint}</p>
          </div>

          {/* Options list */}
          <div className={`overflow-y-auto p-1.5 ${dropdownPosition.maxHeight ? 'flex-1 min-h-0' : 'max-h-64'}`}>
            {filtered.length === 0 && !canCreate ? (
              <p className="text-nokturo-500 dark:text-nokturo-400 text-sm py-3 text-center">
                {t('notionSelect.noOptions')}
              </p>
            ) : (
              <div className="space-y-px">
                {filtered.map((opt, idx) => {
                  const optIndex = options.findIndex((o) => o.id === opt.id);
                  const canDrag = !search.trim() && onOptionsChange && options.length > 1;
                  const showDropBefore = canDrag && dropIndex === idx;
                  const showDropAfter = canDrag && dropIndex === idx + 1;

                  return (
                  <div
                    key={opt.id}
                    className={`relative flex items-center gap-2 rounded-md px-1.5 py-1 group ${
                      (multiple ? selectedValues.includes(opt.name) : value === opt.name)
                        ? 'bg-nokturo-200 dark:bg-nokturo-600'
                        : 'hover:bg-nokturo-50 dark:hover:bg-nokturo-700'
                    } ${draggedId === opt.id ? 'opacity-50' : ''} ${filterStyle ? 'whitespace-nowrap' : ''}`}
                    onDragOver={(e) => {
                      if (!canDrag || opt.id === draggedId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const targetIdx = e.clientY < midY ? idx : idx + 1;
                      setDropIndex(targetIdx);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const data = e.dataTransfer.getData('application/json');
                      if (!data || !canDrag) return;
                      const { index: fromIndex } = JSON.parse(data) as { id: string; index: number };
                      const toIndex = dropIndex ?? idx;
                      setDropIndex(null);
                      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                        handleReorder(fromIndex, toIndex);
                      }
                    }}
                  >
                    {showDropBefore && (
                      <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-nokturo-500 dark:bg-nokturo-400 rounded z-10" aria-hidden />
                    )}
                    <div
                      draggable={canDrag}
                      onDragStart={(e) => {
                        if (!canDrag) return;
                        setDraggedId(opt.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', opt.id);
                        e.dataTransfer.setData('application/json', JSON.stringify({ id: opt.id, index: optIndex }));
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDropIndex(null);
                      }}
                      className={`shrink-0 text-nokturo-500 ${canDrag ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {editingId === opt.id ? (
                      <input
                        type="text"
                        defaultValue={opt.name}
                        autoFocus
                        onBlur={(e) => handleUpdateName(opt.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateName(opt.id, (e.target as HTMLInputElement).value);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className={`flex-1 ${INPUT_CLASS} py-1`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelect(opt.name)}
                        className="flex-1 flex items-center gap-2 min-w-0 text-left"
                      >
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getTagClass(opt.color)}`}
                        >
                          {getDisplayName(opt.name)}
                        </span>
                      </button>
                    )}

                    <div className="relative shrink-0">
                      <button
                        ref={menuOpenId === opt.id ? optionMenuTriggerRef : undefined}
                        type="button"
                        onClick={() =>
                          setMenuOpenId((id) => (id === opt.id ? null : opt.id))
                        }
                        className="p-1 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    {showDropAfter && (
                      <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-nokturo-500 dark:bg-nokturo-400 rounded z-10" aria-hidden />
                    )}
                  </div>
                  );
                })}

                {canCreate && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200"
                  >
                    <span className="text-nokturo-500">+</span>
                    {t('notionSelect.createOption', { name: search.trim() })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Option menu (Edit/Color/Delete) – portaled, viewport-aware */}
      {menuOpenId && optionMenuPosition && (() => {
        const openOpt = options.find((o) => o.id === menuOpenId);
        if (!openOpt) return null;
        return createPortal(
          <div
            ref={optionMenuRef}
            className={`fixed bg-white dark:bg-nokturo-800 rounded-lg py-0.5 min-w-[120px] shadow-lg overflow-x-hidden ${optionMenuPosition.maxHeight ? 'overflow-y-auto' : ''}`}
            style={{
              zIndex: dropdownZIndex + 10,
              ...(optionMenuPosition.top !== undefined && { top: optionMenuPosition.top }),
              ...(optionMenuPosition.bottom !== undefined && { bottom: optionMenuPosition.bottom }),
              left: optionMenuPosition.left,
              maxHeight: optionMenuPosition.maxHeight,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setEditingId(openOpt.id);
                setMenuOpenId(null);
              }}
              className="w-full px-2.5 py-1 text-left text-sm text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-50 dark:hover:bg-nokturo-700"
            >
              {t('common.edit')}
            </button>
            <div className="my-0.5 h-px bg-nokturo-200/60 dark:bg-nokturo-600" />
            <p className="px-2.5 py-0.5 text-xs text-nokturo-500 dark:text-nokturo-400">
              {t('notionSelect.color')}
            </p>
            <div className="flex flex-wrap gap-1 px-2 py-0.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleUpdateColor(openOpt.id, c)}
                  className={`w-5 h-5 rounded-full ${getTagClass(c)} ${
                    openOpt.color === c ? 'ring-2 ring-nokturo-900 dark:ring-nokturo-300 ring-offset-1 ring-offset-white dark:ring-offset-nokturo-800' : ''
                  }`}
                  title={c}
                />
              ))}
            </div>
            {canDelete && (
              <>
                <div className="my-0.5 h-px bg-nokturo-200/60 dark:bg-nokturo-600" />
                <button
                  type="button"
                  onClick={() => handleDelete(openOpt.id)}
                  className="w-full px-2.5 py-1 text-left text-sm text-red-400 dark:text-red-300 hover:bg-red-500/15 dark:hover:bg-red-900/30 flex items-center gap-2"
                >
                  <X className="w-3 h-3" />
                  {t('common.delete')}
                </button>
              </>
            )}
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
