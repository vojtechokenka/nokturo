import { useTranslation } from 'react-i18next';
import { TableOfContents, type TocItem } from './TableOfContents';
import { getAspectClass } from './RichTextBlockEditor';
import type { PageElement } from '../types/pageElement';

type HeadingFontFamily = 'headline' | 'body';

interface PageElementViewerProps {
  elements: PageElement[];
  className?: string;
  showToc?: boolean;
  tocTitle?: string;
  tocFooterSlot?: React.ReactNode;
  headerImageSlot?: React.ReactNode;
  headingFont?: HeadingFontFamily;
  /** When set with `headingFont="body"`, H1–H3 use font-weight 500 (Brand Manual). */
  headingWeight?: 'medium';
}

function extractTocItems(elements: PageElement[]): TocItem[] {
  return elements
    .filter((el): el is Extract<PageElement, { type: 'text' }> => el.type === 'text')
    .filter((el) => el.titleVisible ?? true)
    .filter((el) => el.title.trim().length > 0)
    .map((el) => ({ id: el.id, text: el.title.trim(), level: 2 as const }));
}

function ElementView({
  element,
  headingFont,
  headingWeight,
}: {
  element: PageElement;
  headingFont: HeadingFontFamily;
  headingWeight?: 'medium';
}) {
  switch (element.type) {
    case 'text':
      return (
        <section id={element.id} className="scroll-mt-6 mb-6">
          {(element.titleVisible ?? true) && element.title.trim() ? <div className="rte-tag">{element.title.trim()}</div> : null}
          <div
            className={`rte-content ${headingFont === 'headline' ? 'rte-content-headline font-headline [&_p]:font-body [&_blockquote]:font-headline' : `font-body [&_p]:font-body [&_blockquote]:font-body${headingWeight === 'medium' ? ' rte-content-heading-medium' : ''}`} text-nokturo-900 dark:text-nokturo-100 [&_a]:text-nokturo-800 dark:[&_a]:text-nokturo-200 [&_figcaption]:font-body`}
            dangerouslySetInnerHTML={{ __html: element.html }}
          />
        </section>
      );
    case 'image':
      if (!element.url) return null;
      return (
        <figure className="my-8">
          <img
            src={element.url}
            alt={element.alt || ''}
            className={(element.fit ?? 'fill') === 'fill' ? 'w-full object-cover' : 'w-auto max-w-full h-auto'}
          />
          {element.caption?.trim() ? (
            <figcaption className="mt-1.5 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
              {element.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'gallery':
      if (!element.images.length) return null;
      return (
        <div className="grid gap-3 my-8" style={{ gridTemplateColumns: `repeat(${element.columns}, 1fr)` }}>
          {element.images.map((img, i) => (
            <figure key={`${img.url}-${i}`}>
              <img src={img.url} alt={img.alt || ''} className="w-full aspect-square object-cover" />
              {img.caption?.trim() ? (
                <figcaption className="mt-1 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
                  {img.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      );
    case 'imageGrid':
      if (!element.images.length) return null;
      return (
        <div
          className="my-8"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${element.columns}, 1fr)`,
            gap: `${element.gapRow}px ${element.gapCol}px`,
          }}
        >
          {element.images.map((img, i) => (
            <figure key={`${img.url}-${i}`}>
              <img src={img.url} alt={img.alt || ''} className={`w-full ${getAspectClass(element.aspectRatio)} object-cover`} />
              {img.caption?.trim() ? (
                <figcaption className="mt-1 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
                  {img.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      );
    case 'grid':
      if (!element.cells.length) return null;
      return (
        <div
          className="my-8"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, element.columns)}, minmax(80px, 1fr))`,
            gap: 2,
          }}
        >
          {element.cells.slice(0, element.rows * element.columns).map((cell, i) => {
            const rowIdx = Math.floor(i / element.columns);
            const colIdx = i % element.columns;
            const isHeader = rowIdx < element.headerRowCount || colIdx < element.headerColumnCount;
            return (
              <div
                key={i}
                className={`p-2 text-sm ${isHeader ? 'bg-nokturo-100 dark:bg-nokturo-800 font-semibold text-nokturo-900 dark:text-nokturo-100' : 'bg-white/50 dark:bg-nokturo-900/60 text-nokturo-700 dark:text-nokturo-300'}`}
              >
                {cell.type === 'image' ? (
                  cell.content ? <img src={cell.content} alt="" className="w-full max-h-24 object-cover" /> : null
                ) : (
                  <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: cell.content }} />
                )}
              </div>
            );
          })}
        </div>
      );
    case 'divider':
      return (
        <div className="my-10">
          <hr className="rte-divider" />
        </div>
      );
    case 'button':
      return (
        <div className="my-8">
          <a
            href={element.url || '#'}
            target={element.newTab ? '_blank' : '_self'}
            rel={element.newTab ? 'noopener noreferrer' : undefined}
            className="rte-cta-button rounded-[10px] bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 hover:opacity-90 transition-opacity"
          >
            {element.text}
          </a>
        </div>
      );
    default:
      return null;
  }
}

export function PageElementViewer({
  elements,
  className = '',
  showToc = true,
  tocTitle,
  tocFooterSlot,
  headerImageSlot,
  headingFont = 'headline',
  headingWeight,
}: PageElementViewerProps) {
  const { t } = useTranslation();
  const tocItems = extractTocItems(elements);

  if (!elements.length) {
    const emptyHeaderWrapper = headerImageSlot ? (
      <div className="-ml-4 w-[calc(100%+2rem)] sm:-ml-[3.75rem] sm:w-[calc(100%+3.75rem)]">
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
    <article className="font-body max-w-none sm:max-w-[680px]">
      {elements.map((element) => (
        <ElementView key={element.id} element={element} headingFont={headingFont} headingWeight={headingWeight} />
      ))}
    </article>
  );

  const headerImageWrapper = headerImageSlot ? (
    <div className="-ml-4 w-[calc(100%+2rem)] sm:-ml-[3.75rem] sm:w-[calc(100%+3.75rem)]">
      {headerImageSlot}
    </div>
  ) : null;

  if (showToc && tocItems.length > 0) {
    return (
      <div className={`flex flex-col sm:flex-row items-start gap-0 sm:gap-[80px] ${className}`}>
        <div className="min-w-0 flex-1 max-w-none sm:max-w-[860px]">
          {headerImageWrapper}
          {content}
        </div>
        <TableOfContents
          items={tocItems}
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

