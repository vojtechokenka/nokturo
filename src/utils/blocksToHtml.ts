import type { RichTextBlock } from '../components/RichTextBlockEditor';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function imageFigure(url: string, alt?: string, caption?: string, fit: 'fill' | 'hug' = 'fill'): string {
  const escapedAlt = escapeAttr(alt ?? '');
  const captionHtml = caption?.trim()
    ? `<figcaption>${escapeHtml(caption.trim())}</figcaption>`
    : '';
  return `<figure class="rte-img" data-fit="${fit}"><img src="${escapeAttr(url)}" alt="${escapedAlt}" />${captionHtml}</figure>`;
}

function paragraphClass(size: 'normal' | 'large' | 'small', align?: 'left' | 'center' | 'right'): string {
  const classes = ['rte-p'];
  if (size === 'large') classes.push('rte-p-large');
  if (size === 'small') classes.push('rte-p-small');
  if (align === 'center') classes.push('rte-align-center');
  if (align === 'right') classes.push('rte-align-right');
  if (!align || align === 'left') classes.push('rte-align-left');
  return classes.join(' ');
}

export function blocksToHtml(blocks: RichTextBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `<h${block.level}>${escapeHtml(block.text ?? '')}</h${block.level}>`;
        case 'paragraph': {
          const cls = paragraphClass(block.size, block.align);
          return `<p class="${cls}">${block.content ?? ''}</p>`;
        }
        case 'quote':
          return `<blockquote class="rte-quote">${escapeHtml(block.text ?? '')}</blockquote>`;
        case 'list': {
          const listTag = block.style === 'numbered' ? 'ol' : 'ul';
          const items = (block.items ?? [])
            .filter((item) => item?.trim())
            .map((item) => `<li>${item}</li>`)
            .join('');
          return `<${listTag}>${items}</${listTag}>`;
        }
        case 'image':
          return block.url ? imageFigure(block.url, block.alt, block.caption, block.fit ?? 'fill') : '';
        case 'gallery': {
          if (!block.images?.length) return '';
          const images = block.images
            .filter((img) => img.url)
            .map((img) => imageFigure(img.url, img.alt, img.caption, 'fill'))
            .join('');
          return `<div class="rte-gallery" data-columns="${block.columns}">${images}</div>`;
        }
        case 'imageGrid': {
          if (!block.images?.length) return '';
          const images = block.images
            .filter((img) => img.url)
            .map((img) => imageFigure(img.url, img.alt, img.caption, 'fill'))
            .join('');
          const aspect = block.aspectRatio ?? '1:1';
          const gapRow = Number.isFinite(block.gapRow) ? block.gapRow : 8;
          const gapCol = Number.isFinite(block.gapCol) ? block.gapCol : 8;
          return `<div class="rte-image-grid" data-columns="${block.columns}" data-gap-row="${gapRow}" data-gap-col="${gapCol}" data-aspect="${escapeAttr(aspect)}" style="--rte-grid-cols:${block.columns};--rte-gap-row:${gapRow}px;--rte-gap-col:${gapCol}px;">${images}</div>`;
        }
        case 'grid': {
          if (!block.cells?.length) return '';
          const rows = Math.max(1, block.rows ?? 1);
          const cols = Math.max(1, block.columns ?? 1);
          const headerRows = Math.max(0, block.headerRowCount ?? 0);
          const headerCols = Math.max(0, block.headerColumnCount ?? 0);
          const rowHtml: string[] = [];
          for (let r = 0; r < rows; r += 1) {
            const cells: string[] = [];
            for (let c = 0; c < cols; c += 1) {
              const idx = r * cols + c;
              const cell = block.cells[idx] ?? { type: 'text', content: '' };
              const isHeader = r < headerRows || c < headerCols;
              const tag = isHeader ? 'th' : 'td';
              if (cell.type === 'image' && cell.content) {
                const img = `<img src="${escapeAttr(cell.content)}" alt="" class="rte-grid-img" />`;
                const cap = cell.caption?.trim() ? `<div class="rte-grid-caption">${escapeHtml(cell.caption.trim())}</div>` : '';
                cells.push(`<${tag}>${img}${cap}</${tag}>`);
              } else {
                cells.push(`<${tag}>${cell.content || ''}</${tag}>`);
              }
            }
            rowHtml.push(`<tr>${cells.join('')}</tr>`);
          }
          return `<table class="rte-grid" data-header-rows="${headerRows}" data-header-cols="${headerCols}"><tbody>${rowHtml.join('')}</tbody></table>`;
        }
        case 'link': {
          if (!block.url?.trim()) return '';
          const label = block.text?.trim() || block.url.trim();
          return `<p class="rte-p rte-align-left"><a href="${escapeAttr(block.url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
        }
        case 'divider':
          return '<hr class="rte-divider" />';
        case 'tag': {
          if (!block.text?.trim()) return '';
          const hiddenClass = block.visible === false ? ' rte-tag-hidden' : '';
          return `<div id="${escapeAttr(block.id)}" class="rte-tag${hiddenClass}" data-tag-id="${escapeAttr(block.id)}">${escapeHtml(block.text.trim())}</div>`;
        }
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('');
}

