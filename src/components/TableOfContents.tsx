import { useState, useEffect, useRef } from 'react';
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
  const tocListRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  useEffect(() => {
    if (items.length === 0) return;
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
      { root: null, rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (!currentId) return;
    const activeEl = itemRefs.current.get(currentId);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [currentId]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const alignTop = '';
  const stickyTop = sticky ? 'top-[24px]' : 'top-0';
  const asideClass = sticky
    ? `sticky ${stickyTop} self-start shrink-0 w-[240px] h-fit p-0 ${alignTop} ${className}`
    : `fixed left-auto right-0 w-[240px] h-fit p-0 top-[24px] ${alignTop} ${className}`;
  const asideStyle = !sticky && topOffset != null ? { top: topOffset } : undefined;

  return (
    <aside className={`group/toc ${asideClass}`} style={asideStyle}>
      <nav
        className="font-body flex flex-col rounded-[16px] overflow-hidden bg-nokturo-100/70 dark:bg-nokturo-800/60"
        aria-label={t('richText.tableOfContents')}
      >
        <div ref={tocListRef} className="overflow-y-auto overflow-x-hidden max-h-[calc(100vh-120px)]">
          <ul className="space-y-0 text-[13px] leading-snug pt-3 pb-3 px-2 rounded-[16px]">
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
                  ref={(el) => { if (el) itemRefs.current.set(item.id, el); }}
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`group flex items-center gap-2 px-4 py-3 transition-colors overflow-hidden whitespace-nowrap ${
                    isActive
                      ? 'text-nokturo-900 dark:text-nokturo-100'
                      : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200'
                  } ${weight}`}
                  style={fadeStyle}
                >
                  <span className="w-1.5 h-1.5 shrink-0 flex items-center justify-center">
                    <span className={`w-1 h-1 m-px group-hover:w-1.5 group-hover:h-1.5 group-hover:m-0 transition-all duration-150 bg-current shrink-0 opacity-40 group-hover:opacity-60 ${isActive ? '!w-1.5 !h-1.5 !m-0 !opacity-80' : ''}`} style={{ borderRadius: '50%' }} />
                  </span>
                  {item.text}
                </a>
              </li>
            );
          })}
          </ul>
        </div>
      </nav>
      {footerSlot && !sticky && (
        <div className="fixed right-0 bottom-0 w-[240px] opacity-0 group-hover/toc:opacity-100 transition-opacity">
          {footerSlot}
        </div>
      )}
      {footerSlot && sticky && (
        <div className="shrink-0 w-full pt-2 opacity-0 group-hover/toc:opacity-100 transition-opacity">
          {footerSlot}
        </div>
      )}
    </aside>
  );
}
