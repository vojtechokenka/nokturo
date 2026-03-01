import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2, Trash2 } from 'lucide-react';
import { SimpleDropdown } from './SimpleDropdown';
import { RichTextArea } from './RichTextArea';
import { INPUT_CLASS, MODAL_HEADING_CLASS } from '../lib/inputStyles';
import { createNotification } from './NotificationCenter';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: 'active' | 'completed' | 'deleted';
  created_by: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  assignees?: { user_id: string; profile?: TaskProfile | null }[];
}

export interface TaskProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface TaskFormData {
  title: string;
  description: string;
  deadline_day: string;
  deadline_month: string;
  deadline_year: string;
  assignee_ids: string[];
}

const YEAR_OPTIONS = [2025, 2026, 2027, 2028] as const;
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

const emptyForm: TaskFormData = {
  title: '',
  description: '',
  deadline_day: '',
  deadline_month: '',
  deadline_year: '',
  assignee_ids: [],
};

interface TaskSlideOverProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
}

export function TaskSlideOver({
  open,
  task,
  onClose,
  onSaved,
  onDelete,
}: TaskSlideOverProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isFounder = user?.role === 'founder';

  const [form, setForm] = useState<TaskFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<TaskProfile[]>([]);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `tasks/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'image/png';
    const { error: upErr } = await supabase.storage
      .from('uploads')
      .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600' });
    if (upErr) throw new Error(upErr.message);
    const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
    return data.publicUrl;
  }, []);

  useEffect(() => {
    if (!open || !isFounder) return;
    supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, avatar_url, role')
      .neq('role', 'founder')
      .order('first_name')
      .then(({ data }) => setProfiles((data as TaskProfile[]) || []));
  }, [open, isFounder]);

  useEffect(() => {
    if (task) {
      const d = task.deadline?.slice(0, 10);
      const [year, month, day] = d ? d.split('-') : ['', '', ''];
      setForm({
        title: task.title || '',
        description: task.description || '',
        deadline_day: day ? String(parseInt(day, 10)) : '',
        deadline_month: month ? String(parseInt(month, 10)) : '',
        deadline_year: year || '',
        assignee_ids: task.assignees?.map((a) => a.user_id) || [],
      });
    } else {
      const now = new Date();
      setForm({
        ...emptyForm,
        deadline_day: String(now.getDate()),
        deadline_month: String(now.getMonth() + 1),
        deadline_year: String(now.getFullYear()),
      });
    }
    setError('');
  }, [task, open]);

  const handleChange = (field: keyof TaskFormData, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleAssignee = (profileId: string) => {
    setForm((prev) => {
      const ids = prev.assignee_ids.includes(profileId)
        ? prev.assignee_ids.filter((id) => id !== profileId)
        : [...prev.assignee_ids, profileId];
      return { ...prev, assignee_ids: ids };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError(t('tasks.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      const deadline =
        form.deadline_day && form.deadline_month && form.deadline_year
          ? `${form.deadline_year}-${String(form.deadline_month).padStart(2, '0')}-${String(form.deadline_day).padStart(2, '0')}`
          : null;

      const record = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        deadline,
        status: task?.status ?? 'active',
        created_by: task?.id ? task.created_by : getUserIdForDb(),
      };

      let taskId = task?.id;

      if (task?.id) {
        const { error: updateErr } = await supabase
          .from('tasks')
          .update(record)
          .eq('id', task.id);
        if (updateErr) {
          setError(updateErr.message);
          return;
        }
      } else {
        const { data, error: insertErr } = await supabase
          .from('tasks')
          .insert(record)
          .select('id')
          .single();
        if (insertErr) {
          setError(insertErr.message);
          return;
        }
        taskId = data.id;
      }

      if (taskId) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId);

        const assigneeIds =
          isFounder && form.assignee_ids.length > 0
            ? form.assignee_ids
            : [getUserIdForDb()].filter(Boolean) as string[];

        if (assigneeIds.length > 0) {
          await supabase.from('task_assignees').insert(
            assigneeIds.map((uid) => ({ task_id: taskId!, user_id: uid }))
          );
        }

        // Notify newly assigned users (skip self)
        if (!task?.id && taskId) {
          const currentUserId = getUserIdForDb();
          for (const uid of assigneeIds) {
            if (uid !== currentUserId) {
              await createNotification(uid, 'task_assigned', form.title.trim(), null, taskId);
            }
          }
        }
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const profileName = (p: TaskProfile) =>
    [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || '?';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-nokturo-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className={MODAL_HEADING_CLASS}>
            {task?.id ? t('tasks.editTask') : t('tasks.addTask')}
          </h3>
          <div className="flex items-center gap-1">
            {task?.id && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:bg-red-500 hover:text-white transition-colors rounded-lg"
                title={t('common.delete')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('tasks.title')}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={t('tasks.titlePlaceholder')}
                className={INPUT_CLASS}
                autoFocus
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('tasks.deadline')}
              </label>
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
                <SimpleDropdown
                  value={form.deadline_day}
                  onChange={(v) => handleChange('deadline_day', v)}
                  options={[
                    { value: '', label: t('tasks.selectDay') },
                    ...DAY_OPTIONS.map((d) => ({ value: String(d), label: String(d) })),
                  ]}
                />
                <SimpleDropdown
                  value={form.deadline_month}
                  onChange={(v) => handleChange('deadline_month', v)}
                  options={[
                    { value: '', label: t('tasks.selectMonth') },
                    ...MONTH_NUMBERS.map((m) => ({
                      value: String(m),
                      label: t(`tasks.months.${m}`),
                    })),
                  ]}
                />
                <SimpleDropdown
                  value={form.deadline_year}
                  onChange={(v) => handleChange('deadline_year', v)}
                  options={[
                    { value: '', label: t('tasks.selectYear') },
                    ...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
                  ]}
                />
              </div>
            </div>

            {/* Assignees – founder only */}
            {isFounder && (
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                  {t('tasks.assignees')}
                </label>
                <div className="flex flex-wrap gap-6 mt-1">
                  {profiles.map((p) => {
                    const selected = form.assignee_ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleAssignee(p.id)}
                        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
                          selected
                            ? 'text-white opacity-100'
                            : 'text-nokturo-400 opacity-50'
                        }`}
                      >
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="avatar-round w-5 h-5 object-cover"
                          />
                        ) : (
                          <span className="avatar-round w-5 h-5 bg-nokturo-400 dark:bg-nokturo-500 flex items-center justify-center text-[10px] text-white font-medium">
                            {(p.first_name?.[0] || p.full_name?.[0] || '?').toUpperCase()}
                          </span>
                        )}
                        {profileName(p)}
                      </button>
                    );
                  })}
                  {profiles.length === 0 && (
                    <span className="text-sm text-nokturo-400 dark:text-nokturo-500">
                      {t('tasks.assigneesPlaceholder')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Description (rich text) */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('tasks.description')}
              </label>
              <RichTextArea
                value={form.description}
                onChange={(html) => handleChange('description', html)}
                onUploadImage={handleUploadImage}
                placeholder={t('tasks.descriptionPlaceholder')}
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-3 px-6 py-4 shrink-0 mt-auto bg-black">
            {error && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 shrink-0">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
