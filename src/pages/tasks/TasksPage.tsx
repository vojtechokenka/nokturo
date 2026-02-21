import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../../components/PageShell';
import { TaskSlideOver, type Task, type TaskProfile } from '../../components/TaskSlideOver';
import { TaskDetailSlideOver } from '../../components/TaskDetailSlideOver';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { createNotification } from '../../components/NotificationCenter';
import {
  Plus,
  Loader2,
  Check,
  RotateCcw,
  Clock,
  AlertTriangle,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Undo2,
  MessageSquare,
} from 'lucide-react';

type Tab = 'active' | 'completed' | 'deleted';

const URGENT_DAYS = 7;
const DELETE_RETENTION_DAYS = 7;

function isUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  const diff = new Date(deadline).getTime() - Date.now();
  return diff <= URGENT_DAYS * 86_400_000;
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(deadline) < today;
}

function isRecentlyOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  const daysPast = (today.getTime() - dl.getTime()) / 86_400_000;
  return daysPast > 0 && daysPast <= URGENT_DAYS;
}

function daysUntilPermanentDelete(deletedAt: string | null): number {
  if (!deletedAt) return DELETE_RETENTION_DAYS;
  const deleted = new Date(deletedAt).getTime();
  const expiry = deleted + DELETE_RETENTION_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86_400_000));
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aUrgent = isUrgent(a.deadline);
    const bUrgent = isUrgent(b.deadline);

    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;

    if (aUrgent && bUrgent) {
      return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function TaskRowMenu({
  task,
  isFounder,
  onEdit,
  onMarkCompleted,
  onReopen,
  onDelete,
}: {
  task: Task;
  isFounder: boolean;
  onEdit: () => void;
  onMarkCompleted: () => void;
  onReopen: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="p-1.5 text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 w-max z-20">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              {t('common.edit')}
            </button>
            {task.status === 'active' ? (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkCompleted(); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {t('tasks.markCompleted')}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onReopen(); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                {t('tasks.reopen')}
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                {t('common.delete')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TasksPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const userId = getUserIdForDb();
  const isFounder = user?.role === 'founder';

  const [tab, setTab] = useState<Tab>('active');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, TaskProfile>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: assigneeRows } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', userId);

    const taskIds = assigneeRows?.map((r: { task_id: string }) => r.task_id) || [];

    if (taskIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data: taskRows, error } = await supabase
      .from('tasks')
      .select('*')
      .in('id', taskIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Tasks fetch error:', error);
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data: allAssignees } = await supabase
      .from('task_assignees')
      .select('task_id, user_id')
      .in('task_id', taskIds);

    const assigneesByTask: Record<string, { user_id: string }[]> = {};
    (allAssignees || []).forEach((a: { task_id: string; user_id: string }) => {
      if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
      assigneesByTask[a.task_id].push({ user_id: a.user_id });
    });

    const enriched = (taskRows || []).map((tk: Task) => ({
      ...tk,
      assignees: assigneesByTask[tk.id] || [],
    }));

    setTasks(enriched);
    fetchCommentCounts(taskIds);
    setLoading(false);
  }, [userId, fetchCommentCounts]);

  const fetchCommentCounts = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) { setCommentCounts({}); return; }
    const { data } = await supabase
      .from('task_comments')
      .select('task_id')
      .in('task_id', taskIds);
    const counts: Record<string, number> = {};
    (data || []).forEach((r: { task_id: string }) => {
      counts[r.task_id] = (counts[r.task_id] || 0) + 1;
    });
    setCommentCounts(counts);
  }, []);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, avatar_url, role');
    const map: Record<string, TaskProfile> = {};
    (data || []).forEach((p: TaskProfile) => {
      map[p.id] = p;
    });
    setProfileMap(map);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, [fetchTasks, fetchProfiles]);

  const activeTasks = sortTasks(tasks.filter((tk) => tk.status === 'active'));
  const completedTasks = tasks
    .filter((tk) => tk.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());
  const deletedTasks = tasks
    .filter((tk) => tk.status === 'deleted')
    .sort((a, b) => new Date(b.deleted_at || b.created_at).getTime() - new Date(a.deleted_at || a.created_at).getTime());

  const displayed = tab === 'active' ? activeTasks : tab === 'completed' ? completedTasks : deletedTasks;

  const markCompleted = async (taskId: string) => {
    const task = tasks.find((tk) => tk.id === taskId);
    await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId);

    // Notify other assignees that the task was completed
    if (task?.assignees) {
      for (const a of task.assignees) {
        if (a.user_id !== userId) {
          await createNotification(a.user_id, 'task_completed', task.title, null, taskId);
        }
      }
    }

    setToasts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        message: t('tasks.markCompleted'),
        type: 'success',
        actionLabel: t('tasks.undo'),
        onAction: () => reopenTask(taskId),
      },
    ]);
    if (viewingTask?.id === taskId) setDetailOpen(false);
    fetchTasks();
  };

  const reopenTask = async (taskId: string) => {
    const task = tasks.find((tk) => tk.id === taskId);
    const updates: Record<string, unknown> = { status: 'active', completed_at: null };
    if (task?.status === 'deleted' || task?.deleted_at) {
      updates.deleted_at = null;
    }
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);
    if (error) console.error('Reopen error:', error);
    fetchTasks();
  };

  const softDeleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('Soft delete error:', error);
      addToast(error.message, 'error');
      return;
    }
    if (viewingTask?.id === taskId) setDetailOpen(false);
    setToasts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        message: t('common.delete') || 'Deleted',
        type: 'success',
        actionLabel: t('tasks.recover'),
        onAction: () => recoverTask(taskId),
      },
    ]);
    fetchTasks();
  };

  const recoverTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'active', deleted_at: null })
      .eq('id', taskId);
    if (error) {
      console.error('Recover error:', error);
      addToast(error.message, 'error');
      return;
    }
    addToast(t('tasks.recover'));
    fetchTasks();
  };

  const permanentDeleteTask = async (taskId: string) => {
    await supabase.from('task_comments').delete().eq('task_id', taskId);
    await supabase.from('task_assignees').delete().eq('task_id', taskId);
    await supabase.from('tasks').delete().eq('id', taskId);
    addToast(t('tasks.deleteForever'));
    fetchTasks();
  };

  const openNew = () => {
    setEditingTask(null);
    setEditOpen(true);
  };

  const openEdit = (task: Task) => {
    setDetailOpen(false);
    setEditingTask(task);
    setEditOpen(true);
  };

  const openDetail = (task: Task) => {
    setViewingTask(task);
    setDetailOpen(true);
  };

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(user?.language === 'cs' ? 'cs-CZ' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const profileName = (uid: string) => {
    const p = profileMap[uid];
    if (!p) return '?';
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || '?';
  };

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 tracking-tight">
          {t('tasks.myTasks')}
        </h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 font-medium rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('tasks.addTask')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-nokturo-200 dark:border-nokturo-700">
        {(['active', 'completed', 'deleted'] as Tab[]).map((key) => {
          const count = key === 'active' ? activeTasks.length : key === 'completed' ? completedTasks.length : deletedTasks.length;
          const badgeClass =
            key === 'active'
              ? 'bg-nokturo-200 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400'
              : key === 'completed'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';

          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                tab === key
                  ? 'text-nokturo-900 dark:text-nokturo-100'
                  : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300'
              }`}
            >
              {t(`tasks.${key}`)}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] leading-none px-1 rounded-full ${badgeClass}`}>
                  {count}
                </span>
              )}
              {tab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-nokturo-900 dark:bg-nokturo-100 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Deleted tab info banner */}
      {tab === 'deleted' && deletedTasks.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-800 text-xs text-nokturo-500 dark:text-nokturo-400 flex items-center justify-between">
          <span>{t('tasks.deletedInfo')}</span>
          {isFounder && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(t('tasks.deleteAllConfirm'))) return;
                for (const task of deletedTasks) {
                  await supabase.from('task_comments').delete().eq('task_id', task.id);
                  await supabase.from('task_assignees').delete().eq('task_id', task.id);
                  await supabase.from('tasks').delete().eq('id', task.id);
                }
                addToast(t('tasks.deleteForever'));
                fetchTasks();
              }}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors whitespace-nowrap ml-4"
            >
              {t('tasks.deleteAll')}
            </button>
          )}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-nokturo-500 dark:text-nokturo-400 text-sm">
            {tab === 'active'
              ? t('tasks.noActiveTasks')
              : tab === 'completed'
                ? t('tasks.noCompletedTasks')
                : t('tasks.noDeletedTasks')}
          </p>
          {tab === 'active' && (
            <p className="text-nokturo-400 dark:text-nokturo-500 text-sm mt-1">
              {t('tasks.addFirstTask')}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((task) => {
            const overdue = task.status === 'active' && isOverdue(task.deadline);
            const recentlyOverdue = task.status === 'active' && isRecentlyOverdue(task.deadline);
            const urgent = task.status === 'active' && isUrgent(task.deadline) && !overdue;
            const isCompleted = task.status === 'completed';
            const isDeleted = task.status === 'deleted';
            const daysLeft = isDeleted ? daysUntilPermanentDelete(task.deleted_at) : 0;

            return (
              <div
                key={task.id}
                className={`group flex items-center gap-3 p-4 rounded-xl transition-colors cursor-pointer ${
                  isDeleted
                    ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : isCompleted
                      ? 'bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'bg-white dark:bg-nokturo-800 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50'
                }`}
                onClick={() => !isDeleted && openDetail(task)}
              >
                {/* Checkbox */}
                {!isDeleted && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      isCompleted ? reopenTask(task.id) : markCompleted(task.id);
                    }}
                    className={`shrink-0 w-4 h-4 rounded-[3px] flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-green-600 dark:bg-green-500 text-white'
                        : 'bg-nokturo-200/60 dark:bg-nokturo-700/60 hover:bg-nokturo-300 dark:hover:bg-nokturo-600'
                    }`}
                    title={isCompleted ? t('tasks.reopen') : t('tasks.markCompleted')}
                  >
                    {isCompleted && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                  <span
                    className={`text-sm font-medium truncate ${
                      isCompleted
                        ? 'line-through text-nokturo-400 dark:text-nokturo-500'
                        : isDeleted
                          ? 'text-nokturo-400 dark:text-nokturo-500'
                          : 'text-nokturo-900 dark:text-nokturo-100'
                    }`}
                  >
                    {task.title}
                  </span>

                  {/* Deadline badge */}
                  {task.deadline && !isDeleted && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        recentlyOverdue
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : overdue || urgent
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400'
                      }`}
                    >
                      {recentlyOverdue ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : overdue || urgent ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <Calendar className="w-3 h-3" />
                      )}
                      {overdue && `${t('tasks.overdue')}: `}
                      {formatDeadline(task.deadline)}
                    </span>
                  )}

                  {/* Assignees */}
                  {task.assignees && task.assignees.length > 0 && !isDeleted && (
                    <div className="flex items-center -space-x-1 shrink-0">
                      {task.assignees.slice(0, 3).map((a) => {
                        const p = profileMap[a.user_id];
                        return p?.avatar_url ? (
                          <img
                            key={a.user_id}
                            src={p.avatar_url}
                            alt={profileName(a.user_id)}
                            title={profileName(a.user_id)}
                            className="w-5 h-5 rounded-full object-cover border border-white dark:border-nokturo-800"
                          />
                        ) : (
                          <span
                            key={a.user_id}
                            title={profileName(a.user_id)}
                            className="w-5 h-5 rounded-full bg-nokturo-300 dark:bg-nokturo-600 flex items-center justify-center text-[9px] text-white font-medium border border-white dark:border-nokturo-800"
                          >
                            {(profileMap[a.user_id]?.first_name?.[0] || '?').toUpperCase()}
                          </span>
                        );
                      })}
                      {task.assignees.length > 3 && (
                        <span className="text-[10px] text-nokturo-500 ml-1.5">
                          +{task.assignees.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Completed date */}
                  {isCompleted && task.completed_at && (
                    <span className="text-xs text-green-600 dark:text-green-400 shrink-0">
                      {t('tasks.completedOn')}{' '}
                      {new Date(task.completed_at).toLocaleDateString(
                        user?.language === 'cs' ? 'cs-CZ' : 'en-US',
                        { day: 'numeric', month: 'short' }
                      )}
                    </span>
                  )}

                  {/* Comment count */}
                  {!isDeleted && (commentCounts[task.id] || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-500 dark:text-nokturo-400 shrink-0">
                      <MessageSquare className="w-3 h-3" />
                      {commentCounts[task.id]}
                    </span>
                  )}

                  {/* Deleted countdown */}
                  {isDeleted && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      {t('tasks.autoDeleteIn')} {daysLeft} {daysLeft === 1 ? t('tasks.day') : t('tasks.days')}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {isDeleted ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        recoverTask(task.id);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-nokturo-600 dark:text-nokturo-300 bg-nokturo-200/60 dark:bg-nokturo-700/60 hover:bg-nokturo-300 dark:hover:bg-nokturo-600 rounded-lg transition-colors whitespace-nowrap"
                      title={t('tasks.recover')}
                    >
                      <Undo2 className="w-3.5 h-3.5 inline mr-1" />
                      {t('tasks.recover')}
                    </button>
                    {isFounder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          permanentDeleteTask(task.id);
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title={t('tasks.deleteForever')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <TaskRowMenu
                    task={task}
                    isFounder={isFounder}
                    onEdit={() => openEdit(task)}
                    onMarkCompleted={() => markCompleted(task.id)}
                    onReopen={() => reopenTask(task.id)}
                    onDelete={() => softDeleteTask(task.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail slide-over */}
      <TaskDetailSlideOver
        open={detailOpen}
        task={viewingTask}
        profileMap={profileMap}
        onClose={() => setDetailOpen(false)}
        onEdit={openEdit}
        onMarkCompleted={markCompleted}
        onReopen={reopenTask}
        onDelete={softDeleteTask}
      />

      {/* Edit slide-over */}
      <TaskSlideOver
        open={editOpen}
        task={editingTask}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          fetchTasks();
        }}
        onDelete={softDeleteTask}
      />

      {/* Toast */}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </PageShell>
  );
}
