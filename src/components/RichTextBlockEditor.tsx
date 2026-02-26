/**
 * Webflow-style Rich Text Block Editor
 * Blocks: 3 headings, 2 paragraphs (with link/bold/italic), quote, image, gallery, grid, link, divider
 */
import { useState, useCallback, useRef, useEffect, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Image as ImageIcon,
  LayoutGrid,
  Grid3X3,
  Link2,
  Minus,
  Plus,
  GripVertical,
  Trash2,
  Bold,
  Italic,
  List,
  Lock,
  Unlock,
} from 'lucide-react';
import type { ToastData } from './Toast';
import { INPUT_CLASS } from '../lib/inputStyles';

// ── Block types ─────────────────────────────────────────────────
export type HeadingLevel = 1 | 2 | 3;
export type ParagraphSize = 'normal' | 'large' | 'small';
export type ParagraphAlign = 'left' | 'center' | 'right';
export type GalleryColumns = 2 | 3 | 4;

export type RichTextBlock =
  | { id: string; type: 'heading'; level: HeadingLevel; text: string }
  | { id: string; type: 'paragraph'; size: ParagraphSize; align?: ParagraphAlign; content: string }
  | { id: string; type: 'quote'; text: string }
  | { id: string; type: 'image'; url: string; alt?: string; fit?: 'fill' | 'hug'; caption?: string }
  | {
      id: string;
      type: 'gallery';
      columns: GalleryColumns;
      images: { url: string; alt?: string; caption?: string }[];
    }
  | {
      id: string;
      type: 'imageGrid';
      columns: number;
      gapRow: number;
      gapCol: number;
      gapLocked?: boolean;
      aspectRatio?: '5:4' | '1:1' | '3:2' | '16:9';
      images: { url: string; alt?: string; caption?: string }[];
    }
  | {
      id: string;
      type: 'grid';
      columns: number;
      rows: number;
      headerRowCount: number;
      headerColumnCount: number;
      cells: { type: 'text' | 'image'; content: string; caption?: string }[];
    }
  | { id: string; type: 'link'; url: string; text: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'list'; style: 'bullet' | 'numbered'; items: string[] };

function generateId() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isBlockEmpty(block: RichTextBlock): boolean {
  switch (block.type) {
    case 'heading':
      return !block.text?.trim();
    case 'paragraph': {
      const c = (block.content ?? '').replace(/<br\s*\/?>/gi, '').trim();
      return !c;
    }
    case 'quote':
      return !block.text?.trim();
    case 'list':
      return !block.items?.some((i) => i?.trim()) || (block.items?.length === 1 && !block.items[0]?.trim());
    case 'image':
      return !block.url?.trim();
    case 'gallery':
    case 'imageGrid':
      return !block.images?.length;
    case 'grid':
      return !block.cells?.some((c) => (c.content ?? '').trim());
    case 'link':
      return !block.text?.trim() && !block.url?.trim();
    case 'divider':
      return true;
    default:
      return true;
  }
}

export function getAspectClass(ratio: '5:4' | '1:1' | '3:2' | '16:9' | undefined): string {
  const r = ratio ?? '1:1';
  return r === '1:1' ? 'aspect-square' : r === '5:4' ? 'aspect-[5/4]' : r === '3:2' ? 'aspect-[3/2]' : 'aspect-video';
}

// ── List marker patterns: "- ", "1. ", "a) ", etc. ─────────────────
const UNORDERED_PATTERN = /^[-*]\s*$/;
const ORDERED_PATTERN = /^(\d+\.|[a-zA-Z]\))\s*$/;

function getCurrentLineText(container: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().split('\n').pop() || '';
}

// ── Editable paragraph (avoids cursor jump) ─────────────────────
const EditableParagraph = forwardRef<
  HTMLDivElement,
  { content: string; size: ParagraphSize; onSave: (html: string) => void }
>(function EditableParagraph({ content, size, onSave }, forwardedRef) {
  const ref = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el;
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  useEffect(() => {
    const target = content || '';
    if (ref.current && ref.current.innerHTML !== target && !ref.current.contains(document.activeElement)) {
      ref.current.innerHTML = target;
    }
  }, [content]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (ref.current) onSave(ref.current.innerHTML);
    }, 800);
  }, [onSave]);

  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const anchor = sel.anchorNode;
    if (!anchor) return;
    const el = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement;
    if (el?.closest('ul, ol')) return;
    const lineText = getCurrentLineText(ref.current);
    if (UNORDERED_PATTERN.test(lineText)) {
      e.preventDefault();
      document.execCommand('insertUnorderedList', false);
    } else if (ORDERED_PATTERN.test(lineText)) {
      e.preventDefault();
      document.execCommand('insertOrderedList', false);
    }
  }, []);

  const sizeClass = size === 'large' ? 'text-lg text-nokturo-900 dark:text-nokturo-100' : size === 'small' ? 'text-sm text-nokturo-900/60 dark:text-nokturo-100/60' : 'text-base text-nokturo-900/80 dark:text-nokturo-100/80';
  const textClass = '';

  return (
    <div
      ref={setRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onSave(e.currentTarget.innerHTML);
      }}
      onInput={handleInput}
      onKeyDown={handleListKeyDown}
      className={`font-body mt-1 min-h-[1.5em] outline-none focus:outline-none px-2 py-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5 ${sizeClass} ${textClass}`}
    />
  );
});

// ── Editable list item (supports bold/italic via Ctrl+B / Ctrl+I) ───
function EditableListItem({
  html,
  placeholder,
  onSave,
  onEnter,
  onBackspaceEmpty,
  autoFocus,
  onFocused,
}: {
  html: string;
  placeholder?: string;
  onSave: (html: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  autoFocus?: boolean;
  onFocused?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const savedHtml = useRef(html);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => {
      ref.current?.focus();
      onFocused?.();
    }, 0);
    return () => clearTimeout(id);
  }, [autoFocus, onFocused]);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
    savedHtml.current = html;
  }, [html]);

  const save = useCallback(() => {
    if (ref.current) {
      const v = ref.current.innerHTML;
      if (v !== savedHtml.current) {
        savedHtml.current = v;
        onSave(v);
      }
    }
  }, [onSave]);

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 800);
  }, [save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      save();
      onEnter();
    }
    if (e.key === 'Backspace' && ref.current) {
      const content = ref.current.innerHTML;
      if (!content || content === '<br>') {
        e.preventDefault();
        onBackspaceEmpty();
      }
    }
  }, [save, onEnter, onBackspaceEmpty]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        save();
      }}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      className="flex-1 bg-transparent outline-none min-h-[1.4em] text-sm text-nokturo-700 dark:text-nokturo-300 empty:before:content-[attr(data-placeholder)] empty:before:text-nokturo-400 dark:empty:before:text-nokturo-500 empty:before:pointer-events-none"
    />
  );
}

// ── Editable cell for grid (supports bold/italic/link) ──────────
function GridCell({
  content,
  isHeader,
  onSave,
  onFocus,
  onBlur,
  placeholder,
}: {
  content: string;
  isHeader: boolean;
  onSave: (html: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(!content?.trim());

  useEffect(() => {
    const target = content || '';
    if (ref.current && !ref.current.contains(document.activeElement) && ref.current.innerHTML !== target) {
      ref.current.innerHTML = target;
      setShowPlaceholder(!target.trim());
    }
  }, [content]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const checkEmpty = () => {
    if (ref.current) setShowPlaceholder(!(ref.current.textContent || '').trim());
  };

  return (
    <div className="relative min-h-[1.2em]">
      {showPlaceholder && placeholder && (
        <span className="absolute left-0 top-0 pointer-events-none text-nokturo-400 dark:text-nokturo-500 text-sm select-none">
          {placeholder}
        </span>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => { onFocus(); checkEmpty(); }}
        onBlur={(e) => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          onSave(e.currentTarget.innerHTML);
          onBlur();
          checkEmpty();
        }}
        onInput={() => {
          checkEmpty();
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            if (ref.current) onSave(ref.current.innerHTML);
          }, 800);
        }}
        className={`w-full text-sm bg-transparent outline-none min-h-[1.2em] ${
          isHeader ? 'font-semibold text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-700 dark:text-nokturo-300'
        } [&_a]:underline [&_a]:text-blue-600 dark:[&_a]:text-blue-400`}
      />
    </div>
  );
}

// ── Inline formatting bar (for paragraph) ────────────────────────
function FormattingBar({
  onBold,
  onItalic,
  onLink,
  isBold,
  isItalic,
}: {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  isBold: boolean;
  isItalic: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-0.5 p-0.5 text-nokturo-700 dark:text-nokturo-300">
      <button
        type="button"
        onClick={onBold}
        className={`p-1.5 rounded hover:bg-nokturo-200 dark:hover:bg-nokturo-600 ${isBold ? 'bg-nokturo-200 dark:bg-nokturo-600' : ''}`}
        title={t('richText.bold')}
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        onClick={onItalic}
        className={`p-1.5 rounded hover:bg-nokturo-200 dark:hover:bg-nokturo-600 ${isItalic ? 'bg-nokturo-200 dark:bg-nokturo-600' : ''}`}
        title={t('richText.italic')}
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        onClick={onLink}
        className="p-1.5 rounded hover:bg-nokturo-200 dark:hover:bg-nokturo-600"
        title={t('richText.link')}
      >
        <Link2 size={14} />
      </button>
    </div>
  );
}

// ── Block menu (add block) ──────────────────────────────────────
function AddBlockMenu({
  onAdd,
  onClose,
}: {
  onAdd: (block: RichTextBlock) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const options: { icon: React.ReactNode; labelKey: string; block: RichTextBlock }[] = [
    {
      icon: <Type size={16} />,
      labelKey: 'richText.heading',
      block: { id: generateId(), type: 'heading', level: 1, text: '' },
    },
    {
      icon: <AlignLeft size={16} />,
      labelKey: 'richText.paragraph',
      block: { id: generateId(), type: 'paragraph', size: 'normal', content: '' },
    },
    {
      icon: <Quote size={16} />,
      labelKey: 'richText.quote',
      block: { id: generateId(), type: 'quote', text: '' },
    },
    {
      icon: <List size={16} />,
      labelKey: 'richText.bulletList',
      block: { id: generateId(), type: 'list', style: 'bullet', items: [''] },
    },
    {
      icon: <ImageIcon size={16} />,
      labelKey: 'richText.image',
      block: { id: generateId(), type: 'image', url: '', fit: 'fill' },
    },
    {
      icon: <LayoutGrid size={16} />,
      labelKey: 'richText.gallery',
      block: {
        id: generateId(),
        type: 'gallery',
        columns: 3,
        images: [],
      },
    },
    {
      icon: <Grid3X3 size={16} />,
      labelKey: 'richText.imageGrid',
      block: {
        id: generateId(),
        type: 'imageGrid',
        columns: 3,
        gapRow: 8,
        gapCol: 8,
        aspectRatio: '1:1',
        images: [],
      },
    },
    {
      icon: <Grid3X3 size={16} />,
      labelKey: 'richText.grid',
      block: {
        id: generateId(),
        type: 'grid',
        columns: 1,
        rows: 1,
        headerRowCount: 0,
        headerColumnCount: 0,
        cells: [{ type: 'text' as const, content: '' }],
      },
    },
    {
      icon: <Link2 size={16} />,
      labelKey: 'richText.link',
      block: { id: generateId(), type: 'link', url: '', text: '' },
    },
    {
      icon: <Minus size={16} />,
      labelKey: 'richText.divider',
      block: { id: generateId(), type: 'divider' },
    },
  ];

  return (
    <div className="mt-1 w-52 py-0.5 bg-white/95 dark:bg-nokturo-800/95 backdrop-blur-sm">
      {options.map((opt) => (
        <button
          key={opt.block.type}
          type="button"
          onClick={() => {
            onAdd(opt.block);
            onClose();
          }}
          className="flex items-center gap-3 w-full px-2.5 py-1.5 text-left text-sm text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors"
        >
          <span className="text-nokturo-500 dark:text-nokturo-400">{opt.icon}</span>
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}

// ── Single block renderer ────────────────────────────────────────
function BlockRenderer({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveBlock,
  onDragStart,
  onDragEnd,
  onDragOver,
  onUploadImage,
  onToast,
  isDragging,
  isDragOver,
  headingFont,
  h3Large = false,
}: {
  block: RichTextBlock;
  index: number;
  total: number;
  onUpdate: (id: string, data: Partial<RichTextBlock>) => void;
  onRemove: (id: string) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onDragOver: (index: number | null) => void;
  onUploadImage: (file: File) => Promise<string>;
  isDragging?: boolean;
  isDragOver?: boolean;
  onToast: (t: ToastData) => void;
  headingFont?: HeadingFontFamily;
  h3Large?: boolean;
}) {
  const { t } = useTranslation();
  const paraRef = useRef<HTMLDivElement>(null);
  const [gridHoveredRow, setGridHoveredRow] = useState<number | null>(null);
  const [gridHoveredCol, setGridHoveredCol] = useState<number | null>(null);
  const [gridFocusedCell, setGridFocusedCell] = useState<number | null>(null);
  const [focusListItemIndex, setFocusListItemIndex] = useState<number | null>(null);

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    paraRef.current?.focus();
  };

  const handleLink = () => {
    const url = prompt(t('richText.enterUrl'));
    if (url) execFormat('createLink', url);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(null);
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (fromIndex !== index) onMoveBlock(fromIndex, index);
  };

  return (
    <div
      data-block-id={block.id}
      className={`group flex gap-2 items-start transition-opacity ${
        isDragging ? 'opacity-50' : ''
      } ${isDragOver ? 'bg-nokturo-50/50 dark:bg-nokturo-700/50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag handle + add/delete */}
      <div className="flex flex-col items-center gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 -m-0.5 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
          title={t('richText.dragToReorder')}
        >
          <GripVertical size={14} className="text-nokturo-400 dark:text-nokturo-500 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          className="p-0.5 rounded text-nokturo-400 dark:text-nokturo-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
          title={t('common.delete')}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        {block.type === 'heading' && (
          <div className="mb-4">
            <div className="flex items-center gap-1 mb-2">
              {([1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    if (block.level === lvl) {
                      onUpdate(block.id, { type: 'paragraph', size: 'normal', content: block.text });
                    } else {
                      onUpdate(block.id, { level: lvl });
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    block.level === lvl
                      ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                      : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                  }`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
            {(() => {
              const isHeadline = headingFont !== 'body';
              const hf = isHeadline ? 'font-headline' : 'font-body';
              const h3Size = h3Large ? 'text-[32px]' : 'text-[20px]';
              const sizeClass =
                block.level === 1
                  ? isHeadline
                    ? 'text-[48px]'
                    : 'text-[30px]'
                  : block.level === 2
                    ? isHeadline
                      ? 'text-[40px]'
                      : 'text-[24px]'
                    : h3Size;
              const levelClass = {
                1: `${hf} w-full ${sizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-300 dark:placeholder:text-nokturo-500 leading-[1.1]`,
                2: `${hf} w-full ${sizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-300 dark:placeholder:text-nokturo-500 leading-[1.2]`,
                3: `${hf} w-full ${sizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-300 dark:placeholder:text-nokturo-500`,
              }[block.level];
              return (
                <input
                  type="text"
                  value={block.text}
                  onChange={(e) => onUpdate(block.id, { text: e.target.value })}
                  placeholder={t('richText.headingPlaceholder')}
                  className={levelClass}
                />
              );
            })()}
          </div>
        )}

        {block.type === 'paragraph' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <FormattingBar
              onBold={() => execFormat('bold')}
              onItalic={() => execFormat('italic')}
              onLink={handleLink}
              isBold={document.queryCommandState?.('bold') ?? false}
              isItalic={document.queryCommandState?.('italic') ?? false}
              />
              <div className="flex gap-1">
                {(['normal', 'large', 'small'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onUpdate(block.id, { size: sz })}
                    className={`px-2 py-0.5 rounded text-xs ${
                      block.size === sz
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                    }`}
                  >
                    {sz === 'normal' ? t('richText.paragraphNormal') : sz === 'large' ? t('richText.paragraphLarge') : t('richText.paragraphSmall')}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((al) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => onUpdate(block.id, { align: al })}
                    className={`p-0.5 rounded ${
                      (block.align ?? 'left') === al
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                    }`}
                    title={t(`richText.align${al === 'left' ? 'Left' : al === 'center' ? 'Center' : 'Right'}`)}
                  >
                    {al === 'left' ? <AlignLeft size={14} /> : al === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                  </button>
                ))}
              </div>
            </div>
            <div className={(block.align ?? 'left') === 'center' ? 'text-center' : (block.align ?? 'left') === 'right' ? 'text-right' : 'text-left'}>
              <EditableParagraph
                ref={paraRef}
                content={block.content}
                size={block.size}
                onSave={(html) => onUpdate(block.id, { content: html })}
              />
            </div>
          </div>
        )}

        {block.type === 'quote' && (
          <blockquote className="font-body mb-4 pl-4 text-nokturo-600 dark:text-nokturo-400 italic">
            <textarea
              value={block.text}
              onChange={(e) => onUpdate(block.id, { text: e.target.value })}
              placeholder={t('richText.quotePlaceholder')}
              className="w-full bg-transparent border-0 focus:ring-0 resize-none min-h-[60px] placeholder:text-nokturo-400 dark:placeholder:text-nokturo-500"
              rows={2}
            />
          </blockquote>
        )}

        {block.type === 'list' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {(['bullet', 'numbered'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onUpdate(block.id, { style: st })}
                  className={`px-2 py-1 rounded text-sm ${
                    block.style === st
                      ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                      : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                  }`}
                >
                  {st === 'bullet' ? t('richText.bulletList') : t('richText.numberedList')}
                </button>
              ))}
            </div>
            <div className="space-y-1 pl-2">
              {(block.items?.length ? block.items : ['']).map((item, i) => (
                <div key={i} className="flex items-start gap-2 group/list-item">
                  <span className="text-nokturo-400 dark:text-nokturo-500 text-sm shrink-0 w-4 pt-[2px]">
                    {block.style === 'numbered' ? `${i + 1}.` : '•'}
                  </span>
                  <EditableListItem
                    html={item}
                    placeholder={t('richText.listItemPlaceholder')}
                    onSave={(html) => {
                      const next = [...(block.items || [''])];
                      next[i] = html;
                      onUpdate(block.id, { items: next });
                    }}
                    onEnter={() => {
                      const next = [...(block.items || [''])];
                      next.splice(i + 1, 0, '');
                      onUpdate(block.id, { items: next });
                      setFocusListItemIndex(i + 1);
                    }}
                    onBackspaceEmpty={() => {
                      if ((block.items || ['']).length > 1) {
                        const next = (block.items || ['']).filter((_, j) => j !== i);
                        onUpdate(block.id, { items: next });
                      }
                    }}
                    autoFocus={focusListItemIndex === i}
                    onFocused={() => setFocusListItemIndex(null)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (block.items || ['']).filter((_, j) => j !== i);
                      onUpdate(block.id, { items: next.length ? next : [''] });
                    }}
                    className="p-0.5 rounded text-nokturo-400 dark:text-nokturo-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover/list-item:opacity-100"
                    title={t('common.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdate(block.id, { items: [...(block.items || ['']), ''] })}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300"
              >
                <Plus size={12} />
                {t('richText.addListItem')}
              </button>
            </div>
          </div>
        )}

        {block.type === 'image' && (
          <div className="mb-4">
            {block.url ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {(['fill', 'hug'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onUpdate(block.id, { fit: f })}
                      className={`px-2 py-1 rounded text-sm ${
                        (block.fit ?? 'fill') === f
                          ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                          : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                      }`}
                    >
                      {t(`richText.image${f === 'fill' ? 'Fill' : 'Hug'}`)}
                    </button>
                  ))}
                </div>
                <div className="relative group/img">
                  <img
                    src={block.url}
                    alt={block.alt || ''}
                    className={(block.fit ?? 'fill') === 'fill' ? 'w-full object-cover' : 'w-auto max-w-full h-auto block'}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="px-3 py-1.5 bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100 text-sm cursor-pointer hover:bg-nokturo-50 dark:hover:bg-nokturo-600">
                    {t('richText.changeImage')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await onUploadImage(f);
                          onUpdate(block.id, { url });
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onUpdate(block.id, { url: '' })}
                    className="px-3 py-1.5 bg-white dark:bg-nokturo-700 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    {t('common.delete')}
                  </button>
                </div>
                </div>
                <input
                  type="text"
                  value={block.caption ?? ''}
                  onChange={(e) => onUpdate(block.id, { caption: e.target.value })}
                  placeholder={t('richText.captionPlaceholder')}
                  className="mt-1.5 w-full text-xs text-nokturo-700 dark:text-nokturo-300 px-2 py-1.5 rounded bg-white dark:bg-nokturo-800 placeholder:text-nokturo-400 dark:placeholder:text-nokturo-500 focus:ring-1 focus:ring-nokturo-400 dark:focus:ring-nokturo-500 focus:outline-none"
                />
              </>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors">
                <ImageIcon size={24} className="text-nokturo-400 dark:text-nokturo-500 mb-1" />
                <span className="text-sm text-nokturo-500 dark:text-nokturo-400">{t('richText.uploadImage')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        const url = await onUploadImage(f);
                        onUpdate(block.id, { url });
                        onToast({ type: 'success', message: t('moodboard.imageAdded') });
                      } catch {
                        onToast({ type: 'error', message: t('richText.uploadError') });
                      }
                    }
                  }}
                />
              </label>
            )}
          </div>
        )}

        {block.type === 'gallery' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.columns')}:</span>
              <div className="flex items-center gap-1">
                {([2, 3, 4] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdate(block.id, { columns: c })}
                    className={`size-7 flex items-center justify-center rounded text-sm ${
                      block.columns === c
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
              }}
            >
              {block.images.map((img, i) => (
                <div key={i} className="relative group/gal">
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.alt || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    value={img.caption ?? ''}
                    onChange={(e) => {
                      const next = [...block.images];
                      next[i] = { ...next[i], caption: e.target.value };
                      onUpdate(block.id, { images: next });
                    }}
                    placeholder={t('richText.captionPlaceholder')}
                    className="mt-1 w-full text-xs text-nokturo-700 dark:text-nokturo-300 px-2 py-1.5 rounded bg-white dark:bg-nokturo-800 placeholder:text-nokturo-400 dark:placeholder:text-nokturo-500 focus:ring-1 focus:ring-nokturo-400 dark:focus:ring-nokturo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = block.images.filter((_, j) => j !== i);
                      onUpdate(block.id, { images: next });
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white opacity-0 group-hover/gal:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <label className="aspect-square flex flex-col items-center justify-center cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors">
                <Plus size={20} className="text-nokturo-400 dark:text-nokturo-500" />
                <span className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-0.5">{t('richText.addToGallery')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        const url = await onUploadImage(f);
                        onUpdate(block.id, {
                          images: [...block.images, { url }],
                        });
                        onToast({ type: 'success', message: t('moodboard.imageAdded') });
                      } catch {
                        onToast({ type: 'error', message: t('richText.uploadError') });
                      }
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {block.type === 'imageGrid' && (
          <div className="mb-4">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.columns')}:</span>
              <div className="flex items-center gap-1">
                {([2, 3, 4] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdate(block.id, { columns: c })}
                    className={`size-7 flex items-center justify-center rounded text-sm ${
                      block.columns === c
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.aspectRatio')}:</span>
              <select
                value={block.aspectRatio ?? '1:1'}
                onChange={(e) => onUpdate(block.id, { aspectRatio: e.target.value as '5:4' | '1:1' | '3:2' | '16:9' })}
                className="px-2 py-0.5 text-sm rounded border border-nokturo-200 dark:border-nokturo-600 bg-white dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100"
              >
                <option value="5:4">{t('richText.aspectRatio54')}</option>
                <option value="1:1">{t('richText.aspectRatio11')}</option>
                <option value="3:2">{t('richText.aspectRatio32')}</option>
                <option value="16:9">{t('richText.aspectRatio169')}</option>
              </select>
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.gapRow')} (px):</span>
              <input
                type="number"
                min={0}
                value={block.gapRow ?? 8}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                  const update: { gapRow: number; gapCol?: number } = { gapRow: v };
                  if (block.gapLocked ?? true) update.gapCol = v;
                  onUpdate(block.id, update);
                }}
                className="w-14 px-2 py-0.5 text-sm rounded border border-nokturo-200 dark:border-nokturo-600 bg-white dark:bg-nokturo-800"
              />
              <button
                type="button"
                onClick={() => onUpdate(block.id, { gapLocked: !(block.gapLocked ?? true) })}
                className={`p-0.5 rounded ${
                  (block.gapLocked ?? true)
                    ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                    : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                }`}
                title={t((block.gapLocked ?? true) ? 'richText.gapLocked' : 'richText.gapUnlocked')}
              >
                {(block.gapLocked ?? true) ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.gapCol')} (px):</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={block.gapCol ?? 8}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const update: { gapCol: number; gapRow?: number } = { gapCol: v };
                    if (block.gapLocked ?? true) update.gapRow = v;
                    onUpdate(block.id, update);
                  }}
                  disabled={block.gapLocked ?? true}
                  className="w-14 px-2 py-0.5 text-sm rounded border border-nokturo-200 dark:border-nokturo-600 bg-white dark:bg-nokturo-800 disabled:opacity-100"
                />
                {(block.gapLocked ?? true) && (
                  <div
                    className="absolute inset-0 cursor-not-allowed rounded pointer-events-auto bg-white/60 dark:bg-nokturo-800/60"
                    aria-hidden
                  />
                )}
              </div>
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
                gap: `${block.gapRow ?? 8}px ${block.gapCol ?? 8}px`,
              }}
            >
              {block.images.map((img, i) => (
                <div key={i} className="relative group/imgrid">
                  <div className={`overflow-hidden ${getAspectClass(block.aspectRatio)}`}>
                    <img
                      src={img.url}
                      alt={img.alt || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    value={img.caption ?? ''}
                    onChange={(e) => {
                      const next = [...block.images];
                      next[i] = { ...next[i], caption: e.target.value };
                      onUpdate(block.id, { images: next });
                    }}
                    placeholder={t('richText.captionPlaceholder')}
                    className="mt-1 w-full text-xs text-nokturo-700 dark:text-nokturo-300 px-2 py-1.5 rounded bg-white dark:bg-nokturo-800 placeholder:text-nokturo-400 dark:placeholder:text-nokturo-500 focus:ring-1 focus:ring-nokturo-400 dark:focus:ring-nokturo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = block.images.filter((_, j) => j !== i);
                      onUpdate(block.id, { images: next });
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white opacity-0 group-hover/imgrid:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <label
                className={`flex flex-col items-center justify-center cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors border border-dashed border-nokturo-300 dark:border-nokturo-600 rounded ${getAspectClass(block.aspectRatio)}`}
                style={{ minHeight: 80 }}
              >
                <Plus size={20} className="text-nokturo-400 dark:text-nokturo-500" />
                <span className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-0.5">{t('richText.addToGallery')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        const url = await onUploadImage(f);
                        onUpdate(block.id, {
                          images: [...block.images, { url }],
                        });
                        onToast({ type: 'success', message: t('moodboard.imageAdded') });
                      } catch {
                        onToast({ type: 'error', message: t('richText.uploadError') });
                      }
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {block.type === 'grid' && (() => {
          const cols = Math.max(1, block.columns ?? 1);
          const rows = Math.max(1, block.rows ?? 1);
          const headerRowCount = block.headerRowCount ?? 0;
          const headerColumnCount = block.headerColumnCount ?? 0;
          const cells = block.cells ?? [];
          const totalCells = rows * cols;
          const normalizedCells = Array(totalCells)
            .fill(null)
            .map((_, i) => cells[i] ?? { type: 'text' as const, content: '' });

          const addRow = () => {
            const newCells = [...normalizedCells, ...Array(cols).fill(null).map(() => ({ type: 'text' as const, content: '' }))];
            onUpdate(block.id, { rows: rows + 1, cells: newCells });
          };
          const addColumnAt = (position: number) => {
            const newCells: { type: 'text' | 'image'; content: string }[] = [];
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols + 1; c++) {
                if (c === position) {
                  newCells.push({ type: 'text', content: '' });
                } else {
                  const origCol = c < position ? c : c - 1;
                  newCells.push(normalizedCells[r * cols + origCol]);
                }
              }
            }
            onUpdate(block.id, { columns: cols + 1, cells: newCells });
          };
          const addHeaderRow = () => {
            if (headerRowCount >= 1) return;
            const headerCells = Array(cols).fill(null).map(() => ({ type: 'text' as const, content: '' }));
            const newCells = [...headerCells, ...normalizedCells];
            onUpdate(block.id, { rows: rows + 1, headerRowCount: 1, cells: newCells });
          };
          const removeHeaderRow = () => {
            if (headerRowCount === 0) return;
            onUpdate(block.id, { headerRowCount: 0 });
          };
          const addHeaderColumn = () => {
            if (headerColumnCount >= 1) return;
            const newCells: { type: 'text' | 'image'; content: string }[] = [];
            for (let r = 0; r < rows; r++) {
              newCells.push({ type: 'text', content: '' });
              for (let c = 0; c < cols; c++) {
                newCells.push(normalizedCells[r * cols + c]);
              }
            }
            onUpdate(block.id, { columns: cols + 1, headerColumnCount: 1, cells: newCells });
          };
          const removeHeaderColumn = () => {
            if (headerColumnCount === 0) return;
            onUpdate(block.id, { headerColumnCount: 0 });
          };
          const deleteRow = (rowIdx: number) => {
            if (rows <= 1) return;
            const newCells = normalizedCells.filter((_, i) => Math.floor(i / cols) !== rowIdx);
            const newHeaderCount = headerRowCount > 0 && rowIdx < headerRowCount ? headerRowCount - 1 : headerRowCount;
            onUpdate(block.id, { rows: rows - 1, headerRowCount: newHeaderCount, cells: newCells });
          };
          const deleteColumn = (colIdx: number) => {
            if (cols <= 1) return;
            const newCells = normalizedCells.filter((_, i) => i % cols !== colIdx);
            const newHeaderColCount = headerColumnCount > 0 && colIdx < headerColumnCount ? headerColumnCount - 1 : headerColumnCount;
            onUpdate(block.id, { columns: cols - 1, headerColumnCount: newHeaderColCount, cells: newCells });
          };

          return (
          <div className="mb-4">
            {/* Header toggles — always visible */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {gridFocusedCell !== null && (
                <>
                  <FormattingBar
                    onBold={() => execFormat('bold')}
                    onItalic={() => execFormat('italic')}
                    onLink={handleLink}
                    isBold={document.queryCommandState?.('bold') ?? false}
                    isItalic={document.queryCommandState?.('italic') ?? false}
                  />
                  <div className="h-4 w-px bg-nokturo-200 dark:bg-nokturo-600" />
                </>
              )}
              <button
                type="button"
                onClick={headerRowCount === 0 ? addHeaderRow : removeHeaderRow}
                className={`px-2 py-0.5 rounded text-xs ${
                  headerRowCount > 0
                    ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                    : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                }`}
              >
                {t('richText.addHeaderRow')}
              </button>
              <button
                type="button"
                onClick={headerColumnCount === 0 ? addHeaderColumn : removeHeaderColumn}
                className={`px-2 py-0.5 rounded text-xs ${
                  headerColumnCount > 0
                    ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                    : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                }`}
              >
                {t('richText.addHeaderColumn')}
              </button>
            </div>
            <div className="flex items-stretch">
              {/* Add column left */}
              <button
                type="button"
                onClick={() => addColumnAt(0)}
                className="group/addcol flex items-center justify-center w-6 shrink-0 border border-r-0 border-dashed border-nokturo-300 dark:border-nokturo-600 rounded-l-md opacity-0 hover:opacity-100 focus:opacity-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-all"
                title={t('richText.addColumn')}
              >
                <Plus size={12} className="text-nokturo-400 dark:text-nokturo-500 group-hover/addcol:text-nokturo-600 dark:group-hover/addcol:text-nokturo-300" />
              </button>
              {/* Table + add row */}
              <div className="flex-1 min-w-0 flex flex-col">
                {/* Main table */}
                <div
                  className="border border-nokturo-200 dark:border-nokturo-600 overflow-hidden flex min-w-0"
                  onMouseLeave={() => { setGridHoveredRow(null); setGridHoveredCol(null); }}
                >
                  {/* Row delete handles - left */}
                  <div className="flex flex-col shrink-0 border-r border-nokturo-200 dark:border-nokturo-600 bg-nokturo-50/50 dark:bg-nokturo-700/50">
                    {Array.from({ length: rows }, (_, r) => (
                      <div
                        key={r}
                        className="flex items-center justify-center min-h-[36px] w-7 border-b border-nokturo-200 dark:border-nokturo-600 last:border-b-0"
                        onMouseEnter={() => setGridHoveredRow(r)}
                      >
                        {rows > 1 && (gridHoveredRow === r) && (
                          <button
                            type="button"
                            onClick={() => deleteRow(r)}
                            className="p-1 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                            title={t('richText.deleteRow')}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Grid + column delete handles */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, minmax(80px, 1fr))`,
                      }}
                    >
                      {normalizedCells.map((cell, i) => {
                    const rowIdx = Math.floor(i / cols);
                    const colIdx = i % cols;
                    const isHeaderRow = headerRowCount > 0 && rowIdx < headerRowCount;
                    const isHeaderCol = headerColumnCount > 0 && colIdx < headerColumnCount;
                    const isHeader = isHeaderRow || isHeaderCol;
                    const isLastHeaderCol = headerColumnCount > 0 && colIdx === headerColumnCount - 1;
                    return (
                      <div
                        key={i}
                        className={`border-b border-nokturo-200 dark:border-nokturo-600 ${
                          colIdx === cols - 1
                            ? 'border-r-0'
                            : isLastHeaderCol
                              ? 'border-r-2 border-r-nokturo-300 dark:border-r-nokturo-500'
                              : 'border-r border-r-nokturo-200 dark:border-r-nokturo-600'
                        } ${
                          rowIdx === rows - 1 ? 'border-b-0' : ''
                        } ${isHeader ? 'bg-nokturo-100 dark:bg-nokturo-700 font-semibold' : 'bg-white dark:bg-nokturo-800'}`}
                        onMouseEnter={() => { setGridHoveredRow(rowIdx); setGridHoveredCol(colIdx); }}
                      >
                        <div className="min-h-[36px] p-1.5 group/cell relative">
                          {cell.type === 'text' ? (
                            <GridCell
                              content={cell.content}
                              isHeader={isHeader}
                              placeholder={t('richText.gridCellTextPlaceholder')}
                              onSave={(html) => {
                                const next = [...normalizedCells];
                                next[i] = { ...cell, content: html };
                                onUpdate(block.id, { cells: next });
                              }}
                              onFocus={() => setGridFocusedCell(i)}
                              onBlur={() => setGridFocusedCell(null)}
                            />
                          ) : (
                            <div className="min-h-[32px]">
                              {cell.content ? (
                                <div className="relative group/img">
                                  <img src={cell.content} alt="" className="w-full h-8 object-cover" />
                                  <label className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center cursor-pointer text-white text-xs">
                                    {t('richText.changeImage')}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                          try {
                                            const url = await onUploadImage(f);
                                            const next = [...normalizedCells];
                                            next[i] = { type: 'image', content: url, caption: cell.caption };
                                            onUpdate(block.id, { cells: next });
                                            onToast({ type: 'success', message: t('moodboard.imageAdded') });
                                          } catch {
                                            onToast({ type: 'error', message: t('richText.uploadError') });
                                          }
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <label className="flex items-center justify-center w-full h-8 cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 text-xs">
                                  <ImageIcon size={14} className="mr-1" />
                                  {t('richText.uploadImage')}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        try {
                                          const url = await onUploadImage(f);
                                          const next = [...normalizedCells];
                                          next[i] = { type: 'image', content: url };
                                          onUpdate(block.id, { cells: next });
                                          onToast({ type: 'success', message: t('moodboard.imageAdded') });
                                        } catch {
                                          onToast({ type: 'error', message: t('richText.uploadError') });
                                        }
                                      }
                                    }}
                                  />
                                </label>
                              )}
                              {cell.content && (
                                <input
                                  type="text"
                                  value={cell.caption ?? ''}
                                  onChange={(e) => {
                                    const next = [...normalizedCells];
                                    next[i] = { ...cell, caption: e.target.value };
                                    onUpdate(block.id, { cells: next });
                                  }}
                                  placeholder={t('richText.captionPlaceholder')}
                                  className="mt-0.5 w-full text-[10px] text-nokturo-700 dark:text-nokturo-300 px-1.5 py-0.5 rounded bg-white dark:bg-nokturo-800 placeholder:text-nokturo-400 dark:placeholder:text-nokturo-500 focus:ring-1 focus:ring-nokturo-400 dark:focus:ring-nokturo-500 focus:outline-none"
                                />
                              )}
                            </div>
                          )}
                          <div className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 flex gap-0.5">
                            {(['text', 'image'] as const).map((tipo) => (
                              <button
                                key={tipo}
                                type="button"
                                onClick={() => {
                                  const next = [...normalizedCells];
                                  next[i] = { type: tipo, content: '' };
                                  onUpdate(block.id, { cells: next });
                                }}
                                className={`p-0.5 rounded text-[10px] ${
                                  cell.type === tipo ? 'bg-nokturo-200 dark:bg-nokturo-600' : 'bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                                }`}
                                title={tipo === 'text' ? t('richText.paragraph') : t('richText.image')}
                              >
                                {tipo === 'text' ? <Type size={10} /> : <ImageIcon size={10} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                    {/* Column delete handles - bottom */}
                    {cols > 1 && (
                      <div
                        className="flex border-t border-nokturo-200 dark:border-nokturo-600 bg-nokturo-50/50 dark:bg-nokturo-700/50"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${cols}, minmax(80px, 1fr))`,
                        }}
                      >
                        {Array.from({ length: cols }, (_, c) => (
                          <div
                            key={c}
                            className="flex items-center justify-center min-h-[28px] border-r border-nokturo-200 dark:border-nokturo-600 last:border-r-0"
                            onMouseEnter={() => setGridHoveredCol(c)}
                          >
                            {(gridHoveredCol === c) && (
                              <button
                                type="button"
                                onClick={() => deleteColumn(c)}
                                className="p-1 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                title={t('richText.deleteColumn')}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Add row below */}
                <button
                  type="button"
                  onClick={addRow}
                  className="group/addrow flex items-center justify-center h-6 w-full shrink-0 border border-t-0 border-dashed border-nokturo-300 dark:border-nokturo-600 rounded-b-md opacity-0 hover:opacity-100 focus:opacity-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-all"
                  title={t('richText.addRow')}
                >
                  <Plus size={12} className="text-nokturo-400 dark:text-nokturo-500 group-hover/addrow:text-nokturo-600 dark:group-hover/addrow:text-nokturo-300" />
                </button>
              </div>
              {/* Add column right */}
              <button
                type="button"
                onClick={() => addColumnAt(cols)}
                className="group/addcol flex items-center justify-center w-6 shrink-0 border border-l-0 border-dashed border-nokturo-300 dark:border-nokturo-600 rounded-r-md opacity-0 hover:opacity-100 focus:opacity-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-all"
                title={t('richText.addColumn')}
              >
                <Plus size={12} className="text-nokturo-400 dark:text-nokturo-500 group-hover/addcol:text-nokturo-600 dark:group-hover/addcol:text-nokturo-300" />
              </button>
            </div>
          </div>
          );
        })()}

        {block.type === 'link' && (
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={block.text}
              onChange={(e) => onUpdate(block.id, { text: e.target.value })}
              placeholder={t('richText.linkTextPlaceholder')}
              className={`flex-1 min-w-[120px] ${INPUT_CLASS}`}
            />
            <input
              type="url"
              value={block.url}
              onChange={(e) => onUpdate(block.id, { url: e.target.value })}
              placeholder={t('richText.linkUrlPlaceholder')}
              className={`flex-1 min-w-[180px] ${INPUT_CLASS}`}
            />
          </div>
        )}

        {block.type === 'divider' && (
          <div className="my-6 py-2">
            <hr className="border-0 border-t border-nokturo-300 dark:border-nokturo-600" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main editor ──────────────────────────────────────────────────
export type HeadingFontFamily = 'headline' | 'body';

export interface RichTextBlockEditorProps {
  value: RichTextBlock[];
  onChange: (blocks: RichTextBlock[]) => void;
  onUploadImage: (file: File) => Promise<string>;
  onToast: (t: ToastData) => void;
  /** Optional: show heading size selector for heading blocks */
  showHeadingSizes?: boolean;
  /** Optional: show paragraph size selector */
  showParagraphSizes?: boolean;
  /** Which font family to use for headings: 'headline' = IvyPresto, 'body' = Inter */
  headingFont?: HeadingFontFamily;
  /** When true, H3 uses 32px (About Nokturo); otherwise 20px */
  h3Large?: boolean;
}

export function RichTextBlockEditor({
  value,
  onChange,
  onUploadImage,
  onToast,
  headingFont = 'headline',
  h3Large = false,
}: RichTextBlockEditorProps) {
  const { t } = useTranslation();
  const [addMenuAtIndex, setAddMenuAtIndex] = useState<number | null>(null);
  const blocks = value?.length ? value : [];
  const undoableAdditionsRef = useRef<Set<string>>(new Set());
  const lastAddedBlockIdRef = useRef<string | null>(null);

  const updateBlock = useCallback(
    (id: string, data: Partial<RichTextBlock>) => {
      const nextBlocks = blocks.map((b) => {
        if (b.id !== id) return b;
        if (data.type && data.type !== b.type) {
          return { id: b.id, ...data } as RichTextBlock;
        }
        return { ...b, ...data } as RichTextBlock;
      });
      const updated = nextBlocks.find((b) => b.id === id);
      if (updated && !isBlockEmpty(updated)) {
        undoableAdditionsRef.current.delete(id);
        if (lastAddedBlockIdRef.current === id) lastAddedBlockIdRef.current = null;
      }
      onChange(nextBlocks);
    },
    [blocks, onChange],
  );

  const removeBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onChange],
  );

  const addBlock = useCallback(
    (block: RichTextBlock, afterIndex?: number) => {
      const idx = afterIndex ?? blocks.length;
      const next = [...blocks];
      next.splice(idx, 0, block);
      onChange(next);
    },
    [blocks, onChange],
  );

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const next = [...blocks];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      onChange(next);
    },
    [blocks, onChange],
  );

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleAddBlock = (idx: number) => {
    setAddMenuAtIndex((prev) => (prev === idx ? null : idx));
  };

  const handleAddFromMenu = (block: RichTextBlock) => {
    if (addMenuAtIndex !== null) {
      addBlock(block, addMenuAtIndex);
      undoableAdditionsRef.current.add(block.id);
      lastAddedBlockIdRef.current = block.id;
      setAddMenuAtIndex(null);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'z') || e.shiftKey) return;
      const target = e.target as Element | null;
      if (!target?.closest) return;
      const editorRoot = target.closest('[data-rich-text-editor]');
      if (!editorRoot) return;
      const blockEl = target.closest('[data-block-id]');
      let blockId = blockEl?.getAttribute('data-block-id');
      if (!blockId && lastAddedBlockIdRef.current) {
        blockId = lastAddedBlockIdRef.current;
      }
      if (!blockId || !undoableAdditionsRef.current.has(blockId)) return;
      const block = blocks.find((b) => b.id === blockId);
      if (!block || !isBlockEmpty(block)) return;
      e.preventDefault();
      e.stopPropagation();
      undoableAdditionsRef.current.delete(blockId);
      lastAddedBlockIdRef.current = null;
      removeBlock(blockId);
    },
    [blocks, removeBlock],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return (
    <div className="space-y-0" data-rich-text-editor>
      {blocks.length === 0 ? (
        <div className="relative flex flex-col items-center py-12">
          <div className="relative">
            <button
              type="button"
              onClick={() => handleAddBlock(0)}
              className="flex items-center gap-2 px-4 py-2 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
            >
              <Plus size={18} />
              {t('richText.addBlock')}
            </button>
            {addMenuAtIndex === 0 && (
              <div className="absolute left-0 top-full mt-1 z-50">
                <AddBlockMenu
                  onAdd={handleAddFromMenu}
                  onClose={() => setAddMenuAtIndex(null)}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {blocks.map((block, index) => (
            <div key={block.id}>
              <BlockRenderer
                block={block}
                index={index}
                total={blocks.length}
                onUpdate={updateBlock}
                onRemove={removeBlock}
                onMoveBlock={moveBlock}
                onDragStart={() => setDraggingIndex(index)}
                onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }}
                onDragOver={(idx) => setDragOverIndex(idx)}
                isDragging={draggingIndex === index}
                isDragOver={dragOverIndex === index}
                onUploadImage={onUploadImage}
                onToast={onToast}
                headingFont={headingFont}
                h3Large={h3Large}
              />
              <div className="relative flex justify-center py-1">
                <button
                  type="button"
                  onClick={() => handleAddBlock(index + 1)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors"
                >
                  <Plus size={12} />
                  {t('richText.addBlock')}
                </button>
                {addMenuAtIndex === index + 1 && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50">
                    <AddBlockMenu
                      onAdd={handleAddFromMenu}
                      onClose={() => setAddMenuAtIndex(null)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
