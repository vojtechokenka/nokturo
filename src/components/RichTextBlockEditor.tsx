/**
 * Webflow-style Rich Text Block Editor
 * Blocks: 3 headings, 2 paragraphs (with link/bold/italic), quote, image, gallery, grid, link, divider
 */
import { useState, useCallback, useRef, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from './icons/MaterialIcon';
import { NokturoIcon } from './icons/NokturoIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import type { ToastData } from './Toast';
import { INPUT_CLASS } from '../lib/inputStyles';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

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
  | { id: string; type: 'list'; style: 'bullet' | 'numbered'; items: string[] }
  | { id: string; type: 'tag'; text: string; visible?: boolean };

function generateId() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function blockToText(block: RichTextBlock): string {
  switch (block.type) {
    case 'heading':
      return block.text ?? '';
    case 'paragraph':
      return stripHtml(block.content ?? '');
    case 'quote':
      return block.text ?? '';
    case 'list':
      return (block.items ?? []).map((item) => stripHtml(item)).join('\n').trim();
    case 'link':
      return (block.text || block.url || '').trim();
    case 'tag':
      return block.text ?? '';
    default:
      return '';
  }
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function duplicateBlockData(block: RichTextBlock): RichTextBlock {
  const id = generateId();
  switch (block.type) {
    case 'heading':
      return { id, type: 'heading', level: block.level, text: block.text };
    case 'paragraph':
      return { id, type: 'paragraph', size: block.size, align: block.align, content: block.content };
    case 'quote':
      return { id, type: 'quote', text: block.text };
    case 'image':
      return { id, type: 'image', url: block.url, alt: block.alt, fit: block.fit, caption: block.caption };
    case 'gallery':
      return { id, type: 'gallery', columns: block.columns, images: block.images.map((img) => ({ ...img })) };
    case 'imageGrid':
      return {
        id,
        type: 'imageGrid',
        columns: block.columns,
        gapRow: block.gapRow,
        gapCol: block.gapCol,
        gapLocked: block.gapLocked,
        aspectRatio: block.aspectRatio,
        images: block.images.map((img) => ({ ...img })),
      };
    case 'grid':
      return {
        id,
        type: 'grid',
        columns: block.columns,
        rows: block.rows,
        headerRowCount: block.headerRowCount,
        headerColumnCount: block.headerColumnCount,
        cells: block.cells.map((c) => ({ ...c })),
      };
    case 'link':
      return { id, type: 'link', url: block.url, text: block.text };
    case 'divider':
      return { id, type: 'divider' };
    case 'list':
      return { id, type: 'list', style: block.style, items: [...block.items] };
    case 'tag':
      return { id, type: 'tag', text: block.text, visible: block.visible };
    default:
      return block;
  }
}

export function isBlockEmpty(block: RichTextBlock): boolean {
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
    case 'tag':
      return !block.text?.trim();
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

  const sizeClass = size === 'large' ? 'text-rta-p-l text-nokturo-900/90 dark:text-white/90' : size === 'small' ? 'text-rta-p-s text-nokturo-900/70 dark:text-white/70' : 'text-rta-p-m text-nokturo-900/80 dark:text-white/80';
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

// ── Block menu icons (custom SVGs) ───────────────────────────────
const AddBlockIcons = {
  heading: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M7 20V7H2V4h13v3h-5v13zm9 0v-8h-3V9h9v3h-3v8z"/></svg>,
  paragraph: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M9 20v-6q-2.075 0-3.537-1.463T4 9t1.463-3.537T9 4h9v2h-2v14h-2V6h-3v14z"/></svg>,
  tag: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M2 20V4h14l6 8l-6 8z"/></svg>,
  quote: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M5.7 18L8 14q-1.65 0-2.825-1.175T4 10t1.175-2.825T8 6t2.825 1.175T12 10q0 .575-.137 1.063T11.45 12L8 18zm9 0l2.3-4q-1.65 0-2.825-1.175T13 10t1.175-2.825T17 6t2.825 1.175T21 10q0 .575-.137 1.063T20.45 12L17 18z"/></svg>,
  bulletList: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M14 21v-8h8v8zM2 18v-2h9v2zm12-7V3h8v8zM2 8V6h9v2z"/></svg>,
  image: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M6 17h12l-3.75-5l-3 4L9 13zm-3 4V3h18v18zM9.563 9.563Q10 9.125 10 8.5t-.437-1.062T8.5 7t-1.062.438T7 8.5t.438 1.063T8.5 10t1.063-.437"/></svg>,
  gallery: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M1 19V5h14v14zm16-8V5h6v6zM4 15h8l-2.625-3.5L7.5 14l-1.375-1.825zm13 4v-6h6v6z"/></svg>,
  imageGrid: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M3 11V3h8v8zm0 10v-8h8v8zm10-10V3h8v8zm0 10v-8h8v8z"/></svg>,
  grid: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M3 21V3h18v18zm2-2h3.325v-3.325H5zm5.325 0h3.35v-3.325h-3.35zm5.35 0H19v-3.325h-3.325zM5 13.675h3.325v-3.35H5zm5.325 0h3.35v-3.35h-3.35zm5.35 0H19v-3.35h-3.325zM5 8.325h3.325V5H5zm5.325 0h3.35V5h-3.35zm5.35 0H19V5h-3.325z"/></svg>,
  link: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M11 17H7q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h4v2H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h4zm-3-4v-2h8v2zm5 4v-2h4q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-4V7h4q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"/></svg>,
  divider: <MaterialIcon name="remove" size={16} className="shrink-0" />,
};

function ToolbarIconButton({
  icon,
  title,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 w-8 rounded-[10px] flex items-center justify-center transition-colors ${
        active
          ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900'
          : 'text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-200/70 dark:hover:bg-nokturo-700/70'
      }`}
      title={title}
    >
      {icon}
    </button>
  );
}

// ── Floating bottom toolbar ──────────────────────────────────────
function FloatingToolbar({
  onBold,
  onItalic,
  onH1,
  onH2,
  onH3,
  onParagraph,
  onQuote,
  onBulletList,
  onNumberedList,
  onTag,
  onImage,
  onGallery,
  onImageGrid,
  onGrid,
  onLink,
  onDivider,
  onSizeSmall,
  onSizeNormal,
  onSizeLarge,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  isBold,
  isItalic,
  activeType,
  activeHeadingLevel,
  activeListStyle,
  activeParagraphSize,
  activeParagraphAlign,
}: {
  onBold: () => void;
  onItalic: () => void;
  onH1: () => void;
  onH2: () => void;
  onH3: () => void;
  onParagraph: () => void;
  onQuote: () => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onTag: () => void;
  onImage: () => void;
  onGallery: () => void;
  onImageGrid: () => void;
  onGrid: () => void;
  onLink: () => void;
  onDivider: () => void;
  onSizeSmall: () => void;
  onSizeNormal: () => void;
  onSizeLarge: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  isBold: boolean;
  isItalic: boolean;
  activeType: RichTextBlock['type'] | null;
  activeHeadingLevel?: HeadingLevel | null;
  activeListStyle?: 'bullet' | 'numbered' | null;
  activeParagraphSize?: ParagraphSize;
  activeParagraphAlign?: ParagraphAlign;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[65] px-2 py-1.5 rounded-2xl bg-nokturo-200/90 dark:bg-nokturo-700/90 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <span className="px-1 text-nokturo-700 dark:text-nokturo-200">
          <NokturoIcon size={8} />
        </span>
        <div className="w-px h-5 bg-nokturo-400/30 dark:bg-nokturo-400/20 mx-0.5" />

        <ToolbarIconButton icon={<MaterialIcon name="format_bold" size={16} className="shrink-0" />} title={t('richText.bold')} active={isBold} onClick={onBold} />
        <ToolbarIconButton icon={<MaterialIcon name="format_italic" size={16} className="shrink-0" />} title={t('richText.italic')} active={isItalic} onClick={onItalic} />
        <ToolbarIconButton icon={AddBlockIcons.link} title={t('richText.link')} onClick={onLink} />
        <div className="w-px h-5 bg-nokturo-400/30 dark:bg-nokturo-400/20 mx-0.5" />

        <ToolbarIconButton icon={<span className="text-[11px] font-semibold">H1</span>} title="H1" active={activeType === 'heading' && activeHeadingLevel === 1} onClick={onH1} />
        <ToolbarIconButton icon={<span className="text-[11px] font-semibold">H2</span>} title="H2" active={activeType === 'heading' && activeHeadingLevel === 2} onClick={onH2} />
        <ToolbarIconButton icon={<span className="text-[11px] font-semibold">H3</span>} title="H3" active={activeType === 'heading' && activeHeadingLevel === 3} onClick={onH3} />
        <ToolbarIconButton icon={AddBlockIcons.paragraph} title={t('richText.paragraph')} active={activeType === 'paragraph'} onClick={onParagraph} />
        <ToolbarIconButton icon={AddBlockIcons.quote} title={t('richText.quote')} active={activeType === 'quote'} onClick={onQuote} />
        <div className="w-px h-5 bg-nokturo-400/30 dark:bg-nokturo-400/20 mx-0.5" />

        <ToolbarIconButton icon={<MaterialIcon name="format_list_bulleted" size={16} className="shrink-0" />} title={t('richText.bulletList')} active={activeType === 'list' && activeListStyle === 'bullet'} onClick={onBulletList} />
        <ToolbarIconButton icon={<MaterialIcon name="format_list_numbered" size={16} className="shrink-0" />} title={t('richText.numberedList')} active={activeType === 'list' && activeListStyle === 'numbered'} onClick={onNumberedList} />
        <div className="w-px h-5 bg-nokturo-400/30 dark:bg-nokturo-400/20 mx-0.5" />

        <ToolbarIconButton icon={AddBlockIcons.tag} title={t('richText.tag')} active={activeType === 'tag'} onClick={onTag} />

        {activeType === 'paragraph' && (
          <>
            <div className="w-px h-5 bg-nokturo-400/30 dark:bg-nokturo-400/20 mx-0.5" />
            <ToolbarIconButton icon={<span className="text-[11px] font-semibold">S</span>} title="Small paragraph" active={activeParagraphSize === 'small'} onClick={onSizeSmall} />
            <ToolbarIconButton icon={<span className="text-[11px] font-semibold">M</span>} title="Normal paragraph" active={activeParagraphSize === 'normal'} onClick={onSizeNormal} />
            <ToolbarIconButton icon={<span className="text-[11px] font-semibold">L</span>} title="Large paragraph" active={activeParagraphSize === 'large'} onClick={onSizeLarge} />
            <ToolbarIconButton icon={<MaterialIcon name="format_align_left" size={16} className="shrink-0" />} title={t('richText.alignLeft')} active={(activeParagraphAlign ?? 'left') === 'left'} onClick={onAlignLeft} />
            <ToolbarIconButton icon={<MaterialIcon name="format_align_center" size={16} className="shrink-0" />} title={t('richText.alignCenter')} active={activeParagraphAlign === 'center'} onClick={onAlignCenter} />
            <ToolbarIconButton icon={<MaterialIcon name="format_align_right" size={16} className="shrink-0" />} title={t('richText.alignRight')} active={activeParagraphAlign === 'right'} onClick={onAlignRight} />
          </>
        )}

        <div className="w-px h-5 bg-nokturo-400/30 dark:bg-nokturo-400/20 mx-0.5" />
        <ToolbarIconButton icon={AddBlockIcons.image} title={t('richText.image')} onClick={onImage} />
        <ToolbarIconButton icon={AddBlockIcons.gallery} title={t('richText.gallery')} onClick={onGallery} />
        <ToolbarIconButton icon={AddBlockIcons.imageGrid} title={t('richText.imageGrid')} onClick={onImageGrid} />
        <ToolbarIconButton icon={AddBlockIcons.grid} title={t('richText.grid')} onClick={onGrid} />
        <ToolbarIconButton icon={AddBlockIcons.divider} title={t('richText.divider')} onClick={onDivider} />
      </div>
    </div>
  );
}

// ── Aspect ratio dropdown (styled to match design) ─────────────────
function AspectRatioSelect({
  value,
  onChange,
  t,
  dropdownZIndex,
}: {
  value: '5:4' | '1:1' | '3:2' | '16:9';
  onChange: (v: '5:4' | '1:1' | '3:2' | '16:9') => void;
  t: (k: string) => string;
  dropdownZIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const position = useDropdownPosition({
    open,
    triggerRef,
    minWidth: 64,
    desiredHeight: 160,
    offset: 2,
  });
  const options: { value: '5:4' | '1:1' | '3:2' | '16:9'; labelKey: string }[] = [
    { value: '5:4', labelKey: 'richText.aspectRatio54' },
    { value: '1:1', labelKey: 'richText.aspectRatio11' },
    { value: '3:2', labelKey: 'richText.aspectRatio32' },
    { value: '16:9', labelKey: 'richText.aspectRatio169' },
  ];
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inTrigger && !inDropdown) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-6 min-w-[4rem] pl-2 pr-6 text-xs rounded-[16px] bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-nokturo-500/50 focus:ring-inset"
      >
        <span>{selected ? t(selected.labelKey) : value}</span>
        <MaterialIcon name="expand_more" size={12} className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-nokturo-500 dark:text-nokturo-400 pointer-events-none transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && position && createPortal(
        <div
          ref={dropdownRef}
          className="fixed min-w-[4rem] p-1 rounded-[16px] bg-white/95 dark:bg-nokturo-800/95 backdrop-blur-sm shadow-lg overflow-hidden"
          style={{
            ...(position.top !== undefined && { top: position.top }),
            ...(position.bottom !== undefined && { bottom: position.bottom }),
            left: position.left,
            maxHeight: position.maxHeight,
            maxWidth: position.maxWidth,
            zIndex: dropdownZIndex ?? 50,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left p-1 text-xs rounded transition-colors ${
                value === opt.value
                  ? 'bg-nokturo-100 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100 font-medium'
                  : 'text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-50 dark:hover:bg-nokturo-700'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Auto-resize heading textarea ──────────────────────────────────
function AutoResizeHeadingTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);
  useEffect(() => {
    resize();
  }, [value, resize]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      placeholder={placeholder}
      rows={1}
      className={className}
    />
  );
}

// ── Block actions dropdown (Delete / Duplicate) ───────────────────
function BlockActionsDropdown(props: {
  block: RichTextBlock;
  index: number;
  onRemove: (id: string) => void;
  onDuplicate: (block: RichTextBlock, afterIndex: number) => void;
  t: (k: string) => string;
  dropdownZIndex?: number;
}) {
  void props;
  return null;
}

// ── Single block renderer ────────────────────────────────────────
function BlockRenderer({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onDuplicate,
  onUploadImage,
  onToast,
  headingFont,
  h3Large = false,
  dropdownZIndex,
  onFocusBlock,
}: {
  block: RichTextBlock;
  index: number;
  total: number;
  onUpdate: (id: string, data: Partial<RichTextBlock>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (block: RichTextBlock, afterIndex: number) => void;
  onUploadImage: (file: File) => Promise<string>;
  onToast: (t: ToastData) => void;
  headingFont?: HeadingFontFamily;
  h3Large?: boolean;
  dropdownZIndex?: number;
  onFocusBlock?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const paraRef = useRef<HTMLDivElement>(null);
  const [gridHoveredRow, setGridHoveredRow] = useState<number | null>(null);
  const [gridHoveredCol, setGridHoveredCol] = useState<number | null>(null);
  const [, setGridFocusedCell] = useState<number | null>(null);
  const [focusListItemIndex, setFocusListItemIndex] = useState<number | null>(null);
  const blockActionsProps = { block, index, onRemove, onDuplicate, t, dropdownZIndex };

  return (
    <div
      data-block-id={block.id}
      className="group flex gap-2 items-start transition-opacity"
      onFocusCapture={() => onFocusBlock?.(block.id)}
      onMouseDownCapture={() => onFocusBlock?.(block.id)}
    >
      <div className="flex-1 min-w-0">
        {block.type === 'heading' && (
          <div className="mb-4">
            {(() => {
              const isHeadline = headingFont !== 'body';
              const hf = isHeadline ? 'font-headline' : 'font-body';
              const sizeClass =
                block.level === 1
                  ? isHeadline
                    ? 'text-rta-h1'
                    : 'text-rta-std-h1'
                  : block.level === 2
                    ? isHeadline
                      ? 'text-rta-h2'
                      : 'text-rta-std-h2'
                    : isHeadline
                      ? 'text-rta-h3'
                      : 'text-rta-std-h3';
              const levelClass = {
                1: `${hf} w-full ${sizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-300 dark:placeholder:text-nokturo-500 resize-none overflow-hidden min-h-[1.5em]`,
                2: `${hf} w-full ${sizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-300 dark:placeholder:text-nokturo-500 resize-none overflow-hidden min-h-[1.5em]`,
                3: `${hf} w-full ${sizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-300 dark:placeholder:text-nokturo-500 resize-none overflow-hidden min-h-[1.5em]`,
              }[block.level];
              return (
                <AutoResizeHeadingTextarea
                  value={block.text}
                  onChange={(text) => onUpdate(block.id, { text })}
                  placeholder={t('richText.headingPlaceholder')}
                  className={levelClass}
                />
              );
            })()}
          </div>
        )}

        {block.type === 'paragraph' && (
          <div className="mb-4">
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
          <blockquote className="font-headline italic text-rta-quote text-nokturo-700 dark:text-nokturo-300 mb-4 pl-4">
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
                    className="p-0.5 rounded text-nokturo-400 dark:text-nokturo-500 hover:text-red-fg hover:bg-red/10 dark:hover:bg-red/20 opacity-0 group-hover/list-item:opacity-100"
                    title={t('common.delete')}
                  >
                    <DeleteIcon size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdate(block.id, { items: [...(block.items || ['']), ''] })}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300"
              >
                <MaterialIcon name="add" size={12} className="shrink-0" />
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
                          : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-500 dark:text-nokturo-500 opacity-85 hover:opacity-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                      }`}
                    >
                      {t(`richText.image${f === 'fill' ? 'Fill' : 'Hug'}`)}
                    </button>
                  ))}
                  <BlockActionsDropdown {...blockActionsProps} />
                </div>
                <div className="relative group/img">
                  <img
                    src={block.url}
                    alt={block.alt || ''}
                    className={(block.fit ?? 'fill') === 'fill' ? 'w-full object-cover' : 'w-auto max-w-full h-auto block'}
                  />
                  <div className="absolute inset-0 bg-page/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
                    className="dropdown-menu-item-destructive px-3 py-1.5 text-nokturo-700 dark:text-nokturo-200 text-sm hover:bg-red hover:text-red-fg"
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
              <>
                <div className="flex justify-end mb-2">
                  <BlockActionsDropdown {...blockActionsProps} />
                </div>
                <label className="flex flex-col items-center justify-center w-full h-32 cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors">
                <MaterialIcon name="image" size={24} className="text-nokturo-400 dark:text-nokturo-500 mb-1 shrink-0" />
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
              </>
            )}
          </div>
        )}

        {block.type === 'gallery' && (
          <div className="mb-4">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.columns')}:</span>
              <div className="flex items-center gap-1">
                {([2, 3, 4] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdate(block.id, { columns: c })}
                    className={`h-6 px-2 rounded-[16px] text-xs font-medium flex items-center ${
                      block.columns === c
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-500 dark:text-nokturo-500 opacity-85 hover:opacity-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <BlockActionsDropdown {...blockActionsProps} />
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
                    className="absolute top-1 right-1 p-1 bg-page/50 rounded text-white opacity-0 group-hover/gal:opacity-100"
                  >
                    <DeleteIcon size={12} />
                  </button>
                </div>
              ))}
              <label className="aspect-square flex flex-col items-center justify-center cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors">
                <MaterialIcon name="add" size={20} className="text-nokturo-400 dark:text-nokturo-500 shrink-0" />
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
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.columns')}:</span>
              <div className="flex items-center gap-1">
                {([2, 3, 4] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdate(block.id, { columns: c })}
                    className={`h-6 px-2 rounded-[16px] text-xs font-medium flex items-center ${
                      block.columns === c
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-500 dark:text-nokturo-500 opacity-85 hover:opacity-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400">{t('richText.aspectRatio')}:</span>
              <AspectRatioSelect
                value={block.aspectRatio ?? '1:1'}
                onChange={(v) => onUpdate(block.id, { aspectRatio: v })}
                t={t}
                dropdownZIndex={dropdownZIndex}
              />
              <span className="text-xs text-nokturo-500 dark:text-nokturo-400 leading-6">{t('richText.gap')}:</span>
              <div className="flex items-center gap-0.5">
                <div className="relative w-10 h-6 shrink-0 overflow-hidden" style={{ borderRadius: 6 }}>
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
                  disabled={block.gapLocked ?? true}
                  className="absolute inset-0 w-full h-full px-2 text-xs bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 disabled:opacity-100"
                  style={{ borderRadius: 6 }}
                />
                {(block.gapLocked ?? true) && (
                  <div
                    className="absolute inset-0 cursor-not-allowed pointer-events-auto bg-white/60 dark:bg-nokturo-800/60"
                    aria-hidden
                    style={{ borderRadius: 6 }}
                  />
                )}
                </div>
                <button
                  type="button"
                  onClick={() => onUpdate(block.id, { gapLocked: !(block.gapLocked ?? true) })}
                  className="w-6 h-6 flex items-center justify-center shrink-0 rounded-[16px] text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300"
                  title={t((block.gapLocked ?? true) ? 'richText.gapLocked' : 'richText.gapUnlocked')}
                >
                  {(block.gapLocked ?? true) ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M4 22V8h3V6q0-2.075 1.463-3.537T12 1t3.538 1.463T17 6v2h3v14zm9.413-5.587Q14 15.825 14 15t-.587-1.412T12 13t-1.412.588T10 15t.588 1.413T12 17t1.413-.587M9 8h6V6q0-1.25-.875-2.125T12 3t-2.125.875T9 6z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M13.413 16.413Q14 15.825 14 15t-.587-1.412T12 13t-1.412.588T10 15t.588 1.413T12 17t1.413-.587M4 22V8h9V6q0-2.075 1.463-3.537T18 1t3.538 1.463T23 6h-2q0-1.25-.875-2.125T18 3t-2.125.875T15 6v2h5v14z"/></svg>
                  )}
                </button>
                <div className="relative w-10 h-6 shrink-0 overflow-hidden" style={{ borderRadius: 6 }}>
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
                  className="absolute inset-0 w-full h-full px-2 text-xs bg-nokturo-200/60 dark:bg-nokturo-700/60 text-nokturo-900 dark:text-nokturo-100 disabled:opacity-100"
                  style={{ borderRadius: 6 }}
                />
                {(block.gapLocked ?? true) && (
                  <div
                    className="absolute inset-0 cursor-not-allowed pointer-events-auto bg-white/60 dark:bg-nokturo-800/60"
                    aria-hidden
                    style={{ borderRadius: 6 }}
                  />
                )}
                </div>
              </div>
              <BlockActionsDropdown {...blockActionsProps} />
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
                    className="absolute top-1 right-1 p-1 bg-page/50 rounded text-white opacity-0 group-hover/imgrid:opacity-100"
                  >
                    <DeleteIcon size={12} />
                  </button>
                </div>
              ))}
              <label
                className={`flex flex-col items-center justify-center cursor-pointer text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors border border-dashed border-nokturo-300 dark:border-nokturo-600 rounded ${getAspectClass(block.aspectRatio)}`}
                style={{ minHeight: 80 }}
              >
                <MaterialIcon name="add" size={20} className="text-nokturo-400 dark:text-nokturo-500 shrink-0" />
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
              <button
                type="button"
                onClick={headerRowCount === 0 ? addHeaderRow : removeHeaderRow}
                className={`h-6 px-2 rounded-[16px] text-xs flex items-center gap-1 ${
                  headerRowCount > 0
                    ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                    : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-500 dark:text-nokturo-500 opacity-85 hover:opacity-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                }`}
              >
                <MaterialIcon name="table_rows" size={12} className="shrink-0" />
                {t('richText.addHeaderRow')}
              </button>
              <button
                type="button"
                onClick={headerColumnCount === 0 ? addHeaderColumn : removeHeaderColumn}
                className={`h-6 px-2 rounded-[16px] text-xs flex items-center gap-1 ${
                  headerColumnCount > 0
                    ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                    : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-500 dark:text-nokturo-500 opacity-85 hover:opacity-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                }`}
              >
                <MaterialIcon name="view_column" size={12} className="shrink-0" />
                {t('richText.addHeaderColumn')}
              </button>
              <BlockActionsDropdown {...blockActionsProps} />
            </div>
            <div className="flex items-start">
              {/* Add column left */}
              <button
                type="button"
                onClick={() => addColumnAt(0)}
                className="group/addcol self-center flex items-center justify-center w-6 h-6 shrink-0 border border-r-0 border-dashed border-nokturo-300 dark:border-nokturo-600 rounded-l-md opacity-0 hover:opacity-100 focus:opacity-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-all"
                title={t('richText.addColumn')}
              >
                <MaterialIcon name="add" size={12} className="text-nokturo-400 dark:text-nokturo-500 group-hover/addcol:text-nokturo-600 dark:group-hover/addcol:text-nokturo-300 shrink-0" />
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
                            className="p-1 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-red-fg hover:bg-red/10 dark:hover:bg-red/20"
                            title={t('richText.deleteRow')}
                          >
                            <DeleteIcon size={12} />
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
                                  <label className="absolute inset-0 bg-page/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center cursor-pointer text-white text-xs">
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
                                  <MaterialIcon name="image" size={14} className="mr-1 shrink-0" />
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
                                {tipo === 'text' ? <MaterialIcon name="title" size={10} className="shrink-0" /> : <MaterialIcon name="image" size={10} className="shrink-0" />}
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
                                className="p-1 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-red-fg hover:bg-red/10 dark:hover:bg-red/20"
                                title={t('richText.deleteColumn')}
                              >
                                <DeleteIcon size={12} />
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
                  <MaterialIcon name="add" size={12} className="text-nokturo-400 dark:text-nokturo-500 group-hover/addrow:text-nokturo-600 dark:group-hover/addrow:text-nokturo-300 shrink-0" />
                </button>
              </div>
              {/* Add column right */}
              <button
                type="button"
                onClick={() => addColumnAt(cols)}
                className="group/addcol self-center flex items-center justify-center w-6 h-6 shrink-0 border border-l-0 border-dashed border-nokturo-300 dark:border-nokturo-600 rounded-r-md opacity-0 hover:opacity-100 focus:opacity-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-all"
                title={t('richText.addColumn')}
              >
                <MaterialIcon name="add" size={12} className="text-nokturo-400 dark:text-nokturo-500 group-hover/addcol:text-nokturo-600 dark:group-hover/addcol:text-nokturo-300 shrink-0" />
              </button>
            </div>
          </div>
          );
        })()}

        {block.type === 'link' && (
          <div className="mb-4 flex flex-wrap gap-2 items-center">
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
            <BlockActionsDropdown {...blockActionsProps} />
          </div>
        )}

        {block.type === 'divider' && (
          <div className="my-6 py-2">
            <div className="flex justify-end mb-1">
              <BlockActionsDropdown {...blockActionsProps} />
            </div>
            <hr className="border-0 border-t border-nokturo-300 dark:border-nokturo-600" />
          </div>
        )}

        {block.type === 'tag' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-nokturo-600 dark:text-nokturo-400 shrink-0">
                <input
                  type="checkbox"
                  checked={block.visible !== false}
                  onChange={(e) => onUpdate(block.id, { visible: e.target.checked })}
                  className="rounded-[4px] border-nokturo-300 dark:border-nokturo-600"
                />
                {t('richText.tagVisible')}
              </label>
              <BlockActionsDropdown {...blockActionsProps} />
            </div>
            <input
              type="text"
              value={block.text}
              onChange={(e) => onUpdate(block.id, { text: e.target.value })}
              placeholder={t('richText.tagPlaceholder')}
              className="w-full text-sm font-normal text-nokturo-600 dark:text-nokturo-400 bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-nokturo-400 dark:placeholder:text-nokturo-500"
            />
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
  /** Which font family to use for headings: 'headline' = IvyPresto, 'body' = Instrument Sans */
  headingFont?: HeadingFontFamily;
  /** When true, H3 uses 32px (About Nokturo); otherwise 20px */
  h3Large?: boolean;
  /** z-index used for block action/ratio dropdown portals */
  dropdownZIndex?: number;
}

export function RichTextBlockEditor({
  value,
  onChange,
  onUploadImage,
  onToast,
  headingFont = 'headline',
  h3Large = false,
  dropdownZIndex,
}: RichTextBlockEditorProps) {
  const { t } = useTranslation();
  const editorRootRef = useRef<HTMLDivElement>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const blocks = value?.length ? value : [];
  const lastDuplicatedBlockIdRef = useRef<string | null>(null);

  const updateBlock = useCallback(
    (id: string, data: Partial<RichTextBlock>) => {
      if (id === lastDuplicatedBlockIdRef.current) lastDuplicatedBlockIdRef.current = null;
      const nextBlocks = blocks.map((b) => {
        if (b.id !== id) return b;
        if (data.type && data.type !== b.type) {
          return { id: b.id, ...data } as RichTextBlock;
        }
        return { ...b, ...data } as RichTextBlock;
      });
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

  const duplicateBlock = useCallback(
    (block: RichTextBlock, afterIndex: number, trackForUndo = false) => {
      const copy = duplicateBlockData(block);
      addBlock(copy, afterIndex);
      if (trackForUndo) lastDuplicatedBlockIdRef.current = copy.id;
    },
    [addBlock],
  );

  const focusBlockInput = useCallback((id: string) => {
    window.setTimeout(() => {
      const root = editorRootRef.current;
      if (!root) return;
      const blockEl = root.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
      if (!blockEl) return;
      const target = blockEl.querySelector('[contenteditable="true"], textarea, input') as HTMLElement | null;
      target?.focus();
    }, 0);
  }, []);

  const focusedIndex = focusedBlockId ? blocks.findIndex((b) => b.id === focusedBlockId) : -1;
  const focusedBlock = focusedIndex >= 0 ? blocks[focusedIndex] : null;
  const activeType = focusedBlock?.type ?? null;
  const activeHeadingLevel = focusedBlock?.type === 'heading' ? focusedBlock.level : null;
  const activeListStyle = focusedBlock?.type === 'list' ? focusedBlock.style : null;
  const activeParagraphSize = focusedBlock?.type === 'paragraph' ? focusedBlock.size : 'normal';
  const activeParagraphAlign = focusedBlock?.type === 'paragraph' ? (focusedBlock.align ?? 'left') : 'left';

  const createInsertedBlock = useCallback((kind: 'image' | 'gallery' | 'imageGrid' | 'grid' | 'link' | 'divider' | 'tag') => {
    if (kind === 'image') return { id: generateId(), type: 'image', url: '', fit: 'fill' } as RichTextBlock;
    if (kind === 'gallery') return { id: generateId(), type: 'gallery', columns: 3, images: [] } as RichTextBlock;
    if (kind === 'imageGrid') return { id: generateId(), type: 'imageGrid', columns: 3, gapRow: 8, gapCol: 8, aspectRatio: '1:1', images: [] } as RichTextBlock;
    if (kind === 'grid') return { id: generateId(), type: 'grid', columns: 1, rows: 1, headerRowCount: 0, headerColumnCount: 0, cells: [{ type: 'text', content: '' }] } as RichTextBlock;
    if (kind === 'link') return { id: generateId(), type: 'link', url: '', text: '' } as RichTextBlock;
    if (kind === 'tag') return { id: generateId(), type: 'tag', text: '', visible: true } as RichTextBlock;
    return { id: generateId(), type: 'divider' } as RichTextBlock;
  }, []);

  const insertAfterFocused = useCallback((block: RichTextBlock) => {
    const idx = focusedIndex >= 0 ? focusedIndex + 1 : blocks.length;
    addBlock(block, idx);
    setFocusedBlockId(block.id);
    focusBlockInput(block.id);
  }, [focusedIndex, blocks.length, addBlock, focusBlockInput]);

  const convertFocusedBlock = useCallback((targetType: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'quote' | 'bullet' | 'numbered' | 'tag') => {
    if (!focusedBlock) return;
    const text = blockToText(focusedBlock);
    if (targetType === 'heading1') {
      updateBlock(focusedBlock.id, { type: 'heading', level: 1, text });
      return;
    }
    if (targetType === 'heading2') {
      updateBlock(focusedBlock.id, { type: 'heading', level: 2, text });
      return;
    }
    if (targetType === 'heading3') {
      updateBlock(focusedBlock.id, { type: 'heading', level: 3, text });
      return;
    }
    if (targetType === 'paragraph') {
      const html = focusedBlock.type === 'paragraph' ? focusedBlock.content : textToHtml(text);
      updateBlock(focusedBlock.id, { type: 'paragraph', size: 'normal', content: html, align: 'left' });
      return;
    }
    if (targetType === 'quote') {
      updateBlock(focusedBlock.id, { type: 'quote', text });
      return;
    }
    if (targetType === 'tag') {
      updateBlock(focusedBlock.id, { type: 'tag', text, visible: true });
      return;
    }
    const lines = (text || '').split('\n').map((line) => line.trim()).filter(Boolean);
    updateBlock(focusedBlock.id, {
      type: 'list',
      style: targetType === 'numbered' ? 'numbered' : 'bullet',
      items: lines.length ? lines : [''],
    });
  }, [focusedBlock, updateBlock]);

  const runInlineCommand = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  }, []);

  const refreshFormattingState = useCallback(() => {
    const activeEl = document.activeElement;
    if (!activeEl || !editorRootRef.current?.contains(activeEl)) {
      setIsBold(false);
      setIsItalic(false);
      return;
    }
    setIsBold(document.queryCommandState?.('bold') ?? false);
    setIsItalic(document.queryCommandState?.('italic') ?? false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      const editorRoot = target.closest('[data-rich-text-editor]');
      if (!editorRoot) return;

      // Ctrl+Z / Cmd+Z: undo last duplicate (remove duplicated block)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const blockIdToUndo = lastDuplicatedBlockIdRef.current;
        if (blockIdToUndo && blocks.some((b) => b.id === blockIdToUndo)) {
          e.preventDefault();
          e.stopPropagation();
          lastDuplicatedBlockIdRef.current = null;
          removeBlock(blockIdToUndo);
          return;
        }
      }

      // Ctrl+D / Cmd+D: duplicate focused block
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        const blockEl = target.closest('[data-block-id]');
        const blockId = blockEl?.getAttribute('data-block-id');
        if (!blockId) return;
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;
        const index = blocks.findIndex((b) => b.id === blockId);
        if (index === -1) return;
        e.preventDefault();
        e.stopPropagation();
        duplicateBlock(block, index + 1, true);
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const blockEl = target.closest('[data-block-id]');
        const blockId = blockEl?.getAttribute('data-block-id');
        if (!blockId) return;
        const block = blocks.find((b) => b.id === blockId);
        if (!block || !['heading', 'paragraph', 'quote'].includes(block.type)) return;
        const index = blocks.findIndex((b) => b.id === blockId);
        if (index === -1) return;

        let atEnd = false;
        if (target instanceof HTMLTextAreaElement) {
          atEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
        } else if (target instanceof HTMLElement && target.isContentEditable) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
            const range = sel.getRangeAt(0).cloneRange();
            range.selectNodeContents(target);
            range.setEnd(sel.anchorNode as Node, sel.anchorOffset);
            atEnd = range.toString().length === target.innerText.length;
          }
        }
        if (!atEnd) return;

        e.preventDefault();
        const newBlock: RichTextBlock = { id: generateId(), type: 'paragraph', size: 'normal', content: '' };
        addBlock(newBlock, index + 1);
        setFocusedBlockId(newBlock.id);
        focusBlockInput(newBlock.id);
        return;
      }

      if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const blockEl = target.closest('[data-block-id]');
        const blockId = blockEl?.getAttribute('data-block-id');
        if (!blockId) return;
        const block = blocks.find((b) => b.id === blockId);
        if (!block || block.type !== 'paragraph') return;
        if (!isBlockEmpty(block)) return;

        const index = blocks.findIndex((b) => b.id === blockId);
        if (index <= 0) return;
        e.preventDefault();
        removeBlock(blockId);
        const prev = blocks[index - 1];
        if (prev) {
          setFocusedBlockId(prev.id);
          focusBlockInput(prev.id);
        }
      }
    },
    [blocks, removeBlock, duplicateBlock, addBlock, focusBlockInput],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshFormattingState);
    return () => document.removeEventListener('selectionchange', refreshFormattingState);
  }, [refreshFormattingState]);

  useEffect(() => {
    if (!focusedBlockId && blocks.length > 0) {
      setFocusedBlockId(blocks[0].id);
    }
  }, [blocks, focusedBlockId]);

  return (
    <div className="space-y-0 pb-20" data-rich-text-editor ref={editorRootRef}>
      <div className="space-y-0">
        {blocks.map((block, index) => (
          <BlockRenderer
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            onUpdate={updateBlock}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
            onUploadImage={onUploadImage}
            onToast={onToast}
            headingFont={headingFont}
            h3Large={h3Large}
            dropdownZIndex={dropdownZIndex}
            onFocusBlock={setFocusedBlockId}
          />
        ))}
      </div>
      <FloatingToolbar
        onBold={() => runInlineCommand('bold')}
        onItalic={() => runInlineCommand('italic')}
        onH1={() => convertFocusedBlock('heading1')}
        onH2={() => convertFocusedBlock('heading2')}
        onH3={() => convertFocusedBlock('heading3')}
        onParagraph={() => convertFocusedBlock('paragraph')}
        onQuote={() => convertFocusedBlock('quote')}
        onBulletList={() => convertFocusedBlock('bullet')}
        onNumberedList={() => convertFocusedBlock('numbered')}
        onTag={() => convertFocusedBlock('tag')}
        onImage={() => insertAfterFocused(createInsertedBlock('image'))}
        onGallery={() => insertAfterFocused(createInsertedBlock('gallery'))}
        onImageGrid={() => insertAfterFocused(createInsertedBlock('imageGrid'))}
        onGrid={() => insertAfterFocused(createInsertedBlock('grid'))}
        onLink={() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            const url = prompt(t('richText.enterUrl'));
            if (url) runInlineCommand('createLink', url);
            return;
          }
          insertAfterFocused(createInsertedBlock('link'));
        }}
        onDivider={() => insertAfterFocused(createInsertedBlock('divider'))}
        onSizeSmall={() => {
          if (focusedBlock?.type === 'paragraph') updateBlock(focusedBlock.id, { size: 'small' });
        }}
        onSizeNormal={() => {
          if (focusedBlock?.type === 'paragraph') updateBlock(focusedBlock.id, { size: 'normal' });
        }}
        onSizeLarge={() => {
          if (focusedBlock?.type === 'paragraph') updateBlock(focusedBlock.id, { size: 'large' });
        }}
        onAlignLeft={() => {
          if (focusedBlock?.type === 'paragraph') updateBlock(focusedBlock.id, { align: 'left' });
        }}
        onAlignCenter={() => {
          if (focusedBlock?.type === 'paragraph') updateBlock(focusedBlock.id, { align: 'center' });
        }}
        onAlignRight={() => {
          if (focusedBlock?.type === 'paragraph') updateBlock(focusedBlock.id, { align: 'right' });
        }}
        isBold={isBold}
        isItalic={isItalic}
        activeType={activeType}
        activeHeadingLevel={activeHeadingLevel}
        activeListStyle={activeListStyle}
        activeParagraphSize={activeParagraphSize}
        activeParagraphAlign={activeParagraphAlign}
      />
    </div>
  );
}
