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
  /** Align top with header row (CATEGORY/STATUS) when used at page level */
  alignWithHeader?: boolean;
  /** Align top with first heading (h1 mt-16) in article */
  alignWithFirstHeading?: boolean;
}

export function TableOfContents({ items, title, className = '', alignWithHeader, alignWithFirstHeading }: TableOfContentsProps) {
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

  return (
    <aside className={`w-[240px] shrink-0 self-stretch ${alignWithHeader ? 'mt-[160px]' : ''} ${alignWithFirstHeading ? 'pt-8' : ''} ${className}`}>
      <nav
        className="sticky top-[76px] font-body bg-nokturo-100 dark:bg-[#1f1f1f]"
        aria-label={t('richText.tableOfContents')}
      >
        <ul className="space-y-0.5 text-[13px] leading-snug border-l border-nokturo-200 dark:border-nokturo-700">
          {items.map((item) => {
            const isActive = currentId === item.id;
            const indent = { 1: 'pl-3', 2: 'pl-5', 3: 'pl-7' }[item.level];
            const weight = item.level === 1 ? 'font-medium' : item.level === 2 ? 'font-normal' : 'font-normal text-[12px]';

            const fadeStyle: React.CSSProperties = {
              maskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 48px), transparent)',
            };

            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`block py-1.5 pr-2 ${indent} -ml-px border-l-2 transition-colors overflow-hidden whitespace-nowrap ${
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
    </aside>
  );
}
