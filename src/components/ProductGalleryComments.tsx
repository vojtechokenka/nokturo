import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { hasPermission, canDeleteAnything } from '../lib/rbac';
import {
  Send,
  Loader2,
  Check,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';
import { renderContentWithMentions } from '../lib/renderMentions';
import { INPUT_CLASS } from '../lib/inputStyles';
import { useMentionSuggestions, MentionDropdown } from './MentionSuggestions';
import type { MentionProfile } from './MentionSuggestions';
import { sendMentionNotifications, getGalleryNotificationLink, parseMentionsFromText } from '../lib/sendMentionNotifications';

// ── Types ─────────────────────────────────────────────────────
interface ProductGalleryComment {
  id: string;
  product_id: string;
  gallery_type: string;
  image_index: number;
  author_id: string;
  content: string;
  tagged_user_ids: string[];
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

interface ProductGalleryCommentsProps {
  productId: string;
  galleryType: 'design' | 'moodboard' | 'labels';
  imageIndex: number;
  hasCaptionAbove?: boolean;
}

// ── Component ─────────────────────────────────────────────────
export function ProductGalleryComments({
  productId,
  galleryType,
  imageIndex,
  hasCaptionAbove = false,
}: ProductGalleryCommentsProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canComment =
    user?.role &&
    (hasPermission(user.role, 'production.products', 'comment') ||
      hasPermission(user.role, 'production.sampling', 'comment'));
  const canDelete = user?.role ? canDeleteAnything(user.role) : false;

  const [comments, setComments] = useState<ProductGalleryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mention = useMentionSuggestions(newComment, profiles as MentionProfile[]);

  const handleMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = mention.applyMention(profile);
    setNewComment(newValue);
    if (!taggedUsers.includes(profile.id)) {
      setTaggedUsers((prev) => {
        const next = [...prev, profile.id];
        if (import.meta.env.DEV) console.log('[ProductGalleryComments] handleMentionSelect: added', { profileId: profile.id, taggedUsersAfter: next });
        return next;
      });
    }
    mention.closeDropdown();
  }, [mention, taggedUsers]);

  // Close comment menu on outside click
  useEffect(() => {
    if (!commentMenuOpen) return;
    const handle = () => setCommentMenuOpen(null);
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [commentMenuOpen]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, avatar_url')
      .neq('id', user?.id ?? '');
    setProfiles((data || []) as ProfileOption[]);
  }, [user?.id]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_gallery_comments')
      .select(
        '*, profile:profiles!product_gallery_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)'
      )
      .eq('product_id', productId)
      .eq('gallery_type', galleryType)
      .eq('image_index', imageIndex)
      .order('created_at', { ascending: true });
    setComments((error ? [] : data || []) as ProductGalleryComment[]);
    setLoading(false);
  }, [productId, galleryType, imageIndex]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`gallery-comments-${productId}-${galleryType}-${imageIndex}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_gallery_comments',
          filter: `product_id=eq.${productId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as ProductGalleryComment;
            // Only include comments for this specific gallery image
            if (row.gallery_type !== galleryType || row.image_index !== imageIndex) return;
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, first_name, last_name, avatar_url')
              .eq('id', row.author_id)
              .single();
            const enriched: ProductGalleryComment = { ...row, profile: profile || { avatar_url: null } };
            setComments((prev) => (prev.some((c) => c.id === enriched.id) ? prev : [...prev, enriched]));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ProductGalleryComment;
            if (updated.gallery_type !== galleryType || updated.image_index !== imageIndex) return;
            // Preserve profile from existing comment – real-time payload has no joined data
            setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated, profile: c.profile } : c)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId, galleryType, imageIndex]);

  useEffect(() => {
    const run = async () => {
      let id = getUserIdForDb();
      if (!id && user?.id === 'dev-user') {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .single();
        if (!error && data) id = data.id;
      }
      setCurrentAuthorId(id);
    };
    run();
  }, [user?.id]);

  const handlePost = async () => {
    const content = newComment.trim();
    if (!content || !user) return;

    const taggedUsersSnapshot = [...taggedUsers];
    if (import.meta.env.DEV) console.log('[ProductGalleryComments] handlePost SUBMIT – taggedUsers at submit', { taggedUsersSnapshot });

    setPostError(null);
    setSending(true);

    let authorId = getUserIdForDb();
    if (!authorId && user?.id === 'dev-user') {
      const { data: firstProfile } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      authorId = firstProfile?.id ?? null;
    }
    if (!authorId) {
      setPostError(t('comments.loginRequired'));
      setSending(false);
      return;
    }
    setCurrentAuthorId(authorId);

    const { data: comment, error: commentErr } = await supabase
      .from('product_gallery_comments')
      .insert({
        product_id: productId,
        gallery_type: galleryType,
        image_index: imageIndex,
        author_id: authorId,
        content,
        tagged_user_ids: taggedUsersSnapshot.length > 0 ? taggedUsersSnapshot : [],
      })
      .select('id')
      .single();

    if (commentErr) {
      setPostError(commentErr.message || t('comments.postFailed'));
      setSending(false);
      return;
    }

    if (comment) {
      const newCommentRow: ProductGalleryComment = {
        id: comment.id,
        product_id: productId,
        gallery_type: galleryType,
        image_index: imageIndex,
        author_id: authorId,
        content,
        tagged_user_ids: taggedUsersSnapshot,
        created_at: new Date().toISOString(),
        profile: {
          first_name: user.firstName ?? null,
          last_name: user.lastName ?? null,
          full_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name,
          avatar_url: user.avatarUrl ?? null,
        },
      };
      setComments((prev) => (prev.some((c) => c.id === newCommentRow.id) ? prev : [...prev, newCommentRow]));
      setNewComment('');

      // Create notifications for tagged users
      if (import.meta.env.DEV && taggedUsersSnapshot.length === 0) {
        const parsedNames = parseMentionsFromText(content);
        if (parsedNames.length) {
          console.log('[ProductGalleryComments] PARSER: mentions in text but taggedUsers empty', { content: content.slice(0, 100), parsedMentionNames: parsedNames });
        }
      }
      if (taggedUsersSnapshot.length > 0) {
        if (import.meta.env.DEV) console.log('[ProductGalleryComments] calling sendMentionNotifications', { taggedUsersSnapshot });
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        await sendMentionNotifications({
          taggedUserIds: taggedUsersSnapshot,
          authorId,
          authorName,
          content,
          type: 'gallery_tag',
          link: getGalleryNotificationLink(productId),
        });
      }
      setTaggedUsers([]);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('product_gallery_comments').delete().eq('id', id);
    setComments((prev) => prev.filter((c) => c.id !== id));
    setDeleteTarget(null);
  };

  const startEdit = (comment: ProductGalleryComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('product_gallery_comments')
      .update({ content: editContent.trim() })
      .eq('id', editingId);
    if (!error) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, content: editContent.trim() } : c
        )
      );
      cancelEdit();
    }
    setEditSaving(false);
  };

  const handleReplyTo = (comment: ProductGalleryComment) => {
    const authorName =
      [comment.profile?.first_name, comment.profile?.last_name].filter(Boolean).join(' ') ||
      comment.profile?.full_name ||
      'Unknown';
    if (!taggedUsers.includes(comment.author_id)) {
      setTaggedUsers((prev) => [...prev, comment.author_id]);
    }
    setNewComment((prev) => (prev.trim() ? `${prev} @${authorName} ` : `@${authorName} `));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const renderComment = (comment: ProductGalleryComment) => {
    const name =
      [comment.profile?.first_name, comment.profile?.last_name]
        .filter(Boolean)
        .join(' ') ||
      comment.profile?.full_name ||
      'Unknown';
    const isOwn =
      comment.author_id === user?.id ||
      (user?.id === 'dev-user' && currentAuthorId && comment.author_id === currentAuthorId);
    const isEditing = editingId === comment.id;

    return (
      <div
        key={comment.id}
        className={`group flex flex-col py-2 px-2 rounded-lg min-w-0 ${isOwn ? 'ml-6 bg-nokturo-100 dark:bg-white/20 text-nokturo-900 dark:text-white' : 'mr-6 bg-nokturo-50 dark:bg-white/10 text-nokturo-700 dark:text-white'}`}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2 -mx-2 px-3 py-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className={INPUT_CLASS}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || editSaving}
                className="flex items-center gap-1 text-xs text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                {t('common.save')}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300"
              >
                <X className="w-3 h-3" />
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="-mx-2 px-3 pt-1 pb-2">
              <p className="text-base break-words text-inherit">
                {renderContentWithMentions(
                  comment.content,
                  isOwn,
                  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || ''
                )}
              </p>
            </div>
            <div className="flex justify-between items-center mt-4 min-w-0 gap-2">
              <div className="flex gap-2 items-center min-w-0 flex-1">
                {comment.profile?.avatar_url ? (
                  <img src={comment.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <DefaultAvatar size={28} className="rounded-full overflow-hidden shrink-0" />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate text-inherit">{name}</span>
                  <span className="text-[10px] opacity-80 text-inherit">
                    {new Date(comment.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOwn && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id);
                      }}
                      className={`p-1 rounded text-nokturo-400 hover:text-nokturo-600 dark:text-white/60 dark:hover:text-white/90 hover:bg-nokturo-100 dark:hover:bg-white/10 transition-all ${commentMenuOpen === comment.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {commentMenuOpen === comment.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setCommentMenuOpen(null); }} />
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[100px] z-20" onClick={(e) => e.stopPropagation()}>
                          {isOwn && (
                            <button
                              type="button"
                              onClick={() => { startEdit(comment); setCommentMenuOpen(null); }}
                              className="w-full px-3 py-1.5 text-left text-xs text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600"
                            >
                              {t('common.edit')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(comment.id); setCommentMenuOpen(null); }}
                            className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {canComment && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplyTo(comment);
                    }}
                    className="shrink-0 px-2 py-1 rounded text-xs text-nokturo-500 hover:text-nokturo-700 dark:text-white/90 dark:hover:text-white dark:bg-white/10"
                  >
                    {t('comments.reply')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <section
      className={`flex-1 flex flex-col min-h-0 ${hasCaptionAbove ? 'mt-4 pt-4 border-t border-nokturo-200 dark:border-nokturo-700' : ''}`}
    >
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
          </div>
        ) : comments.length === 0 ? null : (
          <div className="space-y-2 pt-4 mb-4">
            {comments.map(renderComment)}
          </div>
        )}
      </div>

      {canComment && (
        <div className="flex flex-col gap-2 shrink-0 pt-3">
          <div className="relative flex gap-2">
            <div className="flex-1 relative">
              {mention.active && (
                <MentionDropdown
                  profiles={mention.filtered}
                  selectedIdx={mention.selectedIdx}
                  onSelect={handleMentionSelect}
                />
              )}
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
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
                    handlePost();
                  }
                }}
                placeholder={t('comments.placeholder')}
                className={INPUT_CLASS}
              />
            </div>
            <button
              onClick={handlePost}
              disabled={!newComment.trim() || sending}
              className="size-9 flex items-center justify-center bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {postError && <p className="text-xs text-red-500">{postError}</p>}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">{t('comments.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
