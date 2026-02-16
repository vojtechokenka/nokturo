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

/**
 * Creates notification rows for each tagged user.
 * Skips the author (can't notify yourself).
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
  const body = content.slice(0, 100) + (content.length > 100 ? '...' : '');

  const rows = uniqueIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    body,
    link,
    from_user_id: authorId,
    ...(moodboardItemId ? { moodboard_item_id: moodboardItemId } : {}),
    ...(commentId ? { comment_id: commentId } : {}),
  }));

  await supabase.from('notifications').insert(rows);
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
