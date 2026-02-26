import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
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
import { sendMentionNotifications } from '../lib/sendMentionNotifications';

// ── Types ─────────────────────────────────────────────────────
interface MoodboardComment {
  id: string;
  moodboard_item_id: string;
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

interface MoodboardCommentsProps {
  moodboardItemId: string;
  hasHeaderAbove?: boolean;
}

// ── Component ─────────────────────────────────────────────────
export function MoodboardComments({ moodboardItemId, hasHeaderAbove = true }: MoodboardCommentsProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canComment = user?.role ? hasPermission(user.role, 'prototyping.moodboard', 'comment') : false;
  const canDelete = user?.role ? canDeleteAnything(user.role) : false;

  const [comments, setComments] = useState<MoodboardComment[]>([]);
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
  const addToast = useToastStore((s) => s.addToast);

  const mention = useMentionSuggestions(newComment, profiles as MentionProfile[]);

  const handleMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = mention.applyMention(profile);
    setNewComment(newValue);
    if (!taggedUsers.includes(profile.id)) {
      setTaggedUsers((prev) => [...prev, profile.id]);
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

  // ── Fetch profiles for tagging ───────────────────────────────
  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, avatar_url')
      .neq('id', user?.id ?? '');
    setProfiles((data || []) as ProfileOption[]);
  }, [user?.id]);

  // ── Fetch comments ──────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('moodboard_comments')
      .select(
        '*, profile:profiles!moodboard_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)'
      )
      .eq('moodboard_item_id', moodboardItemId)
      .order('created_at', { ascending: true });
    setComments((error ? [] : data || []) as MoodboardComment[]);
    setLoading(false);
  }, [moodboardItemId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`moodboard-comments-${moodboardItemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'moodboard_comments',
          filter: `moodboard_item_id=eq.${moodboardItemId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as MoodboardComment;
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, first_name, last_name, avatar_url')
              .eq('id', row.author_id)
              .single();
            const enriched: MoodboardComment = { ...row, profile: profile || { avatar_url: null } };
            setComments((prev) => (prev.some((c) => c.id === enriched.id) ? prev : [...prev, enriched]));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MoodboardComment;
            // Preserve profile from existing comment – real-time payload has no joined data
            setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated, profile: c.profile } : c)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [moodboardItemId]);

  // Set currentAuthorId on load (for isOwn check in dev mode)
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

  // ── Post comment (with optional tags) – optimistic update ───────
  const handlePost = async () => {
    const content = newComment.trim();
    if (!content || !user) return;
    setPostError(null);
    setSending(true);

    let authorId = getUserIdForDb();
    // Dev bypass: getUserIdForDb returns null for dev-user – use first profile as fallback
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

    const tempId = 'temp-' + Date.now();
    const optimisticRow: MoodboardComment = {
      id: tempId,
      moodboard_item_id: moodboardItemId,
      author_id: authorId,
      content,
      tagged_user_ids: taggedUsers,
      created_at: new Date().toISOString(),
      profile: {
        first_name: user.firstName ?? null,
        last_name: user.lastName ?? null,
        full_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name,
        avatar_url: user.avatarUrl ?? null,
      },
    };
    setComments((prev) => [...prev, optimisticRow]);
    setNewComment('');
    setTaggedUsers([]);

    const { data: comment, error: commentErr } = await supabase
      .from('moodboard_comments')
      .insert({
        moodboard_item_id: moodboardItemId,
        author_id: authorId,
        content,
        tagged_user_ids: taggedUsers.length > 0 ? taggedUsers : [],
      })
      .select('id')
      .single();

    if (commentErr) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setPostError(commentErr.message || t('comments.postFailed'));
      addToast(commentErr.message || t('comments.postFailed'), 'error');
      setSending(false);
      return;
    }

    if (comment) {
      setComments((prev) => {
        const withoutRealtimeDuplicate = prev.filter((c) => c.id !== comment.id);
        return withoutRealtimeDuplicate.map((c) =>
          c.id === tempId ? { ...c, id: comment.id } : c
        );
      });
      addToast(t('comments.posted'), 'success');

      // Create notifications for tagged users
      if (taggedUsers.length > 0) {
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        await sendMentionNotifications({
          taggedUserIds: taggedUsers,
          authorId,
          authorName,
          content,
          type: 'moodboard_tag',
          link: `/prototyping/moodboard?item=${moodboardItemId}`,
          moodboardItemId,
          commentId: comment.id,
        });
      }
    }
    setSending(false);
  };

  // ── Delete comment ──────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('moodboard_comments').delete().eq('id', id);
    setComments((prev) => prev.filter((c) => c.id !== id));
    setDeleteTarget(null);
  };

  // ── Edit comment ────────────────────────────────────────────
  const startEdit = (comment: MoodboardComment) => {
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
      .from('moodboard_comments')
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

  const handleReplyTo = (comment: MoodboardComment) => {
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

  const renderComment = (comment: MoodboardComment) => {
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
        className={`group flex flex-col py-2 px-2 rounded-lg min-w-0 animate-fade-in-item ${isOwn ? 'ml-6 bg-white/20 text-white' : 'mr-6 bg-white/10 text-white'}`}
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
              <p className="text-base break-words pr-0 text-inherit">
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
                      className={`p-1 rounded text-white/60 hover:text-white/90 hover:bg-white/10 transition-all ${commentMenuOpen === comment.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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
                    className="shrink-0 px-2 py-1 rounded text-xs border-none text-white/90 bg-white/10"
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
    <section className={`flex-1 flex flex-col min-h-0 ${hasHeaderAbove ? 'mt-4 pt-4 border-t border-nokturo-200 dark:border-nokturo-700' : ''}`}>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-nokturo-200/60 dark:bg-nokturo-700/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded w-3/4" />
                  <div className="h-3 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? null : (
          <div className="space-y-2 pt-4 mb-4">
            {comments.map(renderComment)}
          </div>
        )}
      </div>

      {/* New comment input with tag picker - fixed at bottom (only if role can comment) */}
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
            className="size-9 flex items-center justify-center bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {postError && (
          <p className="text-xs text-red-500">{postError}</p>
        )}
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
