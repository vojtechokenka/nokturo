import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ArrowLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import type { Task, TaskProfile } from './TaskSlideOver';

interface TaskDetailSlideOverProps {
  open: boolean;
  task: Task | null;
  profileMap: Record<string, TaskProfile>;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onMarkCompleted: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete?: (id: string) => void;
  onDescriptionChange?: (taskId: string, description: string) => void;
  /** When true: render inline (no overlay), with back button instead of close */
  inline?: boolean;
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
  onDescriptionChange,
  inline = false,
}: TaskDetailSlideOverProps) {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  const syncChecklistLiClasses = useCallback((container: HTMLElement) => {
    container.querySelectorAll('.rta-checklist li').forEach((li) => {
      const cb = li.querySelector(':scope > input[type="checkbox"]') as HTMLInputElement | null;
      if (cb) li.classList.toggle('checked', cb.checked);
    });
  }, []);

  useEffect(() => {
    if (task?.description && descRef.current) {
      syncChecklistLiClasses(descRef.current);
    }
  }, [task?.description, syncChecklistLiClasses]);

  const handleDescriptionClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' || target.getAttribute('type') !== 'checkbox' || !target.closest('.rta-checklist')) return;
      if (!onDescriptionChange || !task) return;

      const checkbox = target as HTMLInputElement;
      const li = checkbox.closest('li');
      if (!li) return;

      li.classList.toggle('checked', checkbox.checked);
      if (checkbox.checked) checkbox.setAttribute('checked', '');
      else checkbox.removeAttribute('checked');

      const container = descRef.current;
      if (container) {
        const html = container.innerHTML;
        onDescriptionChange(task.id, html === '<br>' ? '' : html);
      }
    },
    [onDescriptionChange, task]
  );

  if (!open || !task) return null;

  const locale = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';

  const isOverdue = (() => {
    if (!task.deadline || task.status !== 'active') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.deadline) < today;
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

  const daysUntilDeadline = (deadline: string | null): number => {
    if (!deadline) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(deadline);
    dl.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((dl.getTime() - today.getTime()) / 86_400_000));
  };

  const creatorProfile = task.created_by ? profileMap[task.created_by] : null;

  return (
    <>
      {!inline && <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={onClose} />}
      <div className={`flex flex-col ${inline ? 'flex-1 min-h-0 bg-transparent' : 'fixed top-12 bottom-0 left-1/2 -translate-x-1/2 z-50 w-[80vw] max-w-[860px] bg-nokturo-900 shadow-2xl min-h-0'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {inline && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 shrink-0"
                title={t('common.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => task.status === 'completed' ? onReopen(task.id) : onMarkCompleted(task.id)}
              className={`shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                task.status === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'border-[1.5px] border-nokturo-300 dark:border-nokturo-500 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
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
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-sm font-medium bg-emerald-600 text-white`}
            >
              {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {t(`tasks.${task.status}`)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
                  <div className="dropdown-menu absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 shadow-lg py-1 w-max z-20">
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
                        className="w-full px-3 py-2 text-left text-sm bg-red-500 text-white hover:bg-red-600 flex items-center gap-2 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {!inline && (
              <button
                onClick={onClose}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-6 space-y-6">
          {/* Deadline */}
          {task.deadline && (
            <div>
              <label className="block text-sm font-normal text-nokturo-600 dark:text-nokturo-400 mb-1">
                {t('tasks.deadline')}
              </label>
              <span
                className={`inline-flex items-center gap-1 text-xs h-6 px-2 rounded-[4px] ${
                  isOverdue
                    ? 'bg-red-600 text-[#ffc2c2]'
                    : isUrgent
                      ? 'bg-amber-600 text-[rgb(254,229,200)]'
                      : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400'
                }`}
              >
                {isOverdue ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M1 21L12 2l11 19zm11.713-3.287Q13 17.425 13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18t.713-.288M11 15h2v-5h-2z"/></svg>
                ) : isUrgent ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 22V4h3V2h2v2h8V2h2v2h3v7.675q-.475-.225-.975-.375T19 11.075V10H5v10h6.3q.175.55.413 1.05t.562.95zm11.463-.462Q13 20.075 13 18t1.463-3.537T18 13t3.538 1.463T23 18t-1.463 3.538T18 23t-3.537-1.463m5.212-1.162l.7-.7L18.5 17.8V15h-1v3.2z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 22V4h3V2h2v2h8V2h2v2h3v18zm2-2h14V10H5z"/></svg>
                )}
                {isOverdue
                  ? `${t('tasks.overdue')}: ${formatDate(task.deadline)}`
                  : (() => {
                      const days = daysUntilDeadline(task.deadline);
                      if (days === 0) return t('tasks.dueToday');
                      if (days === 1) return t('tasks.daysLeftOne');
                      return t('tasks.daysLeft', { count: days });
                    })()}
              </span>
            </div>
          )}

          {/* Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div>
              <label className="block text-sm font-normal text-nokturo-600 dark:text-nokturo-400 mb-2">
                {t('tasks.assignees')}
              </label>
              <div className="flex flex-wrap gap-2">
                {task.assignees.map((a) => {
                  const p = profileMap[a.user_id];
                  return (
                    <div
                      key={a.user_id}
                      className="inline-flex items-center gap-2 text-sm text-nokturo-700 dark:text-nokturo-300"
                    >
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="avatar-round w-5 h-5 object-cover" />
                      ) : (
                        <span className="avatar-round w-5 h-5 bg-nokturo-300 dark:bg-nokturo-600 flex items-center justify-center text-[10px] text-white font-medium">
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
              <label className="block text-sm font-normal text-nokturo-600 dark:text-nokturo-400 mb-2">
                {t('tasks.createdBy')}
              </label>
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 text-sm text-nokturo-700 dark:text-nokturo-300">
                  {creatorProfile.avatar_url ? (
                    <img src={creatorProfile.avatar_url} alt="" className="avatar-round w-5 h-5 object-cover" />
                  ) : (
                    <span className="avatar-round w-5 h-5 bg-nokturo-300 dark:bg-nokturo-600 flex items-center justify-center text-[10px] text-white font-medium">
                      {(creatorProfile.first_name?.[0] || '?').toUpperCase()}
                    </span>
                  )}
                  {profileName(task.created_by!)}
                </div>
              </div>
            </div>
          )}

          {/* Completed date */}
          {task.status === 'completed' && task.completed_at && (
            <div>
              <label className="block text-sm font-normal text-nokturo-600 dark:text-nokturo-400 mb-1">
                {t('tasks.completedOn')}
              </label>
              <span className="inline-flex items-center text-xs h-6 px-2 rounded-[4px] bg-emerald-600 text-[#b3ffe8]">
                {formatDate(task.completed_at)}
              </span>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <label className="block text-sm font-normal text-nokturo-600 dark:text-nokturo-400 mb-2">
                {t('tasks.description')}
              </label>
              <div
                ref={descRef}
                onClick={handleDescriptionClick}
                className="text-sm text-nokturo-800 dark:text-nokturo-200 leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul:not(.rta-checklist)]:list-disc [&_ul:not(.rta-checklist)]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline cursor-text"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
