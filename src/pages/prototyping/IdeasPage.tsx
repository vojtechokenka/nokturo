import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import {
  NotionSelect,
  type NotionSelectOption,
} from '../../components/NotionSelect';
import {
  Plus,
  X,
  Loader2,
  Trash2,
  Pencil,
  Lightbulb,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DefaultAvatar } from '../../components/DefaultAvatar';
import { INPUT_CLASS } from '../../lib/inputStyles';

const inputClass = INPUT_CLASS;

// ── Types ─────────────────────────────────────────────────────
interface IdeaAuthor {
  full_name: string | null;
  avatar_url?: string | null;
}

interface Idea {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  type: 'text' | 'image' | 'mixed';
  categories?: string[] | null;
  /** @deprecated use categories; kept for backward compat before migration */
  category?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  position?: number;
  author?: IdeaAuthor | null;
}

// Map Notion category color → sticky note background (no border, no rounding)
const CATEGORY_BG: Record<string, string> = {
  gray: 'bg-slate-200',
  orange: 'bg-amber-200',
  blue: 'bg-sky-200',
  green: 'bg-emerald-200',
  purple: 'bg-violet-200',
  pink: 'bg-pink-200',
  red: 'bg-red-200',
  yellow: 'bg-amber-100',
};

// ── Component ─────────────────────────────────────────────────
export default function IdeasPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');

  // ── State ───────────────────────────────────────────────────
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  // Categories (Notion-style)
  const [categories, setCategories] = useState<NotionSelectOption[]>([]);

  // Quick-capture modal
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Drag-and-drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragDropIndex, setDragDropIndex] = useState<number | null>(null);

  // Lightbox (klik na fotku)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const ideasWithImages = ideas.filter((i) => i.image_url);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchIdeas = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('ideas')
      .select('*, author:profiles!ideas_created_by_fkey(full_name, avatar_url)')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (!error && data) {
      setIdeas(data as Idea[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('idea_categories')
      .select('*')
      .order('sort_order');
    if (!error && data) {
      setCategories(
        data.map((r: { id: string; name: string; color: string; sort_order: number }) => ({
          id: r.id,
          name: r.name,
          color: r.color || 'gray',
          sort_order: r.sort_order,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCategoriesChange = useCallback(
    async (newOptions: NotionSelectOption[]) => {
      const prevById = new Map(categories.map((o) => [o.id, o]));
      setError('');

      setCategories(newOptions);

      try {
        for (const opt of newOptions) {
          if (!prevById.has(opt.id)) {
            const { error: insErr } = await supabase.from('idea_categories').insert({
              id: opt.id,
              name: opt.name,
              color: opt.color,
              sort_order: opt.sort_order,
            });
            if (insErr) throw insErr;
          } else {
            const prev = prevById.get(opt.id);
            if (prev && (prev.name !== opt.name || prev.color !== opt.color || prev.sort_order !== opt.sort_order)) {
              const { error: updErr } = await supabase
                .from('idea_categories')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of categories) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('idea_categories').delete().eq('id', o.id);
            if (delErr) throw delErr;
          }
        }
        await fetchCategories();
      } catch (err: unknown) {
        setCategories(categories);
        const msg = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    },
    [categories, fetchCategories]
  );

  // ── Modal helpers ───────────────────────────────────────────
  const openAdd = () => {
    setEditingIdea(null);
    setFormTitle('');
    setFormContent('');
    setFormCategories([]);
    setFormImage(null);
    setFormImagePreview('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setFormTitle(idea.title);
    setFormContent(idea.content || '');
    setFormCategories(idea.categories ?? (idea.category ? [idea.category] : []));
    setFormImage(null);
    setFormImagePreview(idea.image_url || '');
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIdea(null);
  };

  // ── Image handling ──────────────────────────────────────────
  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10 MB)');
      return;
    }
    setFormImage(file);
    setFormImagePreview(URL.createObjectURL(file));
  };

  // ── Clipboard paste (Ctrl+V) when modal open ──────────────────
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!showModal) return;
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;

      for (const item of Array.from(clipItems)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;

          const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
          const file = new File([blob], `image-${Date.now()}.${ext}`, {
            type: blob.type,
          });
          handleImageSelect(file);
          break;
        }
      }
    },
    [showModal]
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError('');

    let imageUrl = editingIdea?.image_url || null;

    // Upload new image if provided
    if (formImage) {
      const ext = formImage.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `ideas/${fileName}`;

      const arrayBuffer = await formImage.arrayBuffer();
      const contentType = formImage.type || 'image/png';
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600' });

      if (storageError) {
        setError(storageError.message);
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      imageUrl = urlData.publicUrl;
    }

    const ideaType: Idea['type'] =
      imageUrl && formContent ? 'mixed' : imageUrl ? 'image' : 'text';

    const record: Record<string, unknown> = {
      title: formTitle.trim() || '',
      content: formContent || null,
      image_url: imageUrl,
      type: ideaType,
      categories: formCategories.length > 0 ? formCategories : [],
      created_by: editingIdea ? editingIdea.created_by : getUserIdForDb(),
    };
    if (!editingIdea) {
      const maxPos =
        ideas.length > 0 ? Math.max(...ideas.map((i) => i.position ?? 0), -1) : -1;
      record.position = maxPos + 1;
    }

    const { error: saveError } = editingIdea
      ? await supabase.from('ideas').update(record).eq('id', editingIdea.id)
      : await supabase.from('ideas').insert(record);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    closeModal();
    fetchIdeas();
  };

  // ── Reorder (drag-and-drop) ──────────────────────────────────
  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reordered = [...ideas];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    setIdeas(reordered);

    // Persist new positions to Supabase
    const updates = reordered.map((idea, idx) => ({
      id: idea.id,
      position: idx,
    }));
    for (const u of updates) {
      await supabase.from('ideas').update({ position: u.position }).eq('id', u.id);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('ideas').delete().eq('id', id);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    setDeleteTarget(null);
  };

  // ── Input class ─────────────────────────────────────────────

  // ── Render ──────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.ideas.title"
      descriptionKey="pages.ideas.description"
    >
      {/* ── Action bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-end">
        {/* Quick capture button */}
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('ideas.quickCapture')}
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Lightbulb className="w-12 h-12 text-nokturo-600 mb-4" />
          <p className="text-nokturo-600 font-medium">{t('ideas.noIdeas')}</p>
          <p className="text-nokturo-500 text-sm mt-1">{t('ideas.addFirst')}</p>
        </div>
      ) : (
        <div
          className="min-h-[400px] columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6"
          onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragDropIndex(null);
              }
            }}
          >
          {ideas.map((idea, idx) => {
            const cats = idea.categories ?? (idea.category ? [idea.category] : []);
            const firstCatName = cats[0];
            const cat = firstCatName ? categories.find((c) => c.name === firstCatName) : null;
            const colorClass = cat ? CATEGORY_BG[cat.color] ?? CATEGORY_BG.gray : CATEGORY_BG.gray;
            const isDragging = draggedId === idea.id;
            const showDropBefore = dragDropIndex === idx;
            const showDropAfter = dragDropIndex === idx + 1;

            return (
              <div
                key={idea.id}
                className="break-inside-avoid mb-4 relative"
              >
                {/* Drop indicator – před kartou */}
                {showDropBefore && (
                  <div className="absolute -top-1 left-0 right-0 h-1 bg-nokturo-100 rounded-full z-10" aria-hidden />
                )}
              <div
                draggable
                onDragStart={(e) => {
                  setDraggedId(idea.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', idea.id);
                  e.dataTransfer.setData('application/json', JSON.stringify({ id: idea.id, index: idx }));
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragDropIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (idea.id === draggedId) {
                    setDragDropIndex(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const dropIndex = e.clientY < midY ? idx : idx + 1;
                    setDragDropIndex(dropIndex);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const data = e.dataTransfer.getData('application/json');
                  if (!data) return;
                  const { index: fromIndex } = JSON.parse(data) as { id: string; index: number };
                  const toIndex = dragDropIndex ?? idx;
                  setDragDropIndex(null);
                  if (fromIndex !== toIndex) handleReorder(fromIndex, toIndex);
                }}
                title={t('ideas.dragToReorder')}
                className={`group ${colorClass} text-slate-800 overflow-hidden transition-all duration-200 touch-none cursor-grab active:cursor-grabbing min-w-[200px] ${
                  isDragging ? 'opacity-50 scale-95' : ''
                } hover:-translate-y-0.25`}
              >
                {/* Image section – klik otevře lightbox */}
                {idea.image_url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const idx = ideasWithImages.findIndex((i) => i.id === idea.id);
                      setLightboxIndex(idx >= 0 ? idx : null);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="aspect-square bg-slate-200/50 overflow-hidden w-full block cursor-pointer"
                  >
                    <img
                      src={idea.image_url}
                      alt={idea.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                )}

                {/* Body */}
                <div className="p-4 rounded bg-amber-200/80">
                  {(() => {
                    const cats = idea.categories ?? (idea.category ? [idea.category] : []);
                    return cats.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {cats.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white text-black shrink-0"
                        >
                          {c}
                        </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  <h3 className="text-heading-5 font-extralight leading-tight [color:inherit]">
                    {idea.title}
                  </h3>

                  {idea.content && (
                    <p className="text-sm mt-2 line-clamp-4 leading-relaxed opacity-100 [color:inherit]">
                      {idea.content}
                    </p>
                  )}

                  {/* Footer – author vlevo dole jako u zpráv v komunikaci */}
                  <div
                    className="flex items-center justify-between mt-3 pt-2"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-2 items-center min-w-0">
                      {idea.author?.avatar_url ? (
                        <img
                          src={idea.author.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <DefaultAvatar size={28} className="rounded-full overflow-hidden shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs truncate opacity-90 [color:inherit]">
                          {idea.author?.full_name || t('ideas.unknownAuthor')}
                        </span>
                        <span className="text-[10px] opacity-70 [color:inherit]">
                          {idea.created_at
                            ? new Date(idea.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(idea)}
                        className="p-2 rounded bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 transition-colors"
                        title={t('common.edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(idea.id)}
                          className="p-2 rounded bg-red-700 text-red-100 hover:text-red-50 transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
                {/* Drop indicator – za kartou */}
                {showDropAfter && (
                  <div className="absolute -bottom-1 left-0 right-0 h-1 bg-nokturo-100 rounded-full z-10" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lightbox: fotka ve fullscreen při kliku ───────────── */}
      {lightboxIndex !== null && ideasWithImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {ideasWithImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev !== null && prev > 0 ? prev - 1 : ideasWithImages.length - 1
                  );
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) =>
                    prev !== null && prev < ideasWithImages.length - 1 ? prev + 1 : 0
                  );
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          {/\.svg(\?|$)/i.test(ideasWithImages[lightboxIndex].image_url!) ? (
            <img
              src={ideasWithImages[lightboxIndex].image_url!}
              alt={ideasWithImages[lightboxIndex].title}
              width={400}
              height={400}
              className="max-w-full max-h-[90vh] object-contain rounded-lg aspect-square shrink-0"
              style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
              loading="eager"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={ideasWithImages[lightboxIndex].image_url!}
              alt={ideasWithImages[lightboxIndex].title}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Quick Capture Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                {editingIdea ? t('ideas.editIdea') : t('ideas.quickCapture')}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1">
                  {t('ideas.titleLabel')}
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('ideas.titlePlaceholder')}
                  className={inputClass}
                  autoFocus
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1">
                  {t('ideas.content')}
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('ideas.contentPlaceholder')}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1">
                  {t('ideas.category')}
                </label>
                <NotionSelect
                  value={formCategories}
                  onChange={(v) => setFormCategories(Array.isArray(v) ? v : v ? [v] : [])}
                  options={categories}
                  onOptionsChange={handleCategoriesChange}
                  placeholder="—"
                  optionsI18nKey="ideas.categories"
                  multiple
                  canDelete={canDelete}
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1">
                  {t('ideas.image')}
                </label>
                {formImagePreview ? (
                  <div className="relative">
                    <img
                      src={formImagePreview}
                      alt="Preview"
                      className="w-full rounded-lg max-h-40 object-cover"
                    />
                    <button
                      onClick={() => {
                        setFormImage(null);
                        setFormImagePreview('');
                      }}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-nokturo-500 dark:text-nokturo-400 bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors text-sm w-full justify-center"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {t('ideas.uploadImage')}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                  }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5 mt-3">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-900/90 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">{t('ideas.deleteConfirm')}</p>
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
    </PageShell>
  );
}
