import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface TableOfContentsProps {
  items: TocItem[];
  title?: string;
  className?: string;
  /** Optional footer slot (e.g. Edit button) – rendered at bottom, full width */
  footerSlot?: React.ReactNode;
  /** Align top with header row (CATEGORY/STATUS) when used at page level */
  alignWithHeader?: boolean;
  /** Align top with first heading (h1 mt-16) in article */
  alignWithFirstHeading?: boolean;
  /** Override top position (e.g. 340 when header image present) – only when fixed */
  topOffset?: number;
  /** Use sticky positioning – stays within scroll container, no overflow */
  sticky?: boolean;
}

export function TableOfContents({ items, title, className = '', footerSlot, alignWithHeader, alignWithFirstHeading, topOffset, sticky }: TableOfContentsProps) {
  const { t } = useTranslation();
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector('main');
    if (!root || items.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.set(e.target.id, e.boundingClientRect.top);
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

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const asideClass = sticky
    ? `sticky top-6 self-start shrink-0 w-[240px] flex flex-col max-h-[calc(100vh-6rem)] ${alignWithHeader ? 'pt-[108px]' : ''} ${className}`
    : `fixed left-auto right-6 bottom-6 w-[240px] flex flex-col ${topOffset == null ? 'top-[60px]' : ''} ${alignWithHeader ? 'pt-[108px]' : ''} ${className}`;
  const asideStyle = !sticky && topOffset != null ? { top: topOffset } : undefined;

  return (
    <aside className={asideClass} style={asideStyle}>
      <nav
        className="font-body bg-transparent flex-1 min-h-0 flex flex-col overflow-y-auto border-l border-nokturo-200 dark:border-nokturo-700"
        aria-label={t('richText.tableOfContents')}
      >
        <ul className="space-y-0 text-[13px] leading-snug pt-6 pb-6 flex-1 min-h-0">
          {items.filter((item) => item.level <= 2).map((item) => {
            const isActive = currentId === item.id;
            const weight = item.level === 1 ? 'font-medium' : 'font-normal';

            const fadeStyle: React.CSSProperties = {
              maskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent)',
            };

            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`block py-2 px-4 border-l-2 transition-colors overflow-hidden whitespace-nowrap ${
                    isActive
                      ? 'border-nokturo-800 dark:border-nokturo-200 text-nokturo-900 dark:text-nokturo-100'
                      : 'border-transparent text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 hover:border-nokturo-300 dark:hover:border-nokturo-500'
                  } ${weight}`}
                  style={fadeStyle}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {footerSlot && !sticky && (
        <div className="fixed right-6 bottom-6 w-[240px] p-4">
          {footerSlot}
        </div>
      )}
      {footerSlot && sticky && (
        <div className="shrink-0 p-4 pt-0">
          {footerSlot}
        </div>
      )}
    </aside>
  );
}
