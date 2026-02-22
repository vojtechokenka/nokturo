/**
 * Page structure outline – HTML-like tree of blocks, drag to reorder, click to scroll
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Type,
  AlignLeft,
  Quote,
  Image as ImageIcon,
  LayoutGrid,
  Grid3X3,
  Link2,
  Minus,
  GripVertical,
  List,
} from 'lucide-react';
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
      return <Type size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'paragraph':
      return <AlignLeft size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'quote':
      return <Quote size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'list':
      return <List size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'image':
      return <ImageIcon size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'gallery':
      return <LayoutGrid size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'imageGrid':
      return <Grid3X3 size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'grid':
      return <Grid3X3 size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'link':
      return <Link2 size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    case 'divider':
      return <Minus size={14} className="shrink-0 text-nokturo-500 dark:text-nokturo-400" />;
    default:
      return null;
  }
}

export interface PageStructurePanelProps {
  blocks: RichTextBlock[];
  onChange: (blocks: RichTextBlock[]) => void;
  onSelectBlock?: (blockId: string) => void;
  className?: string;
}

export function PageStructurePanel({ blocks, onChange, onSelectBlock, className = '' }: PageStructurePanelProps) {
  const { t } = useTranslation();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      moveBlock(fromIndex, toIndex);
    }
  };

  const handleClick = (blockId: string) => {
    onSelectBlock?.(blockId);
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <aside className={`w-56 shrink-0 ${className}`}>
      <h3 className="text-heading-5 font-extralight uppercase tracking-wider text-nokturo-500 dark:text-nokturo-400 mb-3 px-2">
        {t('richText.pageStructure')}
      </h3>
      <nav className="space-y-0.5">
        {blocks.length === 0 ? (
          <div className="text-xs text-nokturo-400 dark:text-nokturo-500 px-2 py-4 italic">
            {t('richText.noContent')}
          </div>
        ) : (
          blocks.map((block, index) => (
            <div
              key={block.id}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded text-sm text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors ${
                dragOverIndex === index ? 'bg-nokturo-100 dark:bg-nokturo-700 ring-1 ring-nokturo-200 dark:ring-nokturo-600' : ''
              }`}
            >
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 -m-0.5 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-600"
              >
                <GripVertical size={12} className="text-nokturo-400 dark:text-nokturo-500" />
              </div>
              <button
                type="button"
                onClick={() => handleClick(block.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
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
          ))
        )}
      </nav>
    </aside>
  );
}
