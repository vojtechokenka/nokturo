import { supabase } from './supabase';
import i18n from '../i18n';

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

/** Map old granular types to new broad types */
const TYPE_MAP: Record<NotificationType, string> = {
  moodboard_tag: 'mention',
  gallery_tag: 'mention',
  text_tag: 'mention',
  product_tag: 'mention',
  comment_reply: 'comment',
};

/** Map old types to reference_type for context */
const REFERENCE_TYPE_MAP: Record<NotificationType, string> = {
  moodboard_tag: 'moodboard',
  gallery_tag: 'gallery',
  text_tag: 'text',
  product_tag: 'product',
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
  const uniqueIds = [...new Set(taggedUserIds)].filter((id) => id !== authorId);
  if (uniqueIds.length === 0) return;

  const titleKey = {
    moodboard_tag: 'notifications.moodboardTagTitle',
    gallery_tag: 'notifications.galleryTagTitle',
    text_tag: 'notifications.textTagTitle',
    product_tag: 'notifications.productTagTitle',
    comment_reply: 'notifications.commentReplyTitle',
  }[type];

  const title = i18n.t(titleKey, { name: authorName });
  const message = content.slice(0, 100) + (content.length > 100 ? '...' : '');

  // Deduplication: check which recipients already have an active notification for this link
  const alreadyNotified = new Set<string>();
  if (link) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('notifications')
        .select('recipient_id')
        .in('recipient_id', uniqueIds)
        .eq('link', link)
        .eq('dismissed', false)
        .gte('created_at', oneHourAgo);

      if (existing) {
        for (const n of existing) {
          alreadyNotified.add(n.recipient_id);
        }
      }
    } catch (err) {
      console.warn('Dedup check failed, proceeding without:', err);
    }
  }

  const newRecipients = uniqueIds.filter((id) => !alreadyNotified.has(id));
  if (newRecipients.length === 0) return;

  const referenceId = moodboardItemId || commentId || null;

  const rows = newRecipients.map((userId) => ({
    recipient_id: userId,
    sender_id: authorId,
    type: TYPE_MAP[type] || 'mention',
    title,
    message,
    link,
    reference_type: REFERENCE_TYPE_MAP[type] || 'moodboard',
    reference_id: referenceId,
    metadata: {
      original_type: type,
      ...(moodboardItemId ? { moodboard_item_id: moodboardItemId } : {}),
      ...(commentId ? { comment_id: commentId } : {}),
    },
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.error('Failed to insert notifications:', error);
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
