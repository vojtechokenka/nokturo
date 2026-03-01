/**
 * Page structure outline – HTML-like tree of blocks, drag to reorder, click to scroll
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, GripVertical } from 'lucide-react';

const iconCls = 'shrink-0 text-nokturo-500 dark:text-nokturo-400';
const BlockIcons = {
  heading: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M7 20V7H2V4h13v3h-5v13zm9 0v-8h-3V9h9v3h-3v8z"/></svg>,
  paragraph: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M9 20v-6q-2.075 0-3.537-1.463T4 9t1.463-3.537T9 4h9v2h-2v14h-2V6h-3v14z"/></svg>,
  tag: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M2 20V4h14l6 8l-6 8z"/></svg>,
  quote: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M5.7 18L8 14q-1.65 0-2.825-1.175T4 10t1.175-2.825T8 6t2.825 1.175T12 10q0 .575-.137 1.063T11.45 12L8 18zm9 0l2.3-4q-1.65 0-2.825-1.175T13 10t1.175-2.825T17 6t2.825 1.175T21 10q0 .575-.137 1.063T20.45 12L17 18z"/></svg>,
  list: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M14 21v-8h8v8zM2 18v-2h9v2zm12-7V3h8v8zM2 8V6h9v2z"/></svg>,
  image: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M6 17h12l-3.75-5l-3 4L9 13zm-3 4V3h18v18zM9.563 9.563Q10 9.125 10 8.5t-.437-1.062T8.5 7t-1.062.438T7 8.5t.438 1.063T8.5 10t1.063-.437"/></svg>,
  gallery: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M1 19V5h14v14zm16-8V5h6v6zM4 15h8l-2.625-3.5L7.5 14l-1.375-1.825zm13 4v-6h6v6z"/></svg>,
  imageGrid: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M3 11V3h8v8zm0 10v-8h8v8zm10-10V3h8v8zm0 10v-8h8v8z"/></svg>,
  grid: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M3 21V3h18v18zm2-2h3.325v-3.325H5zm5.325 0h3.35v-3.325h-3.35zm5.35 0H19v-3.325h-3.325zM5 13.675h3.325v-3.35H5zm5.325 0h3.35v-3.35h-3.35zm5.35 0H19v-3.35h-3.325zM5 8.325h3.325V5H5zm5.325 0h3.35V5h-3.35zm5.35 0H19V5h-3.325z"/></svg>,
  link: <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" className={iconCls}><path fill="currentColor" d="M11 17H7q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h4v2H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h4zm-3-4v-2h8v2zm5 4v-2h4q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-4V7h4q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"/></svg>,
  divider: <Minus size={14} className={iconCls} />,
};
import type { RichTextBlock } from './RichTextBlockEditor';

function stripHtml(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function getBlockLabel(block: RichTextBlock, t: (k: string) => string): string {
  switch (block.type) {
    case 'heading':
      return block.text?.trim() || t('richText.heading');
    case 'paragraph': {
      const text = stripHtml(block.content || '').trim();
      return text.slice(0, 40) + (text.length > 40 ? '…' : '') || t('richText.paragraph');
    }
    case 'tag':
      return block.text?.trim().slice(0, 40) + (block.text?.length > 40 ? '…' : '') || t('richText.tag');
    case 'quote':
      return block.text?.trim().slice(0, 40) + (block.text?.length > 40 ? '…' : '') || t('richText.quote');
    case 'list':
      return `${t('richText.bulletList')} (${block.items?.filter((i) => i?.trim()).length || 0})`;
    case 'image':
      return block.url ? t('richText.image') : `(${t('richText.image')})`;
    case 'gallery':
      return `${t('richText.gallery')} (${block.images?.length || 0})`;
    case 'imageGrid':
      return `${t('richText.imageGrid')} (${block.images?.length || 0})`;
    case 'grid': {
      const cols = Math.max(1, block.columns ?? 1);
      const rows = Math.max(1, block.rows ?? 1);
      const h = block.headerRowCount ?? 0;
      return `${t('richText.grid')} (${rows}×${cols}${h > 0 ? ', header' : ''})`;
    }
    case 'link':
      return block.text?.trim() || block.url || t('richText.link');
    case 'divider':
      return '—';
    default:
      return '';
  }
}

function getBlockIcon(block: RichTextBlock) {
  switch (block.type) {
    case 'heading':
      return BlockIcons.heading;
    case 'paragraph':
      return BlockIcons.paragraph;
    case 'tag':
      return BlockIcons.tag;
    case 'quote':
      return BlockIcons.quote;
    case 'list':
      return BlockIcons.list;
    case 'image':
      return BlockIcons.image;
    case 'gallery':
      return BlockIcons.gallery;
    case 'imageGrid':
      return BlockIcons.imageGrid;
    case 'grid':
      return BlockIcons.grid;
    case 'link':
      return BlockIcons.link;
    case 'divider':
      return BlockIcons.divider;
    default:
      return null;
  }
}

export interface PageStructurePanelProps {
  blocks: RichTextBlock[];
  onChange: (blocks: RichTextBlock[]) => void;
  onSelectBlock?: (blockId: string) => void;
  /** Optional footer slot (e.g. Save button) – same UX as TOC Edit button */
  footerSlot?: React.ReactNode;
  /** When true: panel is part of layout flow (no fixed overlay). Use for Magazine editor. */
  inline?: boolean;
  className?: string;
}

function DropIndicator({
  onDragOver,
  onDrop,
  isDragging,
}: {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
}) {
  return (
    <div
      className={`py-1.5 -my-0.5 flex items-center ${isDragging ? 'cursor-grabbing' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex-1 h-px bg-nokturo-400 dark:bg-nokturo-500 rounded-full" />
    </div>
  );
}

export function PageStructurePanel({ blocks, onChange, onSelectBlock, footerSlot, inline = false, className = '' }: PageStructurePanelProps) {
  const { t } = useTranslation();
  const [dropPosition, setDropPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dropPositionRef = useRef<number | null>(null);
  dropPositionRef.current = dropPosition;

  const moveBlock = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...blocks];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    onChange(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedIndex(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? index : index + 1;
    setDropPosition(pos);
  };

  const handleDropAt = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    setDropPosition(null);
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      moveBlock(fromIndex, toIndex);
    }
  };

  const handleDropOnItem = (e: React.DragEvent) => {
    const toIndex = dropPositionRef.current;
    if (toIndex != null) {
      handleDropAt(e, toIndex);
    }
  };

  const handleIndicatorDragOver = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropPosition(pos);
  };

  const handleClick = (blockId: string) => {
    onSelectBlock?.(blockId);
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const asideCls = inline
    ? `w-[240px] shrink-0 flex flex-col min-h-0 ${isDragging ? 'cursor-grabbing' : ''} ${className}`
    : `fixed left-auto right-6 top-[60px] bottom-6 w-[240px] flex flex-col shrink-0 ${isDragging ? 'cursor-grabbing' : ''} ${className}`;

  return (
    <aside className={asideCls}>
      <nav className={`space-y-0.5 flex-1 min-h-0 overflow-y-auto font-body ${footerSlot && !inline ? 'pb-[88px]' : ''} ${isDragging ? 'cursor-grabbing' : ''}`} aria-label={t('richText.pageStructure')}>
        {blocks.length === 0 ? (
          <div className="text-xs text-nokturo-400 dark:text-nokturo-500 px-2 py-4 italic">
            {t('richText.noContent')}
          </div>
        ) : (
          <>
          {blocks.map((block, index) => (
            <div key={block.id} className="contents">
              {dropPosition === index && (
                <DropIndicator
                  onDragOver={(e) => handleIndicatorDragOver(e, index)}
                  onDrop={(e) => handleDropAt(e, index)}
                  isDragging={isDragging}
                />
              )}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDropOnItem}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded text-sm text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-100/40 dark:hover:bg-nokturo-800/40 transition-all duration-150 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${draggedIndex === index ? 'scale-90' : 'scale-100'}`}
              >
                <div className="shrink-0 p-0.5 -m-0.5 rounded text-nokturo-400 dark:text-nokturo-500 pointer-events-none">
                  <GripVertical size={12} />
                </div>
                <button
                  type="button"
                  onClick={() => handleClick(block.id)}
                  className={`flex items-center gap-2 min-w-0 flex-1 text-left ${isDragging ? 'cursor-inherit' : 'cursor-pointer'}`}
                >
                  {getBlockIcon(block)}
                  <span className="truncate">
                    {block.type === 'heading' && (
                      <span className="text-[10px] font-mono text-nokturo-400 dark:text-nokturo-500 mr-1">
                        H{(block as { level: number }).level}
                      </span>
                    )}
                    {getBlockLabel(block, t)}
                  </span>
                </button>
              </div>
            </div>
          ))}
          {dropPosition === blocks.length && (
            <DropIndicator
              onDragOver={(e) => handleIndicatorDragOver(e, blocks.length)}
              onDrop={(e) => handleDropAt(e, blocks.length)}
              isDragging={isDragging}
            />
          )}
          </>
        )}
      </nav>
      {footerSlot && (
        <div className={inline ? 'shrink-0 p-4 bg-nokturo-50 dark:bg-nokturo-900' : 'fixed right-6 bottom-6 w-[240px] p-4 bg-nokturo-50 dark:bg-nokturo-900'}>
          {footerSlot}
        </div>
      )}
    </aside>
  );
}
