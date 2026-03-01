import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../../components/PageShell';
import { TaskSlideOver, type Task, type TaskProfile } from '../../components/TaskSlideOver';
import { TaskDetailSlideOver } from '../../components/TaskDetailSlideOver';
import { TaskComments } from '../../components/TaskComments';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { createNotification } from '../../components/NotificationCenter';
import {
  Plus,
  Loader2,
  Check,
  RotateCcw,
  MoreHorizontal,
  Undo2,
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

function daysUntilPermanentDelete(deletedAt: string | null): number {
  if (!deletedAt) return DELETE_RETENTION_DAYS;
  const deleted = new Date(deletedAt).getTime();
  const expiry = deleted + DELETE_RETENTION_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86_400_000));
}

function daysUntilDeadline(deadline: string | null): number {
  if (!deadline) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((dl.getTime() - today.getTime()) / 86_400_000));
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
        className="p-1.5 text-nokturo-400 dark:text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 hover:bg-white/10 rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="dropdown-menu absolute right-0 top-full mt-1 bg-white dark:bg-black py-1 px-1 w-max z-20">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor">
                <path d="M3 21v-4.25L16.2 3.575q.3-.275.663-.425t.762-.15t.775.15t.65.45L20.425 5q.3.275.438.65T21 6.4q0 .4-.137.763t-.438.662L7.25 21zM17.6 7.8L19 6.4L17.6 5l-1.4 1.4z" />
              </svg>
              {t('common.edit')}
            </button>
            {task.status === 'active' ? (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkCompleted(); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor">
                  <path d="m10.95 14l4.95-4.95l-1.425-1.4l-3.525 3.525L9.525 9.75L8.1 11.175zM5 21V3h14v18l-7-3z" />
                </svg>
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
                className="w-full px-3 py-2 text-left text-sm bg-red-500 text-white hover:bg-red-600 flex items-center gap-2 whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor">
                  <path d="M9 17h2V8H9zm4 0h2V8h-2zm-8 4V6H4V4h5V3h6v1h5v2h-1v15z" />
                </svg>
                {t('common.delete')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type TaskScope = 'mine' | 'all';

export default function TasksPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const userId = getUserIdForDb();
  const isFounder = user?.role === 'founder';

  const [tab, setTab] = useState<Tab>('active');
  const [scope, setScope] = useState<TaskScope>('mine');
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!isFounder && scope === 'all') setScope('mine');
  }, [isFounder, scope]);
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

  const fetchCommentCounts = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) { setCommentCounts({}); return; }
    const { data } = await supabase
      .from('task_comments')
      .select('task_id')
      .in('task_id', taskIds)
      .is('parent_id', null);
    const counts: Record<string, number> = {};
    (data || []).forEach((r: { task_id: string }) => {
      counts[r.task_id] = (counts[r.task_id] || 0) + 1;
    });
    setCommentCounts(counts);
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    let taskIds: string[];

    if (scope === 'all') {
      const { data: allTaskRows } = await supabase
        .from('tasks')
        .select('id');
      taskIds = allTaskRows?.map((r: { id: string }) => r.id) || [];
    } else {
      const { data: assigneeRows } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', userId);
      taskIds = assigneeRows?.map((r: { task_id: string }) => r.task_id) || [];
    }

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
  }, [userId, scope, fetchCommentCounts]);

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

  const openDetail = useCallback((task: Task) => {
    setViewingTask(task);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setViewingTask(null);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, [fetchTasks, fetchProfiles]);

  // Open task from ?task= param (e.g. from notification click)
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId || loading) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      openDetail(task);
      const next = new URLSearchParams(searchParams);
      next.delete('task');
      setSearchParams(next, { replace: true });
    } else {
      (async () => {
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle();
        if (data) {
          const { data: assignees } = await supabase.from('task_assignees').select('task_id, user_id').eq('task_id', taskId);
          const enriched = { ...data, assignees: assignees?.map((a: { user_id: string }) => ({ user_id: a.user_id })) || [] };
          openDetail(enriched);
        }
        const next = new URLSearchParams(searchParams);
        next.delete('task');
        setSearchParams(next, { replace: true });
      })();
    }
  }, [searchParams.get('task'), tasks, loading, openDetail]);

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
    if (viewingTask?.id === taskId) closeDetail();
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
    if (viewingTask?.id === taskId) closeDetail();
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
    closeDetail();
    setEditingTask(task);
    setEditOpen(true);
  };

  const handleDescriptionChange = useCallback(
    async (taskId: string, description: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ description })
        .eq('id', taskId);
      if (error) {
        console.error('Description update error:', error);
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, description } : t))
      );
      if (viewingTask?.id === taskId) {
        setViewingTask((prev) => (prev ? { ...prev, description } : null));
      }
    },
    [viewingTask?.id]
  );

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
    <PageShell
      contentBg="black"
      contentOverflow={viewingTask ? 'hidden' : 'auto'}
      actionsSlot={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 tracking-tight">
              {scope === 'mine' ? t('tasks.myTasks') : t('tasks.allTasks')}
            </h1>
            {isFounder && (
              <div className="flex items-center bg-white/10 rounded-[6px] p-0.5">
                <button
                  type="button"
                  onClick={() => setScope('mine')}
                  className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                    scope === 'mine'
                      ? 'bg-white/10 text-nokturo-900 dark:text-nokturo-100'
                      : 'text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-200'
                  }`}
                >
                  {t('tasks.scopeMine')}
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                    scope === 'all'
                      ? 'bg-white/10 text-nokturo-900 dark:text-nokturo-100'
                      : 'text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-200'
                  }`}
                >
                  {t('tasks.scopeAll')}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 font-medium rounded-[6px] hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('tasks.addTask')}
          </button>
        </div>
      }
    >
      {viewingTask ? (
        /* Task detail + comments grid */
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[1fr_0.75fr] gap-3">
          <div className="min-h-0 overflow-hidden flex flex-col rounded-[12px] bg-nokturo-900">
            <TaskDetailSlideOver
              open
              task={viewingTask}
              profileMap={profileMap}
              onClose={closeDetail}
              onEdit={openEdit}
              onMarkCompleted={markCompleted}
              onReopen={reopenTask}
              onDelete={softDeleteTask}
              onDescriptionChange={handleDescriptionChange}
              inline
            />
          </div>
          <div className="min-h-0 overflow-hidden flex flex-col rounded-[12px] bg-nokturo-900">
            <TaskComments
              taskId={viewingTask.id}
              taskCreatorId={viewingTask.created_by}
              taskTitle={viewingTask.title}
            />
          </div>
        </div>
      ) : (
        <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-nokturo-200 dark:border-nokturo-700">
        {(['active', 'completed', 'deleted'] as Tab[]).map((key) => {
          const count = key === 'active' ? activeTasks.length : key === 'completed' ? completedTasks.length : deletedTasks.length;
          const badgeClass =
            key === 'active'
              ? 'bg-nokturo-500 text-white'
              : key === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white';

          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                tab === key
                  ? 'text-nokturo-900 dark:text-nokturo-100'
                  : 'text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300'
              }`}
            >
              {t(`tasks.${key}`)}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center w-4 h-4 min-w-4 min-h-4 rounded-[9999px] text-[10px] font-medium tabular-nums ${badgeClass}`}>
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
        <div className="mb-4 px-3 py-2 text-xs text-nokturo-600 dark:text-nokturo-400 flex items-center justify-between">
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
              className="text-xs font-medium bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ml-4"
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
          <p className="text-nokturo-600 dark:text-nokturo-400 text-sm">
            {tab === 'active'
              ? t('tasks.noActiveTasks')
              : tab === 'completed'
                ? t('tasks.noCompletedTasks')
                : t('tasks.noDeletedTasks')}
          </p>
          {tab === 'active' && (
            <p className="text-nokturo-500 dark:text-nokturo-500 text-sm mt-1">
              {t('tasks.addFirstTask')}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((task) => {
            const overdue = task.status === 'active' && isOverdue(task.deadline);
            const urgent = task.status === 'active' && isUrgent(task.deadline) && !overdue;
            const isCompleted = task.status === 'completed';
            const isDeleted = task.status === 'deleted';
            const daysLeft = isDeleted ? daysUntilPermanentDelete(task.deleted_at) : 0;

            return (
              <div
                key={task.id}
                className={`group flex items-center gap-3 p-4 rounded-[6px] transition-colors cursor-pointer ${
                  isDeleted
                    ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : isCompleted
                      ? 'bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      : 'bg-white/5 hover:bg-white/10'
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
                        ? 'bg-emerald-600 text-white'
                        : 'bg-nokturo-200/60 dark:bg-nokturo-700/60 hover:bg-nokturo-300 dark:hover:bg-nokturo-600'
                    }`}
                    title={isCompleted ? t('tasks.reopen') : t('tasks.markCompleted')}
                  >
                    {isCompleted && <Check className="w-4 h-4" strokeWidth={3} />}
                  </button>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                  <span
                    className={`text-sm font-medium truncate ${
                      isCompleted
                        ? 'line-through text-nokturo-500 dark:text-nokturo-500'
                        : isDeleted
                          ? 'text-white'
                          : 'text-nokturo-900 dark:text-nokturo-100'
                    }`}
                  >
                    {task.title}
                  </span>

                  {/* Deadline badge */}
                  {task.deadline && !isDeleted && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs h-6 px-2 shrink-0 rounded-[4px] ${
                        overdue
                          ? 'bg-red-600 text-[#ffc2c2]'
                          : urgent
                            ? 'bg-amber-600 text-[rgb(254,229,200)]'
                            : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400'
                      }`}
                    >
                      {overdue ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M1 21L12 2l11 19zm11.713-3.287Q13 17.425 13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18t.713-.288M11 15h2v-5h-2z"/></svg>
                      ) : urgent ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 22V4h3V2h2v2h8V2h2v2h3v7.675q-.475-.225-.975-.375T19 11.075V10H5v10h6.3q.175.55.413 1.05t.562.95zm11.463-.462Q13 20.075 13 18t1.463-3.537T18 13t3.538 1.463T23 18t-1.463 3.538T18 23t-3.537-1.463m5.212-1.162l.7-.7L18.5 17.8V15h-1v3.2z"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 22V4h3V2h2v2h8V2h2v2h3v18zm2-2h14V10H5z"/></svg>
                      )}
                      {overdue
                        ? `${t('tasks.overdue')}: ${formatDeadline(task.deadline)}`
                        : (() => {
                            const days = daysUntilDeadline(task.deadline);
                            if (days === 0) return t('tasks.dueToday');
                            if (days === 1) return t('tasks.daysLeftOne');
                            return t('tasks.daysLeft', { count: days });
                          })()}
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
                            className="avatar-round w-5 h-5 object-cover border border-white dark:border-nokturo-800"
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
                    <span className="inline-flex items-center text-xs h-6 px-2 shrink-0 rounded-[4px] bg-emerald-600 text-[#b3ffe8]">
                      {t('tasks.completedOn')}{' '}
                      {new Date(task.completed_at).toLocaleDateString(
                        user?.language === 'cs' ? 'cs-CZ' : 'en-US',
                        { day: 'numeric', month: 'short' }
                      )}
                    </span>
                  )}

                  {/* Comment count */}
                  {!isDeleted && (commentCounts[task.id] || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-nokturo-500 dark:text-nokturo-400 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
                        <path d="M2 18V2h20v20l-4-4z" />
                      </svg>
                      {commentCounts[task.id]}
                    </span>
                  )}

                  {/* Deleted countdown */}
                  {isDeleted && (
                    <span className="inline-flex items-center gap-1 text-xs h-6 px-2 shrink-0 rounded-[4px] bg-red-600 text-[#ffc2c2]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M9 3V1h6v2zm2 11h2V8h-2zm-2.488 7.288q-1.637-.713-2.862-1.938t-1.937-2.863T3 13t.713-3.488T5.65 6.65t2.863-1.937T12 4q1.55 0 2.975.5t2.675 1.45l1.4-1.4l1.4 1.4l-1.4 1.4Q20 8.6 20.5 10.025T21 13q0 1.85-.713 3.488T18.35 19.35t-2.863 1.938T12 22t-3.488-.712"/></svg>
                      {t('tasks.autoDeleteIn')} {daysLeft} {daysLeft === 1 ? t('tasks.day') : t('tasks.days')}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {isDeleted ? (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        recoverTask(task.id);
                      }}
                      className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap rounded-lg"
                      title={t('tasks.recover')}
                    >
                      <Undo2 className="w-3.5 h-3.5 inline mr-1" />
                      {t('tasks.recover')}
                    </button>
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
        </>
      )}


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
