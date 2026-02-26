import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { hasPermission, canDeleteAnything } from '../lib/rbac';
import {
  Send,
  Loader2,
  MessageSquare,
  CornerDownRight,
  MoreHorizontal,
} from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';
import { renderContentWithMentions } from '../lib/renderMentions';
import { INPUT_CLASS } from '../lib/inputStyles';
import { useMentionSuggestions, MentionDropdown } from './MentionSuggestions';
import type { MentionProfile } from './MentionSuggestions';
import { sendMentionNotifications } from '../lib/sendMentionNotifications';

interface ProfileOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}

// ── Types ─────────────────────────────────────────────────────
interface Comment {
  id: string;
  product_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url: string | null;
  };
}

interface ProductCommentsProps {
  productId: string;
}

// ── Component ─────────────────────────────────────────────────
export function ProductComments({ productId }: ProductCommentsProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canComment = user?.role ? (
    hasPermission(user.role, 'production.products', 'comment') ||
    hasPermission(user.role, 'production.sampling', 'comment')
  ) : false;
  const canDelete = user?.role ? canDeleteAnything(user.role) : false;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);

  const mention = useMentionSuggestions(newComment, profiles as MentionProfile[]);
  const replyMention = useMentionSuggestions(replyContent, profiles as MentionProfile[]);

  const handleMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = mention.applyMention(profile);
    setNewComment(newValue);
    if (!taggedUsers.includes(profile.id)) {
      setTaggedUsers((prev) => [...prev, profile.id]);
    }
    mention.closeDropdown();
  }, [mention, taggedUsers]);

  const handleReplyMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = replyMention.applyMention(profile);
    setReplyContent(newValue);
    if (!taggedUsers.includes(profile.id)) {
      setTaggedUsers((prev) => [...prev, profile.id]);
    }
    replyMention.closeDropdown();
  }, [replyMention, taggedUsers]);

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

  // Close comment menu on outside click
  useEffect(() => {
    if (!commentMenuOpen) return;
    const handle = () => setCommentMenuOpen(null);
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [commentMenuOpen]);

  // ── Fetch comments ──────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from('product_comments')
      .select('*, profile:profiles!product_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    setComments((data || []) as Comment[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ── Realtime subscription ─────────────────────────────────────
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`product-comments-${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_comments',
          filter: `product_id=eq.${productId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Comment;
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, first_name, last_name, avatar_url')
              .eq('id', row.author_id)
              .single();
            const enriched: Comment = { ...row, profile: profile || { avatar_url: null } };
            setComments((prev) => (prev.some((c) => c.id === enriched.id) ? prev : [...prev, enriched]));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id && c.parent_id !== oldRow.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Comment;
            // Preserve profile from existing comment – real-time payload has no joined data
            setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated, profile: c.profile } : c)));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  // ── Post comment ────────────────────────────────────────────
  const handlePost = async (parentId: string | null = null) => {
    const content = parentId ? replyContent : newComment;
    const authorId = getUserIdForDb();
    if (!content.trim() || !user || !authorId) return;
    setSending(true);

    const { error } = await supabase.from('product_comments').insert({
      product_id: productId,
      author_id: authorId,
      parent_id: parentId,
      content: content.trim(),
    });

    if (!error) {
      // Create notifications for tagged users
      if (taggedUsers.length > 0) {
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        await sendMentionNotifications({
          taggedUserIds: taggedUsers,
          authorId,
          authorName,
          content: content.trim(),
          type: 'product_tag',
          link: `/communication/comments?product=${productId}`,
        });
      }

      if (parentId) {
        setReplyContent('');
        setReplyTo(null);
      } else {
        setNewComment('');
      }
      setTaggedUsers([]);
      fetchComments();
    }
    setSending(false);
  };

  // ── Delete comment ──────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('product_comments').delete().eq('id', id);
    setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
    setDeleteTarget(null);
  };

  // ── Build threaded tree ─────────────────────────────────────
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  // ── Render a single comment ─────────────────────────────────
  const renderComment = (comment: Comment, isReply = false) => {
    const name =
      [comment.profile?.first_name, comment.profile?.last_name]
        .filter(Boolean)
        .join(' ') ||
      comment.profile?.full_name ||
      'Unknown';
    const isOwn = comment.author_id === user?.id;
    const replies = getReplies(comment.id);

    return (
      <div key={comment.id} className={isReply ? 'ml-8' : ''}>
        <div className="flex items-start gap-3 py-2 group">
          {/* Avatar */}
          {comment.profile?.avatar_url ? (
            <img
              src={comment.profile.avatar_url}
              alt={name}
              className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
            />
          ) : (
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5 flex items-center justify-center bg-black">
              <DefaultAvatar size={28} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-nokturo-700 dark:text-nokturo-300">{name}</span>
              <span className="text-[10px] text-nokturo-500">
                {new Date(comment.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 leading-relaxed mt-0.5 break-words">
              {renderContentWithMentions(
                comment.content,
                isOwn,
                [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || ''
              )}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOwn && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id);
                    }}
                    className="p-1 rounded text-nokturo-400 hover:text-nokturo-600 dark:text-nokturo-500 dark:hover:text-nokturo-300 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {commentMenuOpen === comment.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setCommentMenuOpen(null); }} />
                      <div className="absolute left-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[100px] z-20" onClick={(e) => e.stopPropagation()}>
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
              {!isReply && (
                <button
                  onClick={() => {
                    if (replyTo === comment.id) {
                      setReplyTo(null);
                      setReplyContent('');
                      setTaggedUsers([]);
                    } else {
                      const authorName =
                        [comment.profile?.first_name, comment.profile?.last_name].filter(Boolean).join(' ') ||
                        comment.profile?.full_name ||
                        'Unknown';
                      setReplyTo(comment.id);
                      setReplyContent(`@${authorName} `);
                      setTaggedUsers([comment.author_id]);
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-nokturo-500 hover:text-nokturo-600 transition-colors"
                >
                  <CornerDownRight className="w-3 h-3" />
                  {t('comments.reply')}
                </button>
              )}
            </div>

            {/* Reply input */}
            {replyTo === comment.id && (
              <div className="flex items-end gap-2 mt-2 relative">
                <div className="flex-1 relative">
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
                        handlePost(comment.id);
                      }
                    }}
                    placeholder={t('comments.replyPlaceholder')}
                    className={`${INPUT_CLASS}`}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => handlePost(comment.id)}
                  disabled={!replyContent.trim() || sending}
                  className="p-1.5 bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100 rounded hover:bg-nokturo-50 dark:hover:bg-nokturo-600 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Nested replies */}
        {replies.map((reply) => renderComment(reply, true))}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <section>
      <h4 className="text-heading-5 font-extralight text-nokturo-500 uppercase tracking-wider mb-3">
        {t('comments.productComments')}
      </h4>

      <div className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-lg p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-nokturo-500 animate-spin" />
          </div>
        ) : rootComments.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 text-nokturo-600 mx-auto mb-2" />
            <p className="text-nokturo-500 text-sm">{t('comments.noComments')}</p>
            <p className="text-nokturo-500 text-xs mt-0.5">{t('comments.beFirst')}</p>
          </div>
        ) : (
          <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
            {rootComments.map((c) => renderComment(c))}
          </div>
        )}

        {/* New comment input (only if role can comment) */}
        {canComment && (
        <div className="flex items-end gap-2 pt-3 border-t border-nokturo-200 dark:border-nokturo-700 relative">
          <div className="flex-1 relative">
            {mention.active && (
              <MentionDropdown
                profiles={mention.filtered}
                selectedIdx={mention.selectedIdx}
                onSelect={handleMentionSelect}
              />
            )}
            <input
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
                  handlePost(null);
                }
              }}
              placeholder={t('comments.placeholder')}
              className={`${INPUT_CLASS}`}
            />
          </div>
          <button
            onClick={() => handlePost(null)}
            disabled={!newComment.trim() || sending}
            className="p-2 bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100 rounded-lg hover:bg-nokturo-50 dark:hover:bg-nokturo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">
              {t('comments.deleteConfirm')}
            </p>
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
