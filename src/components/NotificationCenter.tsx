import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { Bell, Check, CheckCircle2, Clock, UserPlus, Trash2 } from 'lucide-react';

export interface Notification {
  id: string;
  user_id?: string;
  recipient_id?: string;
  type: 'task_assigned' | 'task_completed' | 'task_comment' | 'deadline_7d' | 'deadline_48h' | 'deadline_24h' | 'mention' | 'comment';
  title: string;
  body?: string | null;
  message?: string | null;
  task_id?: string | null;
  link?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  read: boolean;
  created_at: string;
}

const ICON_MAP: Partial<Record<Notification['type'], typeof Bell>> = {
  task_assigned: UserPlus,
  task_completed: CheckCircle2,
  task_comment: Bell,
  deadline_7d: Clock,
  deadline_48h: Clock,
  deadline_24h: Clock,
  mention: Bell,
  comment: Bell,
};

const COLOR_MAP: Record<Notification['type'], string> = {
  task_assigned: 'text-blue-500 dark:text-blue-400',
  task_completed: 'text-green-500 dark:text-green-400',
  task_comment: 'text-purple-500 dark:text-purple-400',
  deadline_7d: 'text-nokturo-500 dark:text-nokturo-400',
  deadline_48h: 'text-amber-500 dark:text-amber-400',
  deadline_24h: 'text-red-500 dark:text-red-400',
};

export function NotificationCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = getUserIdForDb();
  const user = useAuthStore((s) => s.user);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Fetch both user_id (legacy) AND recipient_id (mention/tag notifications)
    const { data: byUser } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50);
    const { data: byRecipient } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50);
    const merged = [...(byUser || []), ...(byRecipient || [])]
      .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);
    setNotifications((merged as Notification[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time: subscribe to INSERT and UPDATE on notifications
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
          filter: `user_id=eq.${userId}`,
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
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
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

  // Check deadline reminders on load and every 30 min
  useEffect(() => {
    if (!userId) return;
    checkDeadlineReminders(userId);
    const interval = setInterval(() => checkDeadlineReminders(userId), 30 * 60_000);
    return () => clearInterval(interval);
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    const updates: Record<string, unknown> = { read_at: new Date().toISOString() };
    const { error } = await supabase.from('notifications').update({ ...updates, read: true }).eq('id', id);
    if (error) {
      await supabase.from('notifications').update(updates).eq('id', id);
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!userId) return;
    let ok = false;
    const updates = { read: true, read_at: new Date().toISOString() };
    const r1 = await supabase.from('notifications').update(updates).eq('user_id', userId);
    if (!r1.error) ok = true;
    const r2 = await supabase.from('notifications').update(updates).eq('recipient_id', userId);
    if (!r2.error) ok = true;
    if (ok) setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('recipient_id', userId);
  };

  const handleNotificationClick = (n: Notification) => {
    markRead(n.id);
    const targetLink = n.link ?? (n.task_id ? `/tasks?task=${n.task_id}` : null);
    if (targetLink) {
      navigate(targetLink);
      const parsed = new URL(targetLink, 'http://x');
      const itemId = parsed.searchParams.get('item');
      if (itemId && parsed.pathname.includes('moodboard')) {
        window.dispatchEvent(new CustomEvent('open-moodboard-item', { detail: { itemId } }));
      }
    }
    setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchNotifications();
        }}
        className="relative inline-flex items-center justify-center w-8 h-8 text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-300/50 dark:hover:bg-nokturo-600 rounded-lg transition-all duration-150 hover:opacity-80 active:scale-95"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="notification-badge absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF1A1A]"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-nokturo-800 rounded-xl shadow-xl z-20 overflow-hidden animate-notification-panel">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-nokturo-200/60 dark:border-nokturo-700/60">
              <span className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100">
                {t('notifications.title')}
              </span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-200 transition-colors"
                  >
                    {t('notifications.markAllRead')}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1 text-nokturo-400 dark:text-nokturo-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title={t('notifications.clearAll')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-nokturo-500 dark:text-nokturo-500">
                  {t('notifications.empty')}
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = ICON_MAP[n.type] || Bell;
                  const iconColor = COLOR_MAP[n.type] || 'text-nokturo-500';

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 hover:opacity-90 active:scale-[0.99] ${
                        !n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.read ? 'font-medium text-nokturo-900 dark:text-nokturo-100' : 'text-nokturo-700 dark:text-nokturo-300'}`}>
                          {n.title}
                        </p>
                        {(n.body ?? n.message) && (
                          <p className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-0.5 line-clamp-1">
                            {n.body ?? n.message}
                          </p>
                        )}
                        <span className="text-[10px] text-nokturo-400 dark:text-nokturo-500 mt-1 block">
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      {!n.read && (
                        <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-[#FF1A1A]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Creates a notification row in the DB.
 * Call this from task actions (assign, complete, etc.)
 */
export async function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  body: string | null = null,
  taskId: string | null = null,
) {
  const link = taskId ? `/tasks?task=${taskId}` : null;
  const row: Record<string, unknown> = {
    user_id: userId,
    type,
    title,
    body,
    task_id: taskId,
    link,
    read: false,
  };
  await supabase.from('notifications').insert(row);
}

/**
 * Checks tasks with upcoming deadlines and creates reminder notifications
 * if they haven't been sent yet (deduplication by type + task_id + user_id within timeframe).
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
    .select('type, task_id')
    .eq('user_id', userId)
    .in('type', ['deadline_7d', 'deadline_48h', 'deadline_24h'])
    .in('task_id', tasks.map((t: { id: string }) => t.id));

  const sentSet = new Set(
    (existingNotifs || []).map((n: { type: string; task_id: string }) => `${n.type}:${n.task_id}`)
  );

  const now = Date.now();

  for (const task of tasks as { id: string; title: string; deadline: string; status: string }[]) {
    const deadline = new Date(task.deadline).getTime();
    const diff = deadline - now;
    const hours = diff / (3600 * 1000);

    if (hours <= 24 && hours > 0 && !sentSet.has(`deadline_24h:${task.id}`)) {
      await createNotification(userId, 'deadline_24h', task.title, null, task.id);
    } else if (hours <= 48 && hours > 24 && !sentSet.has(`deadline_48h:${task.id}`)) {
      await createNotification(userId, 'deadline_48h', task.title, null, task.id);
    } else if (hours <= 7 * 24 && hours > 48 && !sentSet.has(`deadline_7d:${task.id}`)) {
      await createNotification(userId, 'deadline_7d', task.title, null, task.id);
    }
  }
}
