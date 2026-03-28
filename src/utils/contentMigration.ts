import type { RichTextBlock } from '../components/RichTextBlockEditor';
import { blocksToHtml } from './blocksToHtml';
import type { PageElement } from '../types/pageElement';

interface ParsedDocContent {
  elements: PageElement[];
  headerImage: string | null;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isTextLikeBlock(block: RichTextBlock): boolean {
  return block.type === 'heading' || block.type === 'paragraph' || block.type === 'quote' || block.type === 'list' || block.type === 'link';
}

function toTextElement(blocks: RichTextBlock[], title: string): PageElement | null {
  if (blocks.length === 0) return null;
  const html = blocksToHtml(blocks).trim();
  if (!html) return null;
  return {
    id: blocks[0]?.id || generateId('text'),
    type: 'text',
    title,
    html,
  };
}

function blocksToElements(rawBlocks: RichTextBlock[]): PageElement[] {
  const elements: PageElement[] = [];
  let textBuffer: RichTextBlock[] = [];
  let pendingTitle = '';

  const flushTextBuffer = () => {
    const textEl = toTextElement(textBuffer, pendingTitle);
    if (textEl) elements.push(textEl);
    textBuffer = [];
    pendingTitle = '';
  };

  for (const block of rawBlocks) {
    if (block.type === 'tag') {
      if (block.text?.trim()) pendingTitle = block.text.trim();
      continue;
    }

    if (isTextLikeBlock(block)) {
      textBuffer.push(block);
      continue;
    }

    flushTextBuffer();

    if (block.type === 'image') {
      elements.push({
        id: block.id,
        type: 'image',
        url: block.url,
        alt: block.alt,
        fit: block.fit,
        caption: block.caption,
      });
      continue;
    }

    if (block.type === 'gallery') {
      elements.push({
        id: block.id,
        type: 'gallery',
        columns: block.columns,
        images: block.images,
      });
      continue;
    }

    if (block.type === 'imageGrid') {
      elements.push({
        id: block.id,
        type: 'imageGrid',
        columns: block.columns,
        gapRow: block.gapRow,
        gapCol: block.gapCol,
        gapLocked: block.gapLocked,
        aspectRatio: block.aspectRatio,
        images: block.images,
      });
      continue;
    }

    if (block.type === 'grid') {
      elements.push({
        id: block.id,
        type: 'grid',
        columns: block.columns,
        rows: block.rows,
        headerRowCount: block.headerRowCount,
        headerColumnCount: block.headerColumnCount,
        cells: block.cells,
      });
      continue;
    }

    if (block.type === 'divider') {
      elements.push({ id: block.id, type: 'divider' });
    }
  }

  flushTextBuffer();
  return elements;
}

function parseHeaderImage(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return typeof obj.headerImage === 'string' ? obj.headerImage : null;
}

function asBlocks(raw: unknown): RichTextBlock[] {
  if (Array.isArray(raw)) return raw as RichTextBlock[];
  if (raw && typeof raw === 'object' && 'blocks' in raw) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.blocks)) return obj.blocks as RichTextBlock[];
  }
  return [];
}

function extractTagsFromHtml(html: string): { title: string; cleanHtml: string } {
  if (!html?.trim()) return { title: '', cleanHtml: html };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tagNodes = Array.from(doc.body.querySelectorAll('.rte-tag'));
  const firstTitle = tagNodes[0]?.textContent?.trim() || '';

  tagNodes.forEach((node) => node.remove());
  return { title: firstTitle, cleanHtml: doc.body.innerHTML };
}

export function parseDocContent(raw: unknown): ParsedDocContent {
  const headerImage = parseHeaderImage(raw);

  if (raw && typeof raw === 'object' && 'elements' in raw) {
    const obj = raw as Record<string, unknown>;
    const elements = Array.isArray(obj.elements) ? (obj.elements as PageElement[]) : [];
    return { elements, headerImage };
  }

  if (raw && typeof raw === 'object' && 'html' in raw) {
    const obj = raw as Record<string, unknown>;
    const rawHtml = typeof obj.html === 'string' ? obj.html : '';
    const { title, cleanHtml } = extractTagsFromHtml(rawHtml);
    const elements: PageElement[] = cleanHtml.trim()
      ? [{ id: generateId('text'), type: 'text', title, html: cleanHtml }]
      : [];
    return { elements, headerImage };
  }

  const blocks = asBlocks(raw);
  if (blocks.length > 0) {
    return {
      elements: blocksToElements(blocks),
      headerImage,
    };
  }

  return { elements: [], headerImage };
}

