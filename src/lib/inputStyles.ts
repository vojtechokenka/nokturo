/**
 * Unified input styling across the app.
 * No border, 6px radius, 44px height.
 * Light: bg-nokturo-200/60, Dark: bg-nokturo-700/60
 * Placeholder colors meet WCAG AA 3:1 for UI components.
 */
export const INPUT_CLASS =
  'w-full h-11 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] px-3 py-2 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-500 dark:placeholder-nokturo-500 focus:outline-none focus:ring-2 focus:ring-nokturo-500/50 transition-shadow duration-150';

/** For textareas: min-height 44px, no fixed height so they can grow */
export const TEXTAREA_CLASS =
  'w-full min-h-[44px] bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] px-3 py-2 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-500 dark:placeholder-nokturo-500 focus:outline-none focus:ring-2 focus:ring-nokturo-500/50 transition-shadow duration-150';

/** For inputs on black/dark modal backgrounds */
export const INPUT_CLASS_DARK =
  'w-full h-11 bg-white/10 rounded-[6px] px-3 py-2 text-sm text-white placeholder-nokturo-400 focus:outline-none focus:ring-2 focus:ring-white/30 transition-shadow duration-150';

/** Modal/slide-over heading – used in all modals with black background */
export const MODAL_HEADING_CLASS =
  'text-heading-5 font-semibold text-white tracking-tight truncate min-w-0';
