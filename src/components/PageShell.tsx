interface PageShellProps {
  titleKey?: string;
  descriptionKey?: string;
  children?: React.ReactNode;
  headerSlot?: React.ReactNode;
  /** Renders above scrollable content, outside overflow – e.g. Filter + Add buttons */
  actionsSlot?: React.ReactNode;
  /** When true: no frame (rounded box, bg), no padding – content directly in layout (e.g. Moodboard) */
  bare?: boolean;
  /** When true: reduced vertical padding (py-2) in content area – for dense list layouts (e.g. Suppliers) */
  compactContent?: boolean;
  /** When true: no horizontal padding (px) in content area – for full-bleed list layouts */
  noHorizontalPadding?: boolean;
  /** When true: no padding (px/py) in content area – for edge-to-edge layouts */
  noContentPadding?: boolean;
  /** Content box background – 'black' for dark full-bleed (e.g. Products, Sampling) */
  contentBg?: 'default' | 'black';
  /** When false: no rounded corners on content (for list rows that should be sharp) */
  contentRounded?: boolean;
  /** When 'hidden': content area does not scroll – use for fixed-height layouts (e.g. task detail + comments grid) */
  contentOverflow?: 'auto' | 'hidden';
}

/**
 * Reusable page wrapper for module views.
 */
export function PageShell({ children, headerSlot, actionsSlot, bare = false, compactContent = false, noHorizontalPadding = false, noContentPadding = false, contentBg = 'default', contentRounded = true, contentOverflow = 'auto' }: PageShellProps) {
  if (bare) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {headerSlot}
        {actionsSlot && (
          <div className="shrink-0 w-full flex flex-wrap gap-1.5 mt-0 mb-0 py-6 items-center justify-end px-4 sm:px-6">
            {actionsSlot}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {children ?? null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {headerSlot}
      {actionsSlot && (
        <div className="shrink-0 px-6 pt-6 pb-6">
          {actionsSlot}
        </div>
      )}
      <div className={`flex-1 min-h-0 overflow-hidden flex flex-col ${contentRounded ? 'rounded-[12px]' : 'rounded-none'} ${contentBg === 'black' ? 'bg-black' : 'bg-white/5'}`}>
        <div className={`flex-1 min-h-0 flex flex-col ${
          contentOverflow === 'hidden' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden scrollbar-hide'
        } ${
          noContentPadding && contentBg === 'black' ? 'p-3' : noHorizontalPadding || noContentPadding ? '' : 'px-9'
        } ${!noContentPadding ? (compactContent ? 'py-2' : 'py-6') : ''}`}>
          {children ? (
            children
          ) : (
            <div className="p-8 text-center text-nokturo-500 dark:text-nokturo-400">
              <span>Module content will be implemented here.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
