import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { canDeleteAnything } from '../lib/rbac';
import {
  Send,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';
import { renderContentWithMentions } from '../lib/renderMentions';
import { INPUT_CLASS } from '../lib/inputStyles';
import { useMentionSuggestions, MentionDropdown } from './MentionSuggestions';
import type { MentionProfile } from './MentionSuggestions';
import { sendMentionNotifications, parseMentionsFromText } from '../lib/sendMentionNotifications';
import { createNotification } from './NotificationCenter';

interface ProfileOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}

interface Comment {
  id: string;
  task_id: string;
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

interface TaskCommentsProps {
  taskId: string;
  taskCreatorId?: string | null;
  taskTitle?: string;
}

export function TaskComments({ taskId, taskCreatorId, taskTitle }: TaskCommentsProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role ? canDeleteAnything(user.role) : false;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);

  const mention = useMentionSuggestions(newComment, profiles as MentionProfile[]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleMentionSelect = useCallback((profile: MentionProfile) => {
    const newValue = mention.applyMention(profile);
    setNewComment(newValue);
    if (!taggedUsers.includes(profile.id)) {
      setTaggedUsers((prev) => {
        const next = [...prev, profile.id];
        if (import.meta.env.DEV) console.log('[TaskComments] handleMentionSelect: added', { profileId: profile.id, taggedUsersAfter: next });
        return next;
      });
    }
    mention.closeDropdown();
  }, [mention, taggedUsers]);

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

  useEffect(() => {
    if (!commentMenuOpen) return;
    const handle = () => setCommentMenuOpen(null);
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [commentMenuOpen]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_comments')
      .select('*, profile:profiles!task_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    setComments((data || []) as Comment[]);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
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
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setComments((prev) => prev.filter((c) => c.id !== oldRow.id && c.parent_id !== oldRow.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Comment;
            setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated, profile: c.profile } : c)));
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  const handlePost = async () => {
    const content = newComment.trim();
    const authorId = getUserIdForDb();
    if (!content || !user || !authorId) return;

    const taggedUsersSnapshot = [...taggedUsers];
    if (import.meta.env.DEV) console.log('[TaskComments] handlePost SUBMIT – taggedUsers at submit', { taggedUsersSnapshot });

    setSending(true);

    const { data: inserted, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: authorId,
        parent_id: null,
        content,
      })
      .select('*, profile:profiles!task_comments_author_id_fkey(full_name, first_name, last_name, avatar_url)')
      .single();

    if (!error && inserted) {
      setComments((prev) => [...prev, inserted as Comment]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      if (import.meta.env.DEV && taggedUsersSnapshot.length === 0) {
        const parsedNames = parseMentionsFromText(content);
        if (parsedNames.length) {
          console.log('[TaskComments] PARSER: mentions in text but taggedUsers empty', { content: content.slice(0, 100), parsedMentionNames: parsedNames });
        }
      }
      if (taggedUsersSnapshot.length > 0) {
        if (import.meta.env.DEV) console.log('[TaskComments] calling sendMentionNotifications', { taggedUsersSnapshot });
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        await sendMentionNotifications({
          taggedUserIds: taggedUsersSnapshot,
          authorId,
          authorName,
          content,
          type: 'text_tag',
          link: `/tasks?task=${taskId}`,
          commentId: inserted.id,
        });
      }

      if (taskCreatorId && taskCreatorId !== authorId) {
        const commenterName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        const notifTitle = taskTitle
          ? `${commenterName}: ${taskTitle}`
          : commenterName;
        await createNotification(
          taskCreatorId,
          'task_comment',
          notifTitle,
          content.slice(0, 200),
          taskId,
        );
      }

      setNewComment('');
      setTaggedUsers([]);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('task_comments').delete().eq('id', id);
    setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
    setDeleteTarget(null);
  };

  const displayedComments = comments
    .filter((c) => !c.parent_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const renderComment = (comment: Comment) => {
    const name =
      [comment.profile?.first_name, comment.profile?.last_name].filter(Boolean).join(' ') ||
      comment.profile?.full_name ||
      'Unknown';
    const isOwn = comment.author_id === user?.id;

    return (
      <div key={comment.id} className={isOwn ? 'ml-10' : 'mr-10'}>
        <div
          className={`group flex flex-col py-2 px-2 rounded-lg min-w-0 ${isOwn ? 'bg-nokturo-100 dark:bg-white/20 text-nokturo-900 dark:text-white' : 'bg-nokturo-200/80 dark:bg-white/10 text-nokturo-800 dark:text-white border border-nokturo-200/60 dark:border-transparent'}`}
        >
          <div className="-mx-2 px-3 pt-1 pb-2">
            <p className="text-base break-words text-inherit leading-relaxed">
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
                <DefaultAvatar size={28} className="rounded-full overflow-hidden shrink-0 w-7 h-7" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate text-inherit">{name}</span>
                <span className="text-[10px] opacity-80 text-inherit">
                  {new Date(comment.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(isOwn || canDelete) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id); }}
                    className={`p-1 rounded text-nokturo-400 hover:text-nokturo-600 dark:text-white/60 dark:hover:text-white/90 hover:bg-nokturo-100 dark:hover:bg-white/10 transition-all ${commentMenuOpen === comment.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {commentMenuOpen === comment.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setCommentMenuOpen(null); }} />
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[100px] z-20" onClick={(e) => e.stopPropagation()}>
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
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-nokturo-500 animate-spin" />
          </div>
        ) : displayedComments.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-nokturo-600 text-xs">{t('comments.noComments')}</p>
            <p className="text-nokturo-500 dark:text-nokturo-500 text-[10px] mt-0.5">{t('tasks.commentsBeFirst')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedComments.map((c) => renderComment(c))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-nokturo-200 dark:border-nokturo-700 shrink-0 relative">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 relative">
            {mention.active && (
              <MentionDropdown profiles={mention.filtered} selectedIdx={mention.selectedIdx} onSelect={handleMentionSelect} />
            )}
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                const result = mention.handleKeyDown(e);
                if (result === 'select') { const p = mention.getSelectedProfile(); if (p) handleMentionSelect(p); return; }
                if (result) return;
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); }
              }}
              placeholder={t('comments.placeholder')}
              className={`${INPUT_CLASS} !text-xs h-9 !py-0`}
            />
          </div>
          <button
            type="button"
            onClick={() => handlePost()}
            disabled={!newComment.trim() || sending}
            className="size-9 flex items-center justify-center bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">{t('comments.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
