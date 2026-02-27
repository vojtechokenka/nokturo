/**
 * Notion-style commentable rich text viewer.
 * User can select any text → "Comment" appears → add comment → text gets highlighted.
 */
import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { hasPermission, canDeleteAnything } from '../lib/rbac';
import type { RichTextBlock } from './RichTextBlockEditor';
import { getAspectClass } from './RichTextBlockEditor';
import { extractHeadings, type HeadingFontFamily } from './RichTextBlockViewer';
import type { TocItem } from './TableOfContents';
import { TableOfContents } from './TableOfContents';
import { MessageSquare, Send, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';
import { renderContentWithMentions } from '../lib/renderMentions';
import { INPUT_CLASS } from '../lib/inputStyles';
import { useMentionSuggestions, MentionDropdown } from './MentionSuggestions';
import type { MentionProfile } from './MentionSuggestions';
import { sendMentionNotifications, parseMentionsFromText } from '../lib/sendMentionNotifications';

// ── Types ─────────────────────────────────────────────────────
export interface TextComment {
  id: string;
  product_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  block_id: string;
  selected_text: string;
  start_offset: number | null;
  end_offset: number | null;
  created_at: string;
  profile?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url: string | null;
  };
}

interface ProfileOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}

interface CommentableRichTextViewerProps {
  blocks: RichTextBlock[];
  productId: string;
  /** Short description (e.g. from product) – rendered first, commentable */
  shortDescription?: string;
  className?: string;
  /** Show Table of Contents sidebar (default: true) */
  showToc?: boolean;
  /** TOC header label (e.g. "Obsah") */
  tocTitle?: string;
  /** Additional sections rendered in the content column (below description), so they don't overlap TOC */
  sections?: React.ReactNode;
  /** TOC items for section headings (e.g. Linked Materials, Labels, Design gallery) – merged with block headings */
  sectionTocItems?: TocItem[];
  /** When true, TOC is not rendered inside – parent renders it via onTocItems (for page-level alignment) */
  renderTocExternally?: boolean;
  /** Called with tocItems when renderTocExternally – parent renders TableOfContents */
  onTocItems?: (items: TocItem[]) => void;
  /** Which font family to use for headings: 'headline' = IvyPresto, 'body' = Inter */
  headingFont?: HeadingFontFamily;
}

// ── Helper: wrap text with multiple highlights (each comment independent) ─────
function highlightTextMultiple(text: string, comments: TextComment[]): React.ReactNode {
  const segments: { start: number; end: number; commentId: string }[] = [];
  for (const c of comments) {
    const sel = c.selected_text;
    if (!sel || !text.includes(sel)) continue;
    const idx = text.indexOf(sel);
    segments.push({ start: idx, end: idx + sel.length, commentId: c.id });
  }
  segments.sort((a, b) => a.start - b.start);
  // Filter overlaps: keep first, skip overlapping
  const filtered: typeof segments = [];
  for (const seg of segments) {
    if (filtered.length === 0 || seg.start >= filtered[filtered.length - 1].end) {
      filtered.push(seg);
    }
  }
  let result: React.ReactNode[] = [];
  let pos = 0;
  for (const seg of filtered) {
    if (seg.start > pos) result.push(text.slice(pos, seg.start));
    result.push(
      <mark
        key={seg.commentId}
        data-comment-id={seg.commentId}
        className="bg-amber-200 dark:bg-white/10 rounded px-0 cursor-pointer hover:bg-amber-300/80 dark:hover:bg-white/20 text-black dark:text-white transition-colors"
      >
        {text.slice(seg.start, seg.end)}
      </mark>
    );
    pos = seg.end;
  }
  if (pos < text.length) result.push(text.slice(pos));
  return result.length === 0 ? text : <>{result}</>;
}

// ── Helper: wrap text with pending selection (gray, stays visible while commenting) ─────
// No padding to avoid layout shift
function highlightPendingSelection(text: string, selectedText: string, blockId: string): React.ReactNode {
  if (!selectedText || !text.includes(selectedText)) return text;
  const idx = text.indexOf(selectedText);
  return (
    <>
      {text.slice(0, idx)}
      <span className="rounded bg-neutral-300/70" data-pending-selection data-pending-selection-block-id={blockId}>
        {selectedText}
      </span>
      {text.slice(idx + selectedText.length)}
    </>
  );
}

// ── Block with comment support ─────────────────────────────────
function CommentableBlockView({
  block,
  blockComments,
  pendingSelection,
  headingFont = 'headline',
}: {
  block: RichTextBlock;
  comments: TextComment[];
  blockComments: TextComment[];
  pendingSelection: { blockId: string; selectedText: string } | null;
  headingFont?: HeadingFontFamily;
}) {
  const isPendingBlock = pendingSelection?.blockId === block.id;
  const isHeadline = headingFont === 'headline';
  const hFont = isHeadline ? 'font-headline' : 'font-body';
  const hSizeClass =
    block.level === 1
      ? isHeadline ? 'text-[48px]' : 'text-[30px]'
      : block.level === 2
        ? isHeadline ? 'text-[40px]' : 'text-[24px]'
        : 'text-[20px]';

  if (block.type === 'heading' && block.text?.trim()) {
    const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
    const headingClass = {
      1: `${hFont} ${hSizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 mt-16 mb-4 scroll-mt-6 leading-[1.1]`,
      2: `${hFont} ${hSizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 mb-4 scroll-mt-6 leading-[1.2]`,
      3: `${hFont} ${hSizeClass} font-normal text-nokturo-900 dark:text-nokturo-100 mt-8 mb-3 scroll-mt-6`,
    }[block.level];
    const text = block.text;
    const display = isPendingBlock
      ? highlightPendingSelection(text, pendingSelection!.selectedText, block.id)
      : blockComments.length > 0
        ? highlightTextMultiple(text, blockComments)
        : text;
    if (block.level === 2) {
      return (
        <>
          <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
          <Tag id={block.id} className={headingClass} data-block-id={block.id}>
            {display}
          </Tag>
        </>
      );
    }
    return (
      <Tag id={block.id} className={headingClass} data-block-id={block.id}>
        {display}
      </Tag>
    );
  }

  if (block.type === 'quote' && block.text?.trim()) {
    const text = block.text;
    const display = isPendingBlock
      ? highlightPendingSelection(text, pendingSelection!.selectedText, block.id)
      : blockComments.length > 0
        ? highlightTextMultiple(text, blockComments)
        : text;
    return (
      <blockquote
        className="font-body pl-4 text-nokturo-600 dark:text-nokturo-400 italic my-6 py-1"
        data-block-id={block.id}
      >
        {display}
      </blockquote>
    );
  }

  // Paragraph: support multiple independent highlights per block
  if (block.type === 'paragraph' && block.content?.trim()) {
    const sizeClass = block.size === 'large' ? 'text-lg text-nokturo-900 dark:text-nokturo-100' : block.size === 'small' ? 'text-sm text-nokturo-900/60 dark:text-nokturo-100/60' : 'text-base text-nokturo-900/80 dark:text-nokturo-100/80';
    const alignClass = block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left';
    let html = block.content;
    if (isPendingBlock && pendingSelection!.selectedText) {
      const escaped = pendingSelection!.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blockId = block.id.replace(/"/g, '&quot;');
      html = html.replace(new RegExp(escaped), (match) =>
        `<span class="rounded bg-neutral-300/70" data-pending-selection data-pending-selection-block-id="${blockId}">${match}</span>`
      );
    } else {
      // Replace from end to start to avoid position shifting
      const toReplace = blockComments
        .filter((c) => c.selected_text && html.includes(c.selected_text))
        .map((c) => ({ comment: c, idx: html.indexOf(c.selected_text!) }))
        .sort((a, b) => b.idx - a.idx);
      for (const { comment } of toReplace) {
        const escaped = comment.selected_text!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(escaped), (match) =>
          `<mark data-comment-id="${comment.id}" class="bg-amber-200 dark:bg-white/10 rounded px-0 cursor-pointer hover:bg-amber-300/80 dark:hover:bg-white/20 text-black dark:text-white">${match}</mark>`
        );
      }
    }
    return (
      <div
        className={`font-body ${sizeClass} ${alignClass} leading-relaxed mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-nokturo-800 dark:[&_a]:text-nokturo-200 [&_a]:underline [&_a]:hover:text-nokturo-900 dark:[&_a]:hover:text-nokturo-100`}
        data-block-id={block.id}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Other blocks: render without comment support
  if (block.type === 'image' && block.url) {
    return (
      <figure className="my-8" data-block-id={block.id}>
        <img src={block.url} alt={block.alt || ''} className="w-full object-cover" />
        {block.caption?.trim() && (
          <figcaption className="mt-1.5 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === 'gallery' && block.images?.length) {
    return (
      <div
        className="grid gap-3 my-8"
        style={{ gridTemplateColumns: `repeat(${block.columns}, 1fr)` }}
        data-block-id={block.id}
      >
        {block.images.map((img, i) => (
          <figure key={i}>
            <img src={img.url} alt={img.alt || ''} className="w-full aspect-square object-cover" />
            {img.caption?.trim() && (
              <figcaption className="mt-1 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }
  if (block.type === 'imageGrid' && block.images?.length) {
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
        data-block-id={block.id}
      >
        {block.images.map((img, i) => (
          <figure key={i}>
            <img src={img.url} alt={img.alt || ''} className={`w-full ${getAspectClass(block.aspectRatio)} object-cover`} />
            {img.caption?.trim() && (
              <figcaption className="mt-1 text-xs text-nokturo-500 dark:text-nokturo-400 text-center">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }
  if (block.type === 'link' && block.url) {
    return (
      <p className="font-body mb-5" data-block-id={block.id}>
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-nokturo-800 dark:text-nokturo-200 underline hover:text-nokturo-900 dark:hover:text-nokturo-100">
          {block.text?.trim() || block.url}
        </a>
      </p>
    );
  }
  if (block.type === 'list' && block.items?.some((i) => i?.trim())) {
    const ListTag = block.style === 'numbered' ? 'ol' : 'ul';
    return (
      <ListTag
        className={`font-body pl-6 my-5 space-y-1 ${block.style === 'numbered' ? 'list-decimal' : 'list-disc'} text-nokturo-700 dark:text-nokturo-300`}
        data-block-id={block.id}
      >
        {block.items.filter((i) => i?.trim()).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ListTag>
    );
  }
  if (block.type === 'divider') {
    return (
      <div className="my-8" data-block-id={block.id}>
        <hr className="border-0 border-t border-nokturo-300 dark:border-nokturo-600" />
      </div>
    );
  }
  if (block.type === 'grid' && block.cells?.length) {
    const gridCols = Math.max(1, block.columns ?? 1);
    const gridRows = Math.max(1, block.rows ?? 1);
    const headerCount = block.headerRowCount ?? 0;
    const headerColCount = block.headerColumnCount ?? 0;
    return (
      <div
        className="border border-nokturo-200 dark:border-nokturo-600 my-8 overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, minmax(80px, 1fr))` }}
        data-block-id={block.id}
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
                    ? 'border-r-2 border-nokturo-300 dark:border-nokturo-500'
                    : 'border-r border-nokturo-200 dark:border-nokturo-600'
              } ${
                rowIdx === gridRows - 1
                  ? 'border-b-0'
                  : isLastHeaderRow
                    ? 'border-b-2 border-nokturo-300 dark:border-nokturo-500'
                    : 'border-b border-nokturo-200 dark:border-nokturo-600'
              } ${
                isHeader ? 'bg-nokturo-100 dark:bg-nokturo-700 font-semibold text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-700 dark:text-nokturo-300'
              }`}
            >
              {cell.type === 'text' ? (
                cell.content?.trim() ? <span className="whitespace-pre-wrap [&_a]:underline [&_a]:text-blue-600 dark:[&_a]:text-blue-400" dangerouslySetInnerHTML={{ __html: cell.content }} /> : null
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
  }

  return null;
}

// ── Main component ────────────────────────────────────────────
export function CommentableRichTextViewer({ blocks, productId, shortDescription, className = '', showToc = true, tocTitle, sections, sectionTocItems, renderTocExternally, onTocItems, headingFont = 'body' }: CommentableRichTextViewerProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canComment = user?.role ? (
    hasPermission(user.role, 'production.products', 'comment') ||
    hasPermission(user.role, 'production.sampling', 'comment')
  ) : false;
  const canDelete = user?.role ? canDeleteAnything(user.role) : false;
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextBackdropClickRef = useRef(false);

  const [comments, setComments] = useState<TextComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionState, setSelectionState] = useState<{
    blockId: string;
    selectedText: string;
    rect: DOMRect;
  } | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [threadPopoverPosition, setThreadPopoverPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const [displayParentOverrides, setDisplayParentOverrides] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, avatar_url')
      .neq('id', user?.id ?? '');
    setProfiles((data || []) as ProfileOption[]);
  }, [user?.id]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const mention = useMentionSuggestions(commentInput, profiles as MentionProfile[]);

  const handleMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = mention.applyMention(profile);
    setCommentInput(newValue);
    if (!taggedUsers.includes(profile.id)) {
      setTaggedUsers((prev) => {
        const next = [...prev, profile.id];
        if (import.meta.env.DEV) console.log('[CommentableRichTextViewer] handleMentionSelect: added', { profileId: profile.id, taggedUsersAfter: next });
        return next;
      });
    }
    mention.closeDropdown();
  }, [mention, taggedUsers]);

  useEffect(() => {
    if (!selectionState) {
      setTaggedUsers((prev) => {
        if (prev.length && import.meta.env.DEV) {
          console.log('[CommentableRichTextViewer] selectionState cleared → taggedUsers reset (user may have clicked outside before submit)', { hadTaggedUsers: prev });
        }
        return [];
      });
    }
  }, [selectionState]);

  useEffect(() => {
    if (!user?.id) {
      setCurrentAuthorId(null);
      return;
    }
    if (user.id !== 'dev-user') {
      setCurrentAuthorId(user.id);
      return;
    }
    supabase.from('profiles').select('id').limit(1).single().then(({ data }) => {
      setCurrentAuthorId(data?.id ?? null);
    });
  }, [user?.id]);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('product_text_comments')
      .select('*, profile:profiles!product_text_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    setComments((data || []) as TextComment[]);
  }, [productId]);

  useEffect(() => {
    setLoading(true);
    fetchComments().finally(() => setLoading(false));
  }, [fetchComments]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`text-comments-${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_text_comments',
          filter: `product_id=eq.${productId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as TextComment;
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, first_name, last_name, avatar_url')
              .eq('id', row.author_id)
              .single();
            const enriched: TextComment = { ...row, profile: profile || { avatar_url: null } };
            setComments((prev) => (prev.some((c) => c.id === enriched.id) ? prev : [...prev, enriched]));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id && c.parent_id !== oldRow.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TextComment;
            // Preserve profile from existing comment – real-time payload has no joined data
            setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated, profile: c.profile } : c)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  // Position popover relative to container so it scrolls with content (not fixed)
  useLayoutEffect(() => {
    if (!selectionState || !containerRef.current) return;
    const anchor = containerRef.current.querySelector(
      `[data-pending-selection-block-id="${selectionState.blockId}"]`
    ) as HTMLElement | null;
    const container = containerRef.current;
    if (anchor) {
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      setPopoverPosition({
        top: anchorRect.top - containerRect.top - 100,
        left: Math.max(0, Math.min(containerRect.width - 320, anchorRect.left - containerRect.left + anchorRect.width / 2 - 160)),
      });
    } else {
      const containerRect = container.getBoundingClientRect();
      setPopoverPosition({
        top: selectionState.rect.top - containerRect.top - 100,
        left: Math.max(0, Math.min(containerRect.width - 320, selectionState.rect.left - containerRect.left + selectionState.rect.width / 2 - 160)),
      });
    }
  }, [selectionState?.blockId, selectionState?.rect]);

  // Position thread popover near the highlighted source (mark element)
  // From anchor center, pick the direction (left/right/above/below) with the most available space
  useLayoutEffect(() => {
    if (!activeThreadId || !containerRef.current) {
      setThreadPopoverPosition(null);
      return;
    }
    const anchor = containerRef.current.querySelector(
      `[data-comment-id="${activeThreadId}"]`
    ) as HTMLElement | null;
    if (!anchor) {
      setThreadPopoverPosition(null);
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const centerX = anchorRect.left + anchorRect.width / 2;
    const centerY = anchorRect.top + anchorRect.height / 2;
    const popoverWidth = 384; // w-96
    const popoverMinHeight = 280;
    const gap = 8;
    const padding = 16;

    // Space from anchor center toward each viewport edge
    const spaceLeft = centerX;
    const spaceRight = window.innerWidth - centerX;
    const spaceAbove = centerY;
    const spaceBelow = window.innerHeight - centerY;

    // Which directions have enough room for the popover?
    const canBelow = spaceBelow >= popoverMinHeight + gap + padding;
    const canAbove = spaceAbove >= popoverMinHeight + gap + padding;
    const canRight = spaceRight >= popoverWidth + gap + padding;
    const canLeft = spaceLeft >= popoverWidth + gap + padding;

    const candidates: { dir: 'below' | 'above' | 'right' | 'left'; space: number }[] = [];
    if (canBelow) candidates.push({ dir: 'below', space: spaceBelow });
    if (canAbove) candidates.push({ dir: 'above', space: spaceAbove });
    if (canRight) candidates.push({ dir: 'right', space: spaceRight });
    if (canLeft) candidates.push({ dir: 'left', space: spaceLeft });

    // Pick direction with most space; fallback to below if none fit
    const best = candidates.length > 0
      ? candidates.reduce((a, b) => (a.space > b.space ? a : b))
      : { dir: 'below' as const, space: 0 };

    let top: number | undefined;
    let bottom: number | undefined;
    let left: number;

    const hCenter = Math.max(
      padding,
      Math.min(window.innerWidth - popoverWidth - padding, centerX - popoverWidth / 2)
    );
    const vCenter = Math.max(
      padding,
      Math.min(window.innerHeight - popoverMinHeight - padding, centerY - popoverMinHeight / 2)
    );

    switch (best.dir) {
      case 'below':
        top = anchorRect.bottom + gap;
        left = hCenter;
        break;
      case 'above':
        bottom = window.innerHeight - anchorRect.top + gap;
        left = hCenter;
        break;
      case 'right':
        left = Math.min(anchorRect.right + gap, window.innerWidth - popoverWidth - padding);
        top = vCenter;
        break;
      case 'left':
        left = Math.max(padding, anchorRect.left - popoverWidth - gap);
        top = vCenter;
        break;
    }

    setThreadPopoverPosition({ top, left, bottom });
  }, [activeThreadId]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!canComment) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-comment-popover]')) {
      return;
    }
    setAddError(null);
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text) {
      setSelectionState(null);
      setPopoverPosition(null);
      return;
    }
    const range = sel?.getRangeAt(0);
    if (!range) return;
    const blockEl = range.commonAncestorContainer?.parentElement?.closest('[data-block-id]');
    if (!blockEl) {
      setSelectionState(null);
      setPopoverPosition(null);
      return;
    }
    const blockId = blockEl.getAttribute('data-block-id');
    if (!blockId) return;
    // If selection is entirely inside an existing comment highlight, open thread instead of add-comment
    const selectionInComment = (range.commonAncestorContainer?.parentElement?.closest('[data-comment-id]') as HTMLElement | null);
    if (selectionInComment) {
      const commentId = selectionInComment.getAttribute('data-comment-id');
      if (commentId && comments.some((c) => c.id === commentId)) {
        setSelectionState(null);
        setPopoverPosition(null);
        setActiveThreadId(commentId);
        window.getSelection()?.removeAllRanges();
        return;
      }
    }
    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    setSelectionState({ blockId, selectedText: text, rect });
    if (container) {
      const containerRect = container.getBoundingClientRect();
      setPopoverPosition({
        top: rect.top - containerRect.top - 100,
        left: Math.max(0, Math.min(containerRect.width - 320, rect.left - containerRect.left + rect.width / 2 - 160)),
      });
    } else {
      setPopoverPosition({ top: rect.top - 100, left: rect.left + rect.width / 2 - 160 });
    }
  }, [canComment, comments]);

  const handleAddComment = useCallback(async () => {
    setAddError(null);
    let authorId = getUserIdForDb();
    if (!authorId && user?.id === 'dev-user') {
      const { data: firstProfile } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      authorId = firstProfile?.id ?? null;
    }
    if (!user || !authorId || !selectionState || !commentInput.trim()) {
      if (!user || !authorId) setAddError(t('comments.loginRequired'));
      return;
    }

    const taggedUsersSnapshot = [...taggedUsers];
    if (import.meta.env.DEV) console.log('[CommentableRichTextViewer] handleAddComment SUBMIT – taggedUsers at submit', { taggedUsersSnapshot });

    setSending(true);
    const { data, error } = await supabase
      .from('product_text_comments')
      .insert({
        product_id: productId,
        author_id: authorId,
        block_id: selectionState.blockId,
        selected_text: selectionState.selectedText,
        content: commentInput.trim(),
      })
      .select('*, profile:profiles!product_text_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)')
      .single();
    setSending(false);
    if (!error && data) {
      setComments((prev) => [...prev, data as TextComment]);

      // Create notifications for tagged users
      if (import.meta.env.DEV && taggedUsersSnapshot.length === 0) {
        const parsedNames = parseMentionsFromText(commentInput.trim());
        if (parsedNames.length) {
          console.log('[CommentableRichTextViewer] PARSER: mentions in text but taggedUsers empty', { content: commentInput.trim().slice(0, 100), parsedMentionNames: parsedNames });
        }
      }
      if (taggedUsersSnapshot.length > 0) {
        if (import.meta.env.DEV) console.log('[CommentableRichTextViewer] calling sendMentionNotifications', { taggedUsersSnapshot });
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        await sendMentionNotifications({
          taggedUserIds: taggedUsersSnapshot,
          authorId,
          authorName,
          content: commentInput.trim(),
          type: 'text_tag',
          link: `/production/sampling/${productId}`,
        });
      }

      setCommentInput('');
      setTaggedUsers([]);
      setSelectionState(null);
      setPopoverPosition(null);
      setAddError(null);
      window.getSelection()?.removeAllRanges();
    } else {
      setAddError(error?.message || t('comments.postFailed'));
    }
  }, [user, productId, selectionState, commentInput, taggedUsers]);

  const handleReply = useCallback(async (parentId: string, displayParentContent?: string) => {
    let authorId = getUserIdForDb();
    if (!authorId && user?.id === 'dev-user') {
      const { data: firstProfile } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      authorId = firstProfile?.id ?? null;
    }
    if (!user || !authorId || !replyContent.trim()) return;
    setSending(true);
    try {
      const parent = comments.find((c) => c.id === parentId);
      if (!parent) {
        setSending(false);
        return;
      }
      const { data, error } = await supabase
        .from('product_text_comments')
        .insert({
          product_id: productId,
          author_id: authorId,
          parent_id: parentId,
          block_id: parent.block_id,
          selected_text: parent.selected_text,
          content: replyContent.trim(),
        })
        .select('*, profile:profiles!product_text_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)')
        .single();
      if (!error && data) {
        setComments((prev) => [...prev, data as TextComment]);
        if (displayParentContent) {
          setDisplayParentOverrides((prev) => ({ ...prev, [data.id]: displayParentContent }));
        }
        setReplyContent('');
        setReplyTo(null);
      }
    } finally {
      setSending(false);
    }
  }, [user, productId, comments, replyContent]);

  const handleEditComment = useCallback(async (id: string, newContent: string) => {
    if (!newContent.trim()) return;
    const { error } = await supabase
      .from('product_text_comments')
      .update({ content: newContent.trim() })
      .eq('id', id);
    if (!error) {
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, content: newContent.trim() } : c));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from('product_text_comments').delete().eq('id', id);
    if (error) {
      console.error('Delete comment failed:', error);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
    setDisplayParentOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      Object.keys(next).forEach((k) => {
        const c = comments.find((x) => x.id === k);
        if (!c || c.parent_id === id) delete next[k];
      });
      return next;
    });
    if (id === activeThreadId) {
      setActiveThreadId(null);
    }
  }, [activeThreadId, comments]);

  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);
  const getThreadComments = (rootId: string) => {
    const root = comments.find((c) => c.id === rootId);
    if (!root) return [];
    const threadIds = new Set<string>([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const c of comments) {
        if (c.parent_id && threadIds.has(c.parent_id) && !threadIds.has(c.id)) {
          threadIds.add(c.id);
          added = true;
        }
      }
    }
    return comments
      .filter((c) => threadIds.has(c.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  if (!blocks?.length && !shortDescription) {
    return (
      <div className={`text-nokturo-500 text-center py-12 ${className}`}>
        {t('richText.noContent')}
      </div>
    );
  }

  const commentableBlocks = blocks.filter(
    (b) => b.type === 'heading' || b.type === 'quote' || b.type === 'paragraph'
  );
  const blockCommentsMap = comments.reduce<Record<string, TextComment[]>>((acc, c) => {
    if (!acc[c.block_id]) acc[c.block_id] = [];
    if (!c.parent_id) acc[c.block_id].push(c);
    return acc;
  }, {});

  const shortDescriptionBlockId = 'short_description';
  const shortDescriptionComments = blockCommentsMap[shortDescriptionBlockId] || [];
  const shortDescriptionDisplay = shortDescription
    ? (selectionState?.blockId === shortDescriptionBlockId
        ? highlightPendingSelection(shortDescription, selectionState.selectedText, shortDescriptionBlockId)
        : shortDescriptionComments.length > 0
          ? highlightTextMultiple(shortDescription, shortDescriptionComments)
          : shortDescription)
    : null;

  const getCommentAnchor = useCallback((e: React.MouseEvent) => {
    const target = e.target as Node;
    if (!target) return null;
    const elem = target.nodeType === Node.TEXT_NODE ? (target as Text).parentElement : (target as HTMLElement);
    return elem?.closest?.('[data-comment-id]') as HTMLElement | null;
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const el = getCommentAnchor(e);
    if (el) {
      setActiveThreadId(el.getAttribute('data-comment-id'));
    }
  }, [getCommentAnchor]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    const el = getCommentAnchor(e);
    if (el && comments.some((c) => c.id === el.getAttribute('data-comment-id'))) {
      e.preventDefault();
      skipNextBackdropClickRef.current = true;
      setActiveThreadId(el.getAttribute('data-comment-id'));
    }
  }, [comments, getCommentAnchor]);

  const tocItems = [...extractHeadings(blocks), ...(sectionTocItems ?? [])];
  const showTocSidebar = showToc && tocItems.length > 0;

  useEffect(() => {
    if (renderTocExternally && onTocItems) onTocItems(tocItems);
  }, [renderTocExternally, onTocItems, tocItems]);

  const content = (
    <article className="font-body select-text commentable-select text-nokturo-900 dark:text-nokturo-100">
        {shortDescriptionDisplay && (
          <p
            className="text-[20px] font-medium text-nokturo-900 dark:text-nokturo-100 mb-12"
            data-block-id={shortDescriptionBlockId}
          >
            {shortDescriptionDisplay}
          </p>
        )}
        {blocks.map((block) => (
          <CommentableBlockView
            key={block.id}
            block={block}
            comments={comments}
            blockComments={blockCommentsMap[block.id] || []}
            pendingSelection={selectionState ? { blockId: selectionState.blockId, selectedText: selectionState.selectedText } : null}
            headingFont={headingFont}
          />
        ))}
      </article>
  );

  const mainContent = showTocSidebar && !renderTocExternally ? (
    <div className={`flex gap-12 items-start ${className}`}>
      <div className="min-w-0 flex-1">
        {content}
        {sections}
      </div>
      <TableOfContents items={tocItems} title={tocTitle} alignWithFirstHeading />
    </div>
  ) : (
    <div className={className}>
      {content}
      {sections}
    </div>
  );

  return (
    <div ref={containerRef} className="relative" onMouseDown={handleContainerMouseDown} onMouseUp={handleMouseUp} onClick={handleContainerClick}>
      {mainContent}

      {/* Inline comment popover on text selection */}
      {selectionState && popoverPosition && (
        <div
          data-comment-popover
          className="absolute z-[100] w-80 bg-white dark:bg-nokturo-800 rounded-lg p-3"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-nokturo-500 dark:text-nokturo-400 shrink-0" />
            <p className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate flex-1">"{selectionState.selectedText}"</p>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative flex items-center">
              {mention.active && (
                <MentionDropdown
                  profiles={mention.filtered}
                  selectedIdx={mention.selectedIdx}
                  onSelect={handleMentionSelect}
                />
              )}
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={t('comments.placeholder')}
                className={INPUT_CLASS}
                autoFocus
                onKeyDown={(e) => {
                  const result = mention.handleKeyDown(e);
                  if (result === 'select') {
                    const p = mention.getSelectedProfile();
                    if (p) handleMentionSelect(p);
                    return;
                  }
                  if (result) return;
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
            </div>
            <button
              onClick={handleAddComment}
              disabled={!commentInput.trim() || sending}
              className="w-9 h-9 flex items-center justify-center shrink-0 bg-nokturo-900 text-white rounded hover:bg-nokturo-800 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {addError && (
            <p className="text-xs text-red-500 mt-2">{addError}</p>
          )}
          {!user && !addError && (
            <p className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-2">{t('comments.loginRequired')}</p>
          )}
        </div>
      )}

      {/* Comment thread popover when clicking highlight */}
      {activeThreadId && comments.find((c) => c.id === activeThreadId) && (
        <CommentThreadPopover
          rootComment={comments.find((c) => c.id === activeThreadId)!}
          threadComments={getThreadComments(activeThreadId)}
          displayParentOverrides={displayParentOverrides}
          onReply={handleReply}
          onDelete={handleDelete}
          onEdit={handleEditComment}
          onClose={() => {
            setActiveThreadId(null);
            setThreadPopoverPosition(null);
          }}
          anchorPosition={threadPopoverPosition}
          skipNextBackdropClickRef={skipNextBackdropClickRef}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          replyContent={replyContent}
          setReplyContent={setReplyContent}
          sending={sending}
          user={user}
          currentAuthorId={currentAuthorId}
          currentUserDisplayName={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || ''}
          canDelete={canDelete}
          profiles={profiles as MentionProfile[]}
        />
      )}
    </div>
  );
}

// ── Thread popover ────────────────────────────────────────────
function CommentThreadPopover({
  rootComment,
  threadComments,
  displayParentOverrides,
  onReply,
  onDelete,
  onEdit,
  onClose,
  skipNextBackdropClickRef,
  anchorPosition,
  replyTo,
  setReplyTo,
  replyContent,
  setReplyContent,
  sending,
  user,
  currentAuthorId,
  currentUserDisplayName = '',
  canDelete,
  profiles = [],
}: {
  rootComment: TextComment;
  threadComments: TextComment[];
  displayParentOverrides: Record<string, string>;
  onReply: (id: string, displayParentContent?: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newContent: string) => void;
  onClose: () => void;
  skipNextBackdropClickRef?: React.MutableRefObject<boolean>;
  anchorPosition: { top?: number; bottom?: number; left: number } | null;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyContent: string;
  setReplyContent: (s: string) => void;
  sending: boolean;
  user: { id: string } | null;
  currentAuthorId: string | null;
  currentUserDisplayName?: string;
  canDelete: boolean;
  profiles?: MentionProfile[];
}) {
  const { t } = useTranslation();
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const replyMention = useMentionSuggestions(replyContent, profiles);

  const handleReplyMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = replyMention.applyMention(profile);
    setReplyContent(newValue);
    replyMention.closeDropdown();
  }, [replyMention, setReplyContent]);

  const renderComment = (c: TextComment, allComments: TextComment[]) => {
    const name =
      [c.profile?.first_name, c.profile?.last_name].filter(Boolean).join(' ') ||
      c.profile?.full_name ||
      'Unknown';
    const isOwn = currentAuthorId === c.author_id;
    const canAct = isOwn; // only own comments can be edited/deleted
    const parent = c.parent_id ? allComments.find((x) => x.id === c.parent_id) : null;
    const parentPreviewRaw = displayParentOverrides[c.id] ?? parent?.content;
    const parentPreview = parentPreviewRaw?.split('\n')[0]?.trim();
    const parentPreviewTruncated = parentPreview
      ? parentPreview.length > 50 ? `${parentPreview.slice(0, 50)}...` : parentPreview
      : null;

    const isEditing = editingId === c.id;

    return (
      <div
        key={c.id}
        className={`group flex flex-col py-2 px-2 rounded-lg min-w-0 ${isOwn ? 'ml-6 bg-nokturo-100 dark:bg-white/20 text-nokturo-900 dark:text-white' : 'mr-6 bg-nokturo-50 dark:bg-white/10 text-nokturo-700 dark:text-white'}`}
      >
        {parentPreviewTruncated && (
          <p className="text-xs text-black/40 dark:text-nokturo-400/80 -mx-2 px-3 mb-1 truncate" title={parentPreview}>
            {parentPreviewTruncated}
          </p>
        )}
        <div className="-mx-2 px-3 pt-1 pb-2">
          {isEditing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                className="w-full text-sm bg-white dark:bg-nokturo-700 border border-nokturo-300 dark:border-nokturo-600 rounded px-2 py-1.5 text-nokturo-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-nokturo-500"
                rows={2}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setEditContent(''); }}
                  className="px-2 py-1 text-xs rounded text-nokturo-500 dark:text-nokturo-400 hover:bg-nokturo-100 dark:hover:bg-white/10"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editContent.trim()) {
                      onEdit(c.id, editContent);
                      setEditingId(null);
                      setEditContent('');
                    }
                  }}
                  className="px-2 py-1 text-xs rounded bg-nokturo-800 dark:bg-white text-white dark:text-nokturo-900 hover:bg-nokturo-900 dark:hover:bg-nokturo-100"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-base font-normal break-words text-inherit">
              {renderContentWithMentions(c.content, isOwn, currentUserDisplayName)}
            </p>
          )}
        </div>
        <div className="flex justify-between items-center mt-4 min-w-0 gap-2">
          <div className="flex gap-2 items-center min-w-0 flex-1">
            {c.profile?.avatar_url ? (
              <img src={c.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <DefaultAvatar size={28} className="rounded-full overflow-hidden shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate text-inherit">{name}</span>
              <span className="text-[10px] opacity-80 text-inherit">
                {new Date(c.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canAct && (
              <div className="relative" data-comment-menu>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (commentMenuOpen === c.id) {
                      setCommentMenuOpen(null);
                      setMenuPos(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuPos({ top: rect.bottom + 4, left: rect.right });
                      setCommentMenuOpen(c.id);
                    }
                  }}
                  className={`p-1 rounded text-nokturo-400 hover:text-nokturo-600 dark:text-white/60 dark:hover:text-white/90 hover:bg-nokturo-100 dark:hover:bg-white/10 transition-all ${commentMenuOpen === c.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {commentMenuOpen === c.id && menuPos && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setCommentMenuOpen(null); setMenuPos(null); }} />
                    <div
                      className="fixed bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[100px] z-[101]"
                      style={{ top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)' }}
                    >
                      {isOwn && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(c.id);
                            setEditContent(c.content);
                            setCommentMenuOpen(null);
                            setMenuPos(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          {t('common.edit')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setCommentMenuOpen(null);
                          setMenuPos(null);
                          const isRoot = c.id === rootComment.id;
                          if (isRoot && !window.confirm(t('comments.deleteRootConfirm'))) return;
                          onDelete(c.id);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('common.delete')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (replyTo === c.id) {
                  setReplyTo(null);
                  setReplyContent('');
                } else {
                  const authorName = [c.profile?.first_name, c.profile?.last_name].filter(Boolean).join(' ') || c.profile?.full_name || 'Unknown';
                  setReplyTo(c.id);
                  setReplyContent(`@${authorName} `);
                }
              }}
              className="shrink-0 px-2 py-1 rounded text-xs text-nokturo-500 hover:text-nokturo-700 dark:text-white/90 dark:hover:text-white dark:bg-white/10"
            >
              {t('comments.reply')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[99]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (skipNextBackdropClickRef?.current) {
              skipNextBackdropClickRef.current = false;
              return;
            }
            onClose();
          }
        }}
      />
      <div
        className="fixed z-[100] flex flex-col w-96 max-w-[calc(100vw-32px)] max-h-[calc(100vh-8rem)] bg-white dark:bg-nokturo-800 rounded-lg p-4 shadow-lg"
        style={
          anchorPosition
            ? {
                ...(anchorPosition.top !== undefined && { top: anchorPosition.top }),
                ...(anchorPosition.bottom !== undefined && { bottom: anchorPosition.bottom }),
                left: anchorPosition.left,
              }
            : { top: '5rem', left: '50%', transform: 'translateX(-50%)' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate">"{rootComment.selected_text}"</span>
          <button onClick={onClose} className="text-nokturo-500 hover:text-nokturo-700 dark:text-nokturo-400 dark:hover:text-nokturo-200 text-xl p-1 -m-1 leading-none">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden space-y-2 pt-4 mb-4">
          {[...threadComments]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((c) => renderComment(c, threadComments))}
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-nokturo-200 dark:border-nokturo-600 shrink-0 relative">
          <div className="flex-1 min-w-0 relative">
            {replyMention.active && (
              <MentionDropdown
                profiles={replyMention.filtered}
                selectedIdx={replyMention.selectedIdx}
                onSelect={handleReplyMentionSelect}
              />
            )}
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={replyTo ? t('comments.replyPlaceholder') : t('comments.placeholder')}
              className={`${INPUT_CLASS} w-full`}
              onKeyDown={(e) => {
                const result = replyMention.handleKeyDown(e);
                if (result === 'select') {
                  const p = replyMention.getSelectedProfile();
                  if (p) handleReplyMentionSelect(p);
                  return;
                }
                if (result) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onReply(replyTo ?? rootComment.id);
                }
              }}
            />
          </div>
          <button
            onClick={() => onReply(replyTo ?? rootComment.id)}
            disabled={!replyContent.trim() || sending}
            className="size-9 flex items-center justify-center bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}
