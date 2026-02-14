/**
 * Sdílený Table of Contents – jednotný styl a chování pro RichTextBlockViewer i CommentableRichTextViewer
 * Chevron na konci řádku (součást odkazu). Defaultně zabalené; při hoveru na H1/H2 se rozbalí děti.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface TableOfContentsProps {
  items: TocItem[];
  title?: string;
  className?: string;
  /** Align top with header row (CATEGORY/STATUS) when used at page level */
  alignWithHeader?: boolean;
  /** Align top with first heading (h1 mt-16) in article */
  alignWithFirstHeading?: boolean;
}

/** H2 s H3 children */
interface H2WithChildren {
  item: TocItem;
  children: TocItem[];
}

/** H1 s H2 children */
interface H1WithChildren {
  item: TocItem;
  children: H2WithChildren[];
}

/** Top-level: H1 nebo orphan H2 */
type TopLevel = H1WithChildren | H2WithChildren;

/** Build tree: H1 -> H2 children -> H3 children. H3 přímo pod H1 (bez H2) → virtuální H2. */
function buildTree(items: TocItem[]): TopLevel[] {
  const result: TopLevel[] = [];
  let currentH1: H1WithChildren | null = null;
  let currentH2: H2WithChildren | null = null;

  for (const item of items) {
    if (item.level === 1) {
      currentH2 = null;
      currentH1 = { item, children: [] };
      result.push(currentH1);
    } else if (item.level === 2) {
      currentH2 = { item, children: [] };
      if (currentH1) currentH1.children.push(currentH2);
      else result.push(currentH2);
    } else if (item.level === 3) {
      if (currentH2) {
        currentH2.children.push(item);
      } else if (currentH1) {
        // H3 přímo pod H1 (bez H2) → virtuální H2, zobrazí se jako řádek pod H1
        currentH1.children.push({ item, children: [] });
      }
    }
  }
  return result;
}

export function TableOfContents({ items, title, className = '', alignWithHeader, alignWithFirstHeading }: TableOfContentsProps) {
  const { t } = useTranslation();
  const tree = buildTree(items);
  const [expandedH1, setExpandedH1] = useState<Set<string>>(() => new Set());
  const [expandedH2, setExpandedH2] = useState<Set<string>>(() => new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector('main');
    if (!root || items.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const rect = e.boundingClientRect;
            visible.set(e.target.id, rect.top);
          } else {
            visible.delete(e.target.id);
          }
        }
        if (visible.size > 0) {
          const closest = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
          setCurrentId(closest[0]);
        }
      },
      { root, rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  const linkClass = (id: string, base: string) =>
    `${base} ${currentId === id ? 'bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200 dark:hover:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100' : ''}`;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleH1 = (id: string) => {
    setExpandedH1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleH2 = (id: string) => {
    setExpandedH2((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className={`w-[280px] shrink-0 ${alignWithHeader ? 'mt-[160px]' : ''} ${alignWithFirstHeading ? 'pt-16' : ''} ${className}`}>
      <nav
        className="sticky top-[24px] rounded-lg bg-white dark:bg-nokturo-800 p-4 font-body"
        aria-label={t('richText.tableOfContents')}
      >
        <ul className="space-y-0.5 text-sm">
          {tree.map((node) => {
            const item = node.item;
            const isH1 = item.level === 1;
            const h2Children = isH1 ? (node as H1WithChildren).children : [];
            const h3Children = !isH1 ? (node as H2WithChildren).children : [];

            return (
              <li
                key={item.id}
                onMouseEnter={
                  isH1 && h2Children.length > 0
                    ? () => setExpandedH1((prev) => new Set(prev).add(item.id))
                    : !isH1 && h3Children.length > 0
                      ? () => setExpandedH2((prev) => new Set(prev).add(item.id))
                      : undefined
                }
                onMouseLeave={
                  isH1 && h2Children.length > 0
                    ? () => setExpandedH1((prev) => { const next = new Set(prev); next.delete(item.id); return next; })
                    : !isH1 && h3Children.length > 0
                      ? () => setExpandedH2((prev) => { const next = new Set(prev); next.delete(item.id); return next; })
                      : undefined
                }
              >
                {/* H1 nebo orphan H2 řádek – chevron na konci řádku, součást odkazu */}
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleLinkClick(e, item.id)}
                  className={linkClass(item.id, 'flex items-center gap-1 min-w-0 py-1 px-1.5 rounded text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors group')}
                >
                  <span className="flex-1 min-w-0 truncate">{item.text}</span>
                  {isH1 && h2Children.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleH1(item.id);
                      }}
                      className="shrink-0 p-0.5 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300 group-hover:text-nokturo-600 dark:group-hover:text-nokturo-400 transition-colors"
                      aria-expanded={expandedH1.has(item.id)}
                    >
                      {expandedH1.has(item.id) ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  {!isH1 && h3Children.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleH2(item.id);
                      }}
                      className="shrink-0 p-0.5 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300 group-hover:text-nokturo-600 dark:group-hover:text-nokturo-400 transition-colors"
                      aria-expanded={expandedH2.has(item.id)}
                    >
                      {expandedH2.has(item.id) ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </a>
                {/* H2 children – zobrazí se při kliku na chevron */}
                {isH1 && h2Children.length > 0 && expandedH1.has(item.id) && (
                  <ul className="mt-0.5 space-y-0.5 border-l border-nokturo-200 dark:border-nokturo-600 pl-3 ml-4">
                    {h2Children.map(({ item: h2, children: h3s }) => (
                      <li
                        key={h2.id}
                        onMouseEnter={h3s.length > 0 ? () => setExpandedH2((prev) => new Set(prev).add(h2.id)) : undefined}
                        onMouseLeave={h3s.length > 0 ? () => setExpandedH2((prev) => { const next = new Set(prev); next.delete(h2.id); return next; }) : undefined}
                      >
                        <a
                          href={`#${h2.id}`}
                          onClick={(e) => handleLinkClick(e, h2.id)}
                          className={linkClass(h2.id, 'flex items-center gap-1 min-w-0 py-1 px-1.5 rounded text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 transition-colors font-medium group')}
                        >
                          <span className="flex-1 min-w-0 truncate">{h2.text}</span>
                          {h3s.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleH2(h2.id);
                              }}
                              className="shrink-0 p-0.5 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300 group-hover:text-nokturo-600 dark:group-hover:text-nokturo-400 transition-colors"
                              aria-expanded={expandedH2.has(h2.id)}
                            >
                              {expandedH2.has(h2.id) ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </a>
                        {h3s.length > 0 && expandedH2.has(h2.id) && (
                          <ul className="mt-0.5 space-y-0.5 border-l border-nokturo-200 dark:border-nokturo-600 pl-2 ml-4">
                            {h3s.map((h3) => (
                              <li key={h3.id}>
                                <a
                                  href={`#${h3.id}`}
                                  onClick={(e) => handleLinkClick(e, h3.id)}
                                  className={linkClass(h3.id, 'block py-0.5 px-1.5 rounded text-nokturo-500 dark:text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 truncate transition-colors text-xs font-normal')}
                                >
                                  {h3.text}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!isH1 && h3Children.length > 0 && expandedH2.has(item.id) && (
                  <ul className="mt-0.5 space-y-0.5 border-l border-nokturo-200 dark:border-nokturo-600 pl-3 ml-4">
                    {h3Children.map((h3) => (
                      <li key={h3.id}>
                        <a
                          href={`#${h3.id}`}
                          onClick={(e) => handleLinkClick(e, h3.id)}
                          className={linkClass(h3.id, 'block py-0.5 px-1.5 rounded text-nokturo-500 hover:text-nokturo-700 hover:bg-nokturo-50 truncate transition-colors text-xs font-normal')}
                        >
                          {h3.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
