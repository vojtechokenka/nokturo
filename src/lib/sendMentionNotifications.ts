// Client with session – must be lib/supabase.ts (not server-side / anon-only client)
import { supabase } from './supabase';
import i18n from '../i18n';

/** Same regex as renderMentions – extracts @mention tokens from text (end of text, punctuation, etc.) */
const MENTION_REGEX = /@[\w\u00C0-\u024F]+(?:\s+[\w\u00C0-\u024F]+)*/g;

export function parseMentionsFromText(content: string): string[] {
  const matches = content.match(MENTION_REGEX) ?? [];
  return matches.map((m) => m.slice(1).replace(/[,.\-!?;:]+\s*$/, '').trim()).filter(Boolean);
}

type NotificationType =
  | 'moodboard_tag'
  | 'gallery_tag'
  | 'text_tag'
  | 'product_tag'
  | 'comment_reply';

interface SendMentionNotificationsParams {
  taggedUserIds: string[];
  authorId: string;
  authorName: string;
  content: string;
  type: NotificationType;
  link: string;
  /** Only for moodboard comments */
  moodboardItemId?: string;
  /** Only for moodboard comments */
  commentId?: string;
}

/** New schema: type IN ('mention', 'comment', 'task_assigned', 'project_update') */
const TYPE_MAP: Record<NotificationType, string> = {
  moodboard_tag: 'mention',
  gallery_tag: 'mention',
  text_tag: 'mention',
  product_tag: 'mention',
  comment_reply: 'comment',
};

/**
 * Creates notification rows for each tagged user.
 * Skips the author (can't notify yourself).
 * Deduplicates: won't create a duplicate for the same recipient + link within 1 hour.
 */
export async function sendMentionNotifications({
  taggedUserIds,
  authorId,
  authorName,
  content,
  type,
  link,
  moodboardItemId,
  commentId,
}: SendMentionNotificationsParams) {
  const DEBUG = import.meta.env.DEV;

  if (DEBUG) {
    console.log('[sendMentionNotifications] INVOKED', {
      type,
      taggedUserIds,
      taggedUserIdsLength: taggedUserIds?.length ?? 0,
      authorId,
    });
  }

  const uniqueIds = [...new Set(taggedUserIds)].filter((id) => id !== authorId);

  if (uniqueIds.length === 0) {
    if (DEBUG) {
      console.log('[sendMentionNotifications] EARLY RETURN: no recipients', {
        reason: !taggedUserIds?.length
          ? 'taggedUserIds array empty or undefined'
          : 'all filtered out (author self-tag or duplicates)',
        taggedUserIds,
      });
    }
    return;
  }

  const titleKey = {
    moodboard_tag: 'notifications.moodboardTagTitle',
    gallery_tag: 'notifications.galleryTagTitle',
    text_tag: 'notifications.textTagTitle',
    product_tag: 'notifications.productTagTitle',
    comment_reply: 'notifications.commentReplyTitle',
  }[type];

  const title = i18n.t(titleKey, { name: authorName });
  const message = content.slice(0, 100) + (content.length > 100 ? '...' : '');

  // Deduplication: recipient_id + link in last hour
  const alreadyNotified = new Set<string>();
  if (link) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('notifications')
        .select('recipient_id')
        .in('recipient_id', uniqueIds)
        .eq('link', link)
        .gte('created_at', oneHourAgo);

      if (existing) {
        for (const n of existing as { recipient_id: string }[]) {
          alreadyNotified.add(n.recipient_id);
        }
      }
    } catch (err) {
      console.warn('Dedup check failed, proceeding without:', err);
    }
  }

  const newRecipients = uniqueIds.filter((id) => !alreadyNotified.has(id));

  if (newRecipients.length === 0) {
    if (DEBUG) {
      console.log('[sendMentionNotifications] EARLY RETURN: all already notified (dedup)', {
        uniqueIds,
        alreadyNotified: [...alreadyNotified],
      });
    }
    return;
  }

  const rows = newRecipients.map((recipientId) => ({
    recipient_id: recipientId,
    sender_id: authorId,
    type: TYPE_MAP[type] || 'mention',
    title,
    message,
    link,
  }));

  if (DEBUG) {
    console.log('[sendMentionNotifications] BEFORE INSERT payload:', {
      rowCount: rows.length,
      recipient_ids: rows.map((r) => r.recipient_id),
      sampleRow: rows[0],
    });
  }

  // Exact payload being sent – verify type matches DB CHECK: mention | comment | task_assigned | project_update
  const ALLOWED_TYPES = ['mention', 'comment', 'task_assigned', 'project_update'] as const;
  const invalid = rows.filter((r) => !ALLOWED_TYPES.includes(r.type as (typeof ALLOWED_TYPES)[number]));
  if (invalid.length) {
    console.warn('⚠️ INVALID type(s) – CHECK constraint will reject:', invalid.map((r) => r.type));
  }
  console.warn('🔑 INSERT PAYLOAD:', JSON.stringify(rows, null, 2));

  // Debug: verify session before INSERT (RLS 42501 = permission denied)
  console.warn('🔑 SUPABASE IMPORT: lib/supabase.ts (from "./supabase" in sendMentionNotifications.ts)');
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  console.warn('🔑 TOKEN BEFORE INSERT:', token ? token.substring(0, 20) + '...' : 'NULL');

  const { data, error } = await supabase.from('notifications').insert(rows).select('id');

  if (DEBUG) {
    console.log('[sendMentionNotifications] AFTER INSERT response:', {
      data,
      error: error ? { message: error.message, code: error.code, details: error.details } : null,
      insertedCount: data?.length ?? 0,
    });
  }

  if (error) {
    console.error('[sendMentionNotifications] insert failed:', error.message, 'code:', error.code, 'details:', error.details);
  }
}

/**
 * Determine the notification link based on the current page path.
 * Gallery comments appear on both product detail and sampling pages.
 */
export function getGalleryNotificationLink(productId: string): string {
  const hash = window.location.hash?.replace(/^#/, '') || '';
  const pathname = window.location.pathname || '';
  const currentPath = hash || pathname;

  if (currentPath.includes('/sampling/')) {
    return `/production/sampling/${productId}`;
  }
  return `/production/products/${productId}`;
}
