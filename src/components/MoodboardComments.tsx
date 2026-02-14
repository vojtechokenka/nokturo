import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { hasPermission, canDeleteAnything } from '../lib/rbac';
import {
  Send,
  Loader2,
  Trash2,
  AtSign,
  Check,
  X,
} from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';
import { renderContentWithMentions } from '../lib/renderMentions';
import { INPUT_CLASS } from '../lib/inputStyles';

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
}

// ── Component ─────────────────────────────────────────────────
export function MoodboardComments({ moodboardItemId }: MoodboardCommentsProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canComment = user?.role ? hasPermission(user.role, 'prototyping.moodboard', 'comment') : false;
  const canDelete = user?.role ? canDeleteAnything(user.role) : false;

  const [comments, setComments] = useState<MoodboardComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch profiles for tagging ───────────────────────────────
  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name')
      .neq('id', user?.id ?? '');
    setProfiles((data || []) as ProfileOption[]);
  }, [user?.id]);

  // ── Fetch comments ──────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    setLoading(true);
    // Select without profile join – anon may not read profiles in dev; join can fail silently
    const { data, error } = await supabase
      .from('moodboard_comments')
      .select('*')
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
            setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
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

  // ── Post comment (with optional tags) ─────────────────────────
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
      setPostError(commentErr.message || t('comments.postFailed'));
      setSending(false);
      return;
    }

    if (comment) {
      const newCommentRow: MoodboardComment = {
        id: comment.id,
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
      setComments((prev) => [...prev, newCommentRow]);
      setNewComment('');
      setTaggedUsers([]);

      // Create notifications for tagged users
      for (const taggedId of taggedUsers) {
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        await supabase.from('notifications').insert({
          user_id: taggedId,
          type: 'moodboard_tag',
          title: t('notifications.moodboardTagTitle', { name: authorName }),
          body: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          link: `/prototyping/moodboard`,
          moodboard_item_id: moodboardItemId,
          comment_id: comment.id,
          from_user_id: authorId,
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

  const toggleTagUser = (profile: ProfileOption) => {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.full_name || '?';
    const mention = `@${name} `;
    const isAdding = !taggedUsers.includes(profile.id);
    if (isAdding) {
      setNewComment((c) => (c.trim() ? `${c} ${mention}` : mention));
      setTaggedUsers((prev) => [...prev, profile.id]);
    } else {
      const escaped = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      setNewComment((c) => c.replace(new RegExp(escaped, 'g'), '').replace(/\s{2,}/g, ' ').trim());
      setTaggedUsers((prev) => prev.filter((id) => id !== profile.id));
    }
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
    setShowUserPicker(true);
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
        className={`group flex flex-col py-2 px-2 rounded-lg min-w-0 ${isOwn ? 'ml-6 bg-white/20 text-white' : 'mr-6 bg-white/10 text-white'}`}
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
            <div className="relative -mx-2 px-3 pt-1 pb-2 pr-4">
              <p className="text-base break-words pr-0 text-inherit">
                {renderContentWithMentions(
                  comment.content,
                  isOwn,
                  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || ''
                )}
              </p>
              {/* Edit & Delete: top right of message */}
              <div className="absolute right-2 top-0 z-10 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {canDelete && isOwn && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(comment);
                    }}
                    className="px-2 py-1 rounded text-xs text-white border-none bg-white/10"
                  >
                    {t('common.edit')}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(comment.id);
                    }}
                    className="px-2 py-1 rounded text-xs text-white bg-red-500 hover:bg-red-600"
                    title={t('common.delete')}
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
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
          </>
        )}
      </div>
    );
  };

  return (
    <section className="mt-4 pt-4 border-t border-nokturo-200 dark:border-nokturo-700 flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
          </div>
        ) : comments.length === 0 ? null : (
          <div className="space-y-2 mb-4">
            {comments.map(renderComment)}
          </div>
        )}
      </div>

      {/* New comment input with tag picker - fixed at bottom (only if role can comment) */}
      {canComment && (
      <div className="flex flex-col gap-2 shrink-0 pt-3">
        <div className="relative flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePost();
                }
              }}
              placeholder={t('comments.placeholder')}
              className={`${INPUT_CLASS} pr-8`}
            />
            <button
              type="button"
              onClick={() => setShowUserPicker((p) => !p)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                taggedUsers.length > 0
                  ? 'text-nokturo-700 dark:text-nokturo-300 bg-nokturo-200 dark:bg-nokturo-600'
                  : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300 hover:bg-nokturo-100 dark:hover:bg-nokturo-600'
              }`}
              title={t('comments.tagUser')}
            >
              <AtSign className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handlePost}
            disabled={!newComment.trim() || sending}
            className="size-9 flex items-center justify-center bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {postError && (
          <p className="text-xs text-red-500">{postError}</p>
        )}

        {showUserPicker && profiles.length > 0 && (
          <div className="bg-white dark:bg-nokturo-700 border border-nokturo-200 dark:border-nokturo-600 rounded-lg p-2 max-h-24 overflow-y-auto">
            <p className="text-[10px] text-nokturo-500 dark:text-nokturo-400 uppercase tracking-wider mb-1">
              {t('comments.tagUser')}
            </p>
            <div className="flex flex-wrap gap-1">
              {profiles.map((p) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || '?';
                const selected = taggedUsers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleTagUser(p)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selected
                        ? 'bg-nokturo-900 dark:bg-nokturo-500 text-white'
                        : 'bg-nokturo-100 dark:bg-nokturo-600 text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-200 dark:hover:bg-nokturo-500'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
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
