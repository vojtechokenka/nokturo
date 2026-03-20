import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DefaultAvatar } from './DefaultAvatar';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

// ── Types ─────────────────────────────────────────────────────
export interface MentionProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url?: string | null;
}

export function profileDisplayName(p: MentionProfile): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || '?';
}

// ── Hook ──────────────────────────────────────────────────────
export function useMentionSuggestions(
  inputValue: string,
  profiles: MentionProfile[]
) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [forceClosed, setForceClosed] = useState(false);

  const mentionMatch = useMemo(() => {
    const lastAt = inputValue.lastIndexOf('@');
    if (lastAt === -1) return null;
    if (lastAt > 0 && inputValue[lastAt - 1] !== ' ') return null;
    const rawQuery = inputValue.slice(lastAt + 1);
    if (rawQuery.length > 50) return null;
    return { rawQuery, startIndex: lastAt };
  }, [inputValue]);

  const filtered = useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch.rawQuery.trim().split(/\s/)[0]?.toLowerCase() ?? '';
    if (!q) return [...profiles]; // empty query @ → show all taggable users
    return profiles.filter((p) => {
      const name = [p.first_name, p.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const full = (p.full_name || '').toLowerCase();
      return name.includes(q) || full.includes(q);
    });
  }, [mentionMatch, profiles]);

  const active = !!mentionMatch && filtered.length > 0 && !forceClosed;

  const closeDropdown = useCallback(() => setForceClosed(true), []);

  useEffect(() => {
    setSelectedIdx(0);
    // Don't re-open when the text after @ starts with a completed mention (e.g. "@Alena Okénková see" or "@Alena Okénková, ")
    const r = (mentionMatch?.rawQuery ?? '').trim().toLowerCase();
    const isCompletedMention =
      r &&
      profiles.some((p) => {
        const name = profileDisplayName(p).toLowerCase();
        if (!r.startsWith(name)) return false;
        const next = r[name.length];
        return next === undefined || /[\s,.\-!?;:]/.test(next);
      });
    if (!isCompletedMention) setForceClosed(false);
  }, [mentionMatch?.rawQuery, profiles]);

  /**
   * Call from the input's onKeyDown. Returns:
   * - `'select'` → user pressed Enter/Tab to pick a suggestion (call `applyMention`)
   * - `true`     → event consumed (arrows / escape)
   * - `false`    → not handled, let parent handle
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): 'select' | boolean => {
      if (!active) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % filtered.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIdx]) {
          e.preventDefault();
          return 'select';
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setForceClosed(true);
        return true;
      }
      return false;
    },
    [active, filtered, selectedIdx]
  );

  const getSelectedProfile = useCallback(
    (): MentionProfile | null => (active ? filtered[selectedIdx] ?? null : null),
    [active, filtered, selectedIdx]
  );

  const applyMention = useCallback(
    (profile: MentionProfile): string => {
      if (!mentionMatch) return inputValue;
      const name = profileDisplayName(profile);
      const before = inputValue.slice(0, mentionMatch.startIndex);
      const after = inputValue.slice(
        mentionMatch.startIndex + 1 + mentionMatch.rawQuery.length
      );
      return `${before}@${name} ${after}`;
    },
    [inputValue, mentionMatch]
  );

  return {
    active,
    filtered,
    selectedIdx,
    handleKeyDown,
    getSelectedProfile,
    applyMention,
    closeDropdown,
  };
}

// ── Dropdown component ────────────────────────────────────────
export function MentionDropdown({
  profiles,
  selectedIdx,
  onSelect,
  anchorRef,
}: {
  profiles: MentionProfile[];
  selectedIdx: number;
  onSelect: (profile: MentionProfile) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackAnchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = (anchorRef ?? fallbackAnchorRef) as React.RefObject<HTMLElement | null>;
  const position = useDropdownPosition({
    open: profiles.length > 0,
    triggerRef,
    preferAbove: true,
    matchWidth: true,
    desiredHeight: 144,
    offset: 4,
  });

  useEffect(() => {
    const el = containerRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (profiles.length === 0) return null;

  return (
    <>
      {!anchorRef && <span ref={fallbackAnchorRef} className="block h-0 w-full pointer-events-none" aria-hidden />}
      {position && createPortal(
        <div
          ref={containerRef}
          className="mention-dropdown fixed p-1 bg-white dark:bg-nokturo-700 shadow-lg max-h-36 overflow-y-auto z-50"
          style={{
            ...(position.top !== undefined && { top: position.top }),
            ...(position.bottom !== undefined && { bottom: position.bottom }),
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            maxWidth: position.maxWidth,
          }}
        >
          {profiles.map((p, i) => {
            const name = profileDisplayName(p);
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p);
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  i === selectedIdx
                    ? 'bg-nokturo-100 dark:bg-nokturo-600 text-nokturo-900 dark:text-white'
                    : 'text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600/50'
                }`}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="avatar-round w-6 h-6 object-cover shrink-0" />
                ) : (
                  <DefaultAvatar size={24} className="avatar-round overflow-hidden shrink-0 w-6 h-6" />
                )}
                <span>@{name}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
