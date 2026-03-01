import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string | null;
  type: 'task_assigned' | 'task_completed' | 'task_comment' | 'deadline_7d' | 'deadline_48h' | 'deadline_24h' | 'mention' | 'comment' | 'project_update';
  title: string;
  message?: string | null;
  link?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  metadata?: Record<string, unknown>;
  read: boolean;
  dismissed?: boolean;
  created_at: string;
  read_at?: string | null;
}

export function useNotifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = getUserIdForDb();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .eq('dismissed', false)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time: recipient_id only
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => {
            const newN = payload.new as Notification;
            if (prev.some((n) => n.id === newN.id)) return prev;
            return [newN, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Check deadline reminders once on mount (polling removed to reduce notification spam)
  useEffect(() => {
    if (!userId) return;
    checkDeadlineReminders(userId);
  }, [userId]);

  const markRead = async (id: string) => {
    const readAt = new Date().toISOString();
    await supabase.from('notifications').update({ read: true, read_at: readAt }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!userId) return;
    const readAt = new Date().toISOString();
    await supabase.from('notifications').update({ read: true, read_at: readAt }).eq('recipient_id', userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('recipient_id', userId);
  };

  const handleNotificationClick = (n: Notification, onClose?: () => void) => {
    markRead(n.id);
    const targetLink = n.link ?? (n.reference_type === 'task' && n.reference_id ? `/tasks?task=${n.reference_id}` : null);
    if (targetLink) {
      const parsed = new URL(targetLink.startsWith('/') ? targetLink : `/${targetLink}`, 'http://x');
      const itemId = parsed.searchParams.get('item');
      const isMoodboard = parsed.pathname.includes('moodboard');
      navigate(targetLink);
      onClose?.();
      // Dispatch after navigation so MoodboardPage is mounted and listening
      if (itemId && isMoodboard) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-moodboard-item', { detail: { itemId } }));
        }, 150);
      }
    } else {
      onClose?.();
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('notifications.justNow');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    clearAll,
    handleNotificationClick,
    formatTime,
  };
}

export function NotificationPanel({
  notifications,
  unreadCount,
  markAllRead,
  clearAll,
  handleNotificationClick,
  formatTime,
  onClose,
}: {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clearAll: () => void;
  handleNotificationClick: (n: Notification, onClose?: () => void) => void;
  formatTime: (iso: string) => string;
  onClose?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 dark:bg-white/5">
        <span className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 flex items-center gap-2">
          {t('notifications.title')}
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 bg-[#FF1A1A] text-[10px] font-semibold text-white leading-none" style={{ borderRadius: 9999 }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="p-1 text-nokturo-400 dark:text-nokturo-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title={t('notifications.clearAll')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0">
                <path fill="currentColor" d="M9 17h2V8H9zm4 0h2V8h-2zm-8 4V6H4V4h5V3h6v1h5v2h-1v15z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto p-3">
      <div className="flex flex-col gap-2">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-nokturo-500 dark:text-nokturo-500">
            {t('notifications.empty')}
          </div>
        ) : (
          notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n, onClose)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-nokturo-50/20 dark:hover:bg-white/[0.03] hover:opacity-[0.98] active:scale-[0.99] rounded-[10px] ${
                  !n.read ? 'bg-blue-50/50 dark:bg-white/5' : ''
                }`}
              >
                <span
                  className={`mt-1.5 shrink-0 w-2 h-2 rounded-[50%] ${!n.read ? 'bg-[#FF1A1A]' : 'bg-nokturo-400 dark:bg-nokturo-500'}`}
                />
                <div className={`flex-1 min-w-0 ${n.read ? 'opacity-50' : ''}`}>
                  <p className={`text-sm leading-snug whitespace-nowrap ${!n.read ? 'font-medium text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-600 dark:text-nokturo-500'}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className={`text-xs mt-0.5 line-clamp-1 ${!n.read ? 'text-nokturo-500 dark:text-nokturo-400' : 'text-nokturo-400 dark:text-nokturo-600'}`}>
                      {n.message}
                    </p>
                  )}
                  <span className={`text-[10px] mt-1 block ${!n.read ? 'text-nokturo-400 dark:text-nokturo-500' : 'text-nokturo-400 dark:text-nokturo-600'}`}>
                    {formatTime(n.created_at)}
                  </span>
                </div>
              </button>
            ))
        )}
      </div>
      </div>
    </>
  );
}

/** DB type CHECK: mention | comment | task_assigned | project_update */
const CREATE_TYPE_MAP: Record<string, string> = {
  task_assigned: 'task_assigned',
  task_completed: 'comment',
  task_comment: 'comment',
  deadline_7d: 'task_assigned',
  deadline_48h: 'task_assigned',
  deadline_24h: 'task_assigned',
  mention: 'mention',
  comment: 'comment',
};

/**
 * Creates a notification row in the DB.
 * Call this from task actions (assign, complete, etc.)
 */
export async function createNotification(
  recipientId: string,
  type: Notification['type'],
  title: string,
  body: string | null = null,
  taskId: string | null = null,
  senderId?: string | null,
  metadata?: Record<string, unknown>,
) {
  const link = taskId ? `/tasks?task=${taskId}` : null;
  await supabase.from('notifications').insert({
    recipient_id: recipientId,
    sender_id: senderId ?? null,
    type: CREATE_TYPE_MAP[type] || 'comment',
    title,
    message: body,
    link,
    reference_type: taskId ? 'task' : null,
    reference_id: taskId,
    metadata: metadata ?? {},
  });
}

/**
 * Checks tasks with upcoming deadlines and creates reminder notifications
 * if they haven't been sent yet (deduplication by recipient_id + reference_id + metadata.deadlineReminder).
 */
async function checkDeadlineReminders(userId: string) {
  const { data: assigneeRows } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('user_id', userId);

  const taskIds = assigneeRows?.map((r: { task_id: string }) => r.task_id) || [];
  if (taskIds.length === 0) return;

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, deadline, status')
    .in('id', taskIds)
    .eq('status', 'active')
    .not('deadline', 'is', null);

  if (!tasks || tasks.length === 0) return;

  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('metadata, reference_id')
    .eq('recipient_id', userId)
    .in('reference_id', tasks.map((t: { id: string }) => t.id));

  const sentSet = new Set(
    (existingNotifs || [])
      .filter(
        (n: { metadata?: { deadlineReminder?: string }; reference_id?: string }) =>
          n.metadata?.deadlineReminder && n.reference_id
      )
      .map(
        (n: { metadata?: { deadlineReminder?: string }; reference_id: string }) =>
          `${n.metadata!.deadlineReminder}:${n.reference_id}`
      )
  );

  const now = Date.now();

  for (const task of tasks as { id: string; title: string; deadline: string; status: string }[]) {
    const deadline = new Date(task.deadline).getTime();
    const diff = deadline - now;
    const hours = diff / (3600 * 1000);

    if (hours <= 24 && hours > 0 && !sentSet.has(`24h:${task.id}`)) {
      await createNotification(userId, 'deadline_24h', task.title, null, task.id, null, {
        deadlineReminder: '24h',
      });
    } else if (hours <= 48 && hours > 24 && !sentSet.has(`48h:${task.id}`)) {
      await createNotification(userId, 'deadline_48h', task.title, null, task.id, null, {
        deadlineReminder: '48h',
      });
    } else if (hours <= 7 * 24 && hours > 48 && !sentSet.has(`7d:${task.id}`)) {
      await createNotification(userId, 'deadline_7d', task.title, null, task.id, null, {
        deadlineReminder: '7d',
      });
    }
  }
}
