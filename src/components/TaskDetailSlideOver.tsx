import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  CheckCircle2,
  RotateCcw,
  Calendar,
  Clock,
  AlertTriangle,
  User,
  MessageSquare,
} from 'lucide-react';
import type { Task, TaskProfile } from './TaskSlideOver';
import { TaskComments } from './TaskComments';

interface TaskDetailSlideOverProps {
  open: boolean;
  task: Task | null;
  profileMap: Record<string, TaskProfile>;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onMarkCompleted: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function TaskDetailSlideOver({
  open,
  task,
  profileMap,
  onClose,
  onEdit,
  onMarkCompleted,
  onReopen,
  onDelete,
}: TaskDetailSlideOverProps) {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);

  if (!open || !task) return null;

  const locale = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';

  const isOverdue = (() => {
    if (!task.deadline || task.status !== 'active') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.deadline) < today;
  })();

  const isRecentlyOverdue = (() => {
    if (!task.deadline || task.status !== 'active') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysPast = (today.getTime() - new Date(task.deadline).getTime()) / 86_400_000;
    return daysPast > 0 && daysPast <= 7;
  })();

  const isUrgent = (() => {
    if (!task.deadline || task.status !== 'active' || isOverdue) return false;
    const diff = new Date(task.deadline).getTime() - Date.now();
    return diff <= 7 * 86_400_000;
  })();

  const profileName = (uid: string) => {
    const p = profileMap[uid];
    if (!p) return '?';
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || '?';
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const creatorProfile = task.created_by ? profileMap[task.created_by] : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex animate-slide-in" style={{ maxWidth: 'calc(100vw - 60px)' }}>
        {/* Comments panel */}
        {commentsOpen && (
          <div className="hidden md:flex w-80 lg:w-96 bg-nokturo-50 dark:bg-nokturo-900 border-l border-nokturo-200 dark:border-nokturo-700 flex-col shrink-0">
            <TaskComments taskId={task.id} />
          </div>
        )}

        {/* Task detail panel */}
        <div className="w-full max-w-lg bg-white dark:bg-nokturo-800 border-l border-nokturo-200 dark:border-nokturo-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => task.status === 'completed' ? onReopen(task.id) : onMarkCompleted(task.id)}
              className={`shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                task.status === 'completed'
                  ? 'bg-green-600 dark:bg-green-500 text-white'
                  : 'border-[1.5px] border-nokturo-300 dark:border-nokturo-500 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
              }`}
              title={task.status === 'completed' ? t('tasks.reopen') : t('tasks.markCompleted')}
            >
              {task.status === 'completed' && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </button>
            <h3 className={`text-heading-5 font-extralight tracking-tight truncate min-w-0 ${
              task.status === 'completed'
                ? 'line-through text-nokturo-400 dark:text-nokturo-500'
                : 'text-nokturo-900 dark:text-nokturo-100'
            }`}>
              {task.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCommentsOpen((p) => !p)}
              className={`hidden md:flex p-2 rounded-lg transition-colors ${
                commentsOpen
                  ? 'text-nokturo-800 dark:text-nokturo-200 bg-nokturo-100 dark:bg-nokturo-700'
                  : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 hover:bg-nokturo-100 dark:hover:bg-nokturo-700'
              }`}
              title={t('tasks.comments')}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((p) => !p)}
                className="p-2 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 w-max z-20">
                    <button
                      onClick={() => { onEdit(task); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
                    >
                      <Pencil className="w-3.5 h-3.5 shrink-0" />
                      {t('common.edit')}
                    </button>
                    {task.status === 'active' ? (
                      <button
                        onClick={() => { onMarkCompleted(task.id); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {t('tasks.markCompleted')}
                      </button>
                    ) : (
                      <button
                        onClick={() => { onReopen(task.id); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        {t('tasks.reopen')}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(task.id); onClose(); setMenuOpen(false); }}
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
            <button
              onClick={onClose}
              className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Status */}
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                task.status === 'completed'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}
            >
              {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {t(`tasks.${task.status}`)}
            </span>
          </div>

          {/* Deadline */}
          {task.deadline && (
            <div>
              <label className="block text-sm font-normal text-nokturo-500 dark:text-nokturo-400 mb-1">
                {t('tasks.deadline')}
              </label>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  isRecentlyOverdue
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : isOverdue || isUrgent
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400'
                }`}
              >
                {isRecentlyOverdue ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : isOverdue || isUrgent ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                {isOverdue && `${t('tasks.overdue')}: `}
                {formatDate(task.deadline)}
              </span>
            </div>
          )}

          {/* Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div>
              <label className="block text-sm font-normal text-nokturo-500 dark:text-nokturo-400 mb-2">
                {t('tasks.assignees')}
              </label>
              <div className="flex flex-wrap gap-2">
                {task.assignees.map((a) => {
                  const p = profileMap[a.user_id];
                  return (
                    <div
                      key={a.user_id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-nokturo-100 dark:bg-nokturo-700 text-sm text-nokturo-700 dark:text-nokturo-300"
                    >
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-nokturo-300 dark:bg-nokturo-600 flex items-center justify-center text-[10px] text-white font-medium">
                          {(p?.first_name?.[0] || '?').toUpperCase()}
                        </span>
                      )}
                      {profileName(a.user_id)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Created by */}
          {creatorProfile && (
            <div>
              <label className="block text-sm font-normal text-nokturo-500 dark:text-nokturo-400 mb-1">
                {t('tasks.createdBy')}
              </label>
              <div className="inline-flex items-center gap-2 text-sm text-nokturo-700 dark:text-nokturo-300">
                {creatorProfile.avatar_url ? (
                  <img src={creatorProfile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-nokturo-400" />
                )}
                {profileName(task.created_by!)}
              </div>
            </div>
          )}

          {/* Completed date */}
          {task.status === 'completed' && task.completed_at && (
            <div>
              <label className="block text-sm font-normal text-nokturo-500 dark:text-nokturo-400 mb-1">
                {t('tasks.completedOn')}
              </label>
              <span className="text-sm text-nokturo-700 dark:text-nokturo-300">
                {formatDate(task.completed_at)}
              </span>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <label className="block text-sm font-normal text-nokturo-500 dark:text-nokturo-400 mb-2">
                {t('tasks.description')}
              </label>
              <div
                className="text-sm text-nokturo-800 dark:text-nokturo-200 leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
