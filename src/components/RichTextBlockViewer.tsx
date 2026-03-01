/**
 * Blog-style viewer for Rich Text blocks – čistý náhled bez editovacích prvků
 * S automatickým Table of Contents vpravo od nadpisů
 */
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { RichTextBlock } from './RichTextBlockEditor';
import { getAspectClass } from './RichTextBlockEditor';
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

export type HeadingFontFamily = 'headline' | 'body';

interface RichTextBlockViewerProps {
  blocks: RichTextBlock[];
  className?: string;
  showToc?: boolean;
  /** Název stránky pro TOC header (místo "Obsah") */
  tocTitle?: string;
  /** Výchozí položky TOC, když v obsahu nejsou žádné nadpisy */
  defaultTocItems?: TocItem[];
  /** Optional footer slot for TOC (e.g. Edit button) – full width at bottom */
  tocFooterSlot?: React.ReactNode;
  /** Which font family to use for headings: 'headline' = IvyPresto, 'body' = Inter */
  headingFont?: HeadingFontFamily;
  /** When true, H3 uses 32px (About Nokturo); otherwise 20px */
  h3Large?: boolean;
  /** Optional header image rendered above article content (scrolls with content) */
  headerImageSlot?: React.ReactNode;
}

/** Extract TOC items from Tag blocks (anchors). Tags replace headings as TOC source. */
export function extractTags(blocks: RichTextBlock[]): TocItem[] {
  const items: TocItem[] = [];
  for (const block of blocks) {
    if (block.type === 'tag' && block.text?.trim()) {
      items.push({ id: block.id, text: block.text.trim(), level: 2 });
    }
  }
  return items;
}

/** @deprecated Use extractTags. Kept for backwards compatibility. */
export function extractHeadings(blocks: RichTextBlock[]): TocItem[] {
  return extractTags(blocks);
}

export function RichTextBlockViewer({ blocks, className = '', showToc = true, tocTitle, defaultTocItems, tocFooterSlot, headerImageSlot, headingFont = 'headline', h3Large = false }: RichTextBlockViewerProps) {
  const { t } = useTranslation();
  const tocItems = extractTags(blocks);
  const effectiveTocItems = tocItems.length > 0 ? tocItems : (defaultTocItems ?? []);
  const useDefaultToc = tocItems.length === 0 && defaultTocItems && defaultTocItems.length > 0 && blocks?.length > 0;

  if (!blocks?.length) {
    const emptyHeaderWrapper = headerImageSlot ? (
      <div className="-ml-[3.75rem] w-[calc(100%+3.75rem)]">
        {headerImageSlot}
      </div>
    ) : null;
    return (
      <div className={className}>
        {emptyHeaderWrapper}
        <div className="text-nokturo-500 dark:text-nokturo-400 text-center py-12">
          {t('richText.noContent')}
        </div>
      </div>
    );
  }

  const content = (
    <article className="font-body">
      {blocks.map((block, index) => (
        <BlockView key={block.id} block={block} prevBlock={blocks[index - 1]} nextBlock={blocks[index + 1]} headingFont={headingFont} h3Large={h3Large} />
      ))}
      {useDefaultToc &&
        defaultTocItems!.map((item, idx) => (
          <section key={item.id} id={item.id} className="mb-12 scroll-mt-6">
            <div className={`${idx === 0 ? 'mt-16' : 'mt-10'} border-t border-nokturo-300 dark:border-nokturo-600 mb-6`} aria-hidden />
            <h2 className="font-headline text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100 mb-4">{item.text}</h2>
          </section>
        ))}
    </article>
  );

  const headerImageWrapper = headerImageSlot ? (
    <div className="-ml-[3.75rem] w-[calc(100%+3.75rem)]">
      {headerImageSlot}
    </div>
  ) : null;

  if (showToc && effectiveTocItems.length > 0) {
    return (
      <div className={`flex gap-6 ${className}`}>
        <div className="min-w-0 flex-1 max-w-[860px]">
          {headerImageWrapper}
          {content}
        </div>
        <TableOfContents
          items={effectiveTocItems}
          title={tocTitle}
          footerSlot={tocFooterSlot}
          alignWithFirstHeading
          sticky
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {headerImageWrapper}
      {content}
    </div>
  );
}

function BlockView({ block, prevBlock, nextBlock, headingFont = 'headline', h3Large = false }: { block: RichTextBlock; prevBlock?: RichTextBlock; nextBlock?: RichTextBlock; headingFont?: HeadingFontFamily; h3Large?: boolean }) {
  switch (block.type) {
    case 'tag':
      if (!block.text?.trim()) return null;
      const tagMb = nextBlock?.type === 'heading' && block.visible !== false ? 'mb-3' : 'mb-1';
      return (
        <span
          id={block.id}
          data-block-id={block.id}
          className={`block scroll-mt-6 ${block.visible !== false ? `text-[12px] uppercase tracking-[0.2em] text-nokturo-500 dark:text-nokturo-400 font-normal mt-[80px] ${tagMb}` : 'sr-only mt-[80px]'}`}
          aria-hidden={block.visible === false}
        >
          — {block.text}
        </span>
      );

    case 'heading':
      if (!block.text.trim()) return null;
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      const isHeadline = headingFont === 'headline';
      const hFont = isHeadline ? 'font-headline' : 'font-body';
      const h3Size = h3Large ? 'text-[32px]' : 'text-[20px]';
      const hSizeClass =
        block.level === 1
          ? isHeadline
            ? 'text-[56px]'
            : 'text-[30px]'
          : block.level === 2
            ? isHeadline
              ? 'text-[40px]'
              : 'text-[24px]'
            : h3Size;
      const headingMt = prevBlock?.type === 'tag' && prevBlock.visible !== false ? 'mt-0' : block.level === 1 ? 'mt-8' : block.level === 2 ? 'mt-12' : 'mt-8';
      const headingClass = {
        1: `${hFont} ${hSizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 ${headingMt} mb-4 scroll-mt-6 leading-[1.1]`,
        2: `${hFont} ${hSizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 ${headingMt} mb-4 scroll-mt-6 leading-[1.2]`,
        3: `${hFont} ${hSizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 ${headingMt} mb-3 scroll-mt-6`,
      }[block.level];
      return (
        <Tag id={block.id} className={headingClass}>
          {block.text}
        </Tag>
      );

    case 'paragraph':
      if (!block.content?.trim()) return null;
      const sizeClass = block.size === 'large' ? 'text-lg text-nokturo-900 dark:text-nokturo-100' : block.size === 'small' ? 'text-sm text-nokturo-900/60 dark:text-nokturo-100/60' : 'text-base text-nokturo-900/80 dark:text-nokturo-100/80';
      const alignClass = block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left';
      return (
        <div
          className={`font-body ${sizeClass} ${alignClass} leading-relaxed mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-nokturo-800 dark:[&_a]:text-nokturo-200 [&_a]:underline [&_a]:hover:text-nokturo-900 dark:[&_a]:hover:text-nokturo-100`}
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );

    case 'quote':
      if (!block.text.trim()) return null;
      return (
        <blockquote className="font-headline italic font-light text-[24px] leading-snug text-nokturo-700 dark:text-nokturo-300 my-6 px-5 py-4 border-l-4 border-nokturo-300 dark:border-nokturo-600 bg-nokturo-100 dark:bg-nokturo-800/50 rounded-r-lg">
          {block.text}
        </blockquote>
      );

    case 'list':
      if (!block.items?.length || block.items.every((i) => !i?.trim())) return null;
      const ListTag = block.style === 'numbered' ? 'ol' : 'ul';
      return (
        <ListTag className={`font-body pl-6 my-5 space-y-1 ${block.style === 'numbered' ? 'list-decimal' : 'list-disc'} text-nokturo-700 dark:text-nokturo-300`}>
          {block.items.filter((i) => i?.trim()).map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
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
          {block.caption?.trim() && (
            <figcaption className="mt-1.5 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
              {block.caption}
            </figcaption>
          )}
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
            <figure key={i}>
              <img
                src={img.url}
                alt={img.alt || ''}
                className="w-full aspect-square object-cover"
              />
              {img.caption?.trim() && (
                <figcaption className="mt-1 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      );

    case 'imageGrid':
      if (!block.images?.length) return null;
      const gapR = block.gapRow ?? 8;
      const gapC = block.gapCol ?? 8;
      return (
        <div
          className="my-8"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
            gap: `${gapR}px ${gapC}px`,
          }}
        >
          {block.images.map((img, i) => (
            <figure key={i}>
              <img
                src={img.url}
                alt={img.alt || ''}
                className={`w-full ${getAspectClass(block.aspectRatio)} object-cover`}
              />
              {img.caption?.trim() && (
                <figcaption className="mt-1 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      );

    case 'grid':
      if (!block.cells?.length) return null;
      const gridCols = Math.max(1, block.columns ?? 1);
      const gridRows = Math.max(1, block.rows ?? 1);
      const headerCount = block.headerRowCount ?? 0;
      const headerColCount = block.headerColumnCount ?? 0;
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
            const isHeaderRow = headerCount > 0 && rowIdx < headerCount;
            const isHeaderCol = headerColCount > 0 && colIdx < headerColCount;
            const isHeader = isHeaderRow || isHeaderCol;
            const isLastHeaderRow = headerCount > 0 && rowIdx === headerCount - 1;
            const isLastHeaderCol = headerColCount > 0 && colIdx === headerColCount - 1;
            return (
              <div
                key={i}
                className={`font-body p-2 text-sm ${
                  colIdx === gridCols - 1
                    ? 'border-r-0'
                    : isLastHeaderCol
                      ? 'border-r-2 border-nokturo-300 dark:border-nokturo-600'
                      : 'border-r border-nokturo-200 dark:border-nokturo-700'
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
                  <figure>
                    <img src={cell.content} alt="" className="w-full max-h-24 object-cover" />
                    {cell.caption?.trim() && (
                      <figcaption className="mt-0.5 text-[10px] text-nokturo-500 dark:text-nokturo-400 text-center">
                        {cell.caption}
                      </figcaption>
                    )}
                  </figure>
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
