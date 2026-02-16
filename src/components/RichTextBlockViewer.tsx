/**
 * Blog-style viewer for Rich Text blocks – čistý náhled bez editovacích prvků
 * S automatickým Table of Contents vpravo od nadpisů
 */
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { RichTextBlock } from './RichTextBlockEditor';
import { TableOfContents, type TocItem } from './TableOfContents';

/** Výchozí TOC – Způsob zakončení švů, Hardware – používá se na Brand Identity a Strategy */
export const DEFAULT_TOC_KEYS = [
  { id: 'section-seam-finishing', i18nKey: 'richText.defaultToc.seamFinishing' },
  { id: 'section-hardware', i18nKey: 'richText.defaultToc.hardware' },
] as const;

export function getDefaultTocItems(t: TFunction): TocItem[] {
  return DEFAULT_TOC_KEYS.map(({ id, i18nKey }) => ({
    id,
    text: t(i18nKey),
    level: 2 as const,
  }));
}

interface RichTextBlockViewerProps {
  blocks: RichTextBlock[];
  className?: string;
  showToc?: boolean;
  /** Název stránky pro TOC header (místo "Obsah") */
  tocTitle?: string;
  /** Výchozí položky TOC, když v obsahu nejsou žádné nadpisy */
  defaultTocItems?: TocItem[];
}

export function extractHeadings(blocks: RichTextBlock[]): TocItem[] {
  const headings: TocItem[] = [];
  for (const block of blocks) {
    if (block.type === 'heading' && block.text?.trim()) {
      headings.push({ id: block.id, text: block.text.trim(), level: block.level });
    }
  }
  return headings;
}

export function RichTextBlockViewer({ blocks, className = '', showToc = true, tocTitle, defaultTocItems }: RichTextBlockViewerProps) {
  const { t } = useTranslation();
  const tocItems = extractHeadings(blocks);
  const effectiveTocItems = tocItems.length > 0 ? tocItems : (defaultTocItems ?? []);
  const useDefaultToc = tocItems.length === 0 && defaultTocItems && defaultTocItems.length > 0 && blocks?.length > 0;

  if (!blocks?.length) {
    return (
      <div className={`text-nokturo-500 dark:text-nokturo-400 text-center py-12 ${className}`}>
        {t('richText.noContent')}
      </div>
    );
  }

  const content = (
    <article className="font-body">
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
      {useDefaultToc &&
        defaultTocItems!.map((item, idx) => (
          <section key={item.id} id={item.id} className="mb-12 scroll-mt-6">
            <div className={`${idx === 0 ? 'mt-16' : 'mt-10'} border-t border-nokturo-300 dark:border-nokturo-600 mb-6`} aria-hidden />
            <h2 className="font-headline text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4">{item.text}</h2>
          </section>
        ))}
    </article>
  );

  if (showToc && effectiveTocItems.length > 0) {
    return (
      <div className={`flex gap-12 items-start ${className}`}>
        <div className="min-w-0 flex-1">{content}</div>
        <TableOfContents items={effectiveTocItems} title={tocTitle} alignWithFirstHeading />
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}

function BlockView({ block }: { block: RichTextBlock }) {
  switch (block.type) {
    case 'heading':
      if (!block.text.trim()) return null;
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      const headingClass = {
        1: 'font-headline text-[48px] font-extralight text-nokturo-900 dark:text-nokturo-100 mt-16 mb-4 scroll-mt-6 leading-[1.1]',
        2: 'font-headline text-[40px] font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4 scroll-mt-6 leading-[1.2]',
        3: 'font-body text-[20px] font-medium text-nokturo-800 dark:text-nokturo-200 mt-8 mb-3 scroll-mt-6',
      }[block.level];
      if (block.level === 2) {
        return (
          <>
            <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
            <Tag id={block.id} className={headingClass}>
              {block.text}
            </Tag>
          </>
        );
      }
      return (
        <Tag id={block.id} className={headingClass}>
          {block.text}
        </Tag>
      );

    case 'paragraph':
      if (!block.content?.trim()) return null;
      const sizeClass = block.size === 'large' ? 'text-lg text-nokturo-900 dark:text-nokturo-100' : block.size === 'small' ? 'text-sm text-nokturo-900/60 dark:text-nokturo-100/60' : 'text-base text-nokturo-900/80 dark:text-nokturo-100/80';
      const paraTextClass = '';
      return (
        <div
          className={`font-body ${sizeClass} ${paraTextClass} leading-relaxed mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-nokturo-800 dark:[&_a]:text-nokturo-200 [&_a]:underline [&_a]:hover:text-nokturo-900 dark:[&_a]:hover:text-nokturo-100`}
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );

    case 'quote':
      if (!block.text.trim()) return null;
      return (
        <blockquote className="font-body pl-4 text-nokturo-600 dark:text-nokturo-400 italic my-6 py-1">
          {block.text}
        </blockquote>
      );

    case 'list':
      if (!block.items?.length || block.items.every((i) => !i?.trim())) return null;
      const ListTag = block.style === 'numbered' ? 'ol' : 'ul';
      return (
        <ListTag className={`font-body pl-6 my-5 space-y-1 ${block.style === 'numbered' ? 'list-decimal' : 'list-disc'} text-nokturo-700 dark:text-nokturo-300`}>
          {block.items.filter((i) => i?.trim()).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ListTag>
      );

    case 'image':
      if (!block.url) return null;
      const imgFit = block.fit ?? 'fill';
      return (
        <figure className="my-8">
          <img
            src={block.url}
            alt={block.alt || ''}
            className={imgFit === 'fill' ? 'w-full object-cover' : 'w-auto max-w-full h-auto'}
          />
        </figure>
      );

    case 'gallery':
      if (!block.images?.length) return null;
      return (
        <div
          className="grid gap-3 my-8"
          style={{ gridTemplateColumns: `repeat(${block.columns}, 1fr)` }}
        >
          {block.images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.alt || ''}
              className="w-full aspect-square object-cover"
            />
          ))}
        </div>
      );

    case 'grid':
      if (!block.cells?.length) return null;
      const gridCols = Math.max(1, block.columns ?? 1);
      const gridRows = Math.max(1, block.rows ?? 1);
      const headerCount = block.headerRowCount ?? 0;
      return (
        <div
          className="border border-nokturo-200 dark:border-nokturo-700 my-8 overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, minmax(80px, 1fr))`,
          }}
        >
          {block.cells.slice(0, gridRows * gridCols).map((cell, i) => {
            const rowIdx = Math.floor(i / gridCols);
            const colIdx = i % gridCols;
            const isHeader = headerCount > 0 && rowIdx < headerCount;
            const isLastHeaderRow = headerCount > 0 && rowIdx === headerCount - 1;
            return (
              <div
                key={i}
                className={`font-body border-r border-nokturo-200 dark:border-nokturo-700 p-2 text-sm ${
                  colIdx === gridCols - 1 ? 'border-r-0' : ''
                } ${
                  rowIdx === gridRows - 1
                    ? 'border-b-0'
                    : isLastHeaderRow
                      ? 'border-b-2 border-nokturo-300 dark:border-nokturo-600'
                      : 'border-b border-nokturo-200 dark:border-nokturo-700'
                } ${
                  isHeader ? 'bg-nokturo-100 dark:bg-nokturo-800 font-semibold text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-700 dark:text-nokturo-300'
                }`}
              >
                {cell.type === 'text' ? (
                  cell.content?.trim() ? (
                    <span className="whitespace-pre-wrap [&_a]:underline [&_a]:text-blue-600 dark:[&_a]:text-blue-400" dangerouslySetInnerHTML={{ __html: cell.content }} />
                  ) : null
                ) : cell.content ? (
                  <img src={cell.content} alt="" className="w-full max-h-24 object-cover" />
                ) : null}
              </div>
            );
          })}
        </div>
      );

    case 'link':
      if (!block.url?.trim()) return null;
      return (
        <p className="font-body mb-5">
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nokturo-800 dark:text-nokturo-200 underline hover:text-nokturo-900 dark:hover:text-nokturo-100"
          >
            {block.text?.trim() || block.url}
          </a>
        </p>
      );

    case 'divider':
      return (
        <div className="my-8">
          <hr className="border-0 border-t border-nokturo-300 dark:border-nokturo-600" />
        </div>
      );

    default:
      return null;
  }
}
