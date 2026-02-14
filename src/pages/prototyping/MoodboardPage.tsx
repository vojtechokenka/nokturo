import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import { MoodboardComments } from '../../components/MoodboardComments';
import { ToastContainer, type ToastData } from '../../components/Toast';
import {
  NotionSelect,
  type NotionSelectOption,
} from '../../components/NotionSelect';
import {
  Plus,
  X,
  Upload,
  Loader2,
  Trash2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Link2,
  LayoutGrid,
  Pencil,
  MoreVertical,
} from 'lucide-react';
import { INPUT_CLASS } from '../../lib/inputStyles';

const inputClass = INPUT_CLASS;

// Notion-style tag colors (same as NotionSelect)
const TAG_COLORS: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-amber-600 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-600 text-white',
  purple: 'bg-violet-600 text-white',
  pink: 'bg-pink-600 text-white',
  red: 'bg-red-600 text-white',
  yellow: 'bg-amber-500 text-nokturo-900',
};

// ── Types ─────────────────────────────────────────────────────
interface MoodboardItem {
  id: string;
  title: string | null;
  image_url: string;
  categories: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Component ─────────────────────────────────────────────────
export default function MoodboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');

  // ── State ───────────────────────────────────────────────────
  const [items, setItems] = useState<MoodboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter (multiselect: show items that have ANY of selected categories)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategories, setUploadCategories] = useState<string[]>([]);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadComment, setUploadComment] = useState('');
  const [uploadTaggedUsers, setUploadTaggedUsers] = useState<string[]>([]);
  const [uploadProfiles, setUploadProfiles] = useState<{ id: string; first_name: string | null; last_name: string | null; full_name: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [urlError, setUrlError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxMenuOpen, setLightboxMenuOpen] = useState(false);

  // Card menu
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!cardMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-card-menu]')) setCardMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cardMenuOpen]);

  // Close lightbox on ESC
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Edit
  const [editTarget, setEditTarget] = useState<MoodboardItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // URL input (inside upload modal)
  const [urlInput, setUrlInput] = useState('');
  const [urlLoadedBlob, setUrlLoadedBlob] = useState<Blob | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // Categories (from DB, Notion-style)
  const [categories, setCategories] = useState<NotionSelectOption[]>([]);

  // Gallery layout: 3, 4, 5, or 6 columns
  const [galleryColumns, setGalleryColumns] = useState<3 | 4 | 5 | 6>(4);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('moodboard_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (categoryFilter.length > 0) {
      query = query.overlaps('categories', categoryFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setItems(
        (data as { categories?: string[] | null }[]).map((row) => ({
          ...row,
          categories: Array.isArray(row.categories) ? row.categories : [],
        })) as MoodboardItem[]
      );
    }
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('moodboard_categories')
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

  const fetchUploadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name');
    const uid = user?.id;
    setUploadProfiles(
      ((data || []) as { id: string; first_name: string | null; last_name: string | null; full_name: string | null }[])
        .filter((p) => p.id !== uid)
    );
  }, [user?.id]);

  useEffect(() => {
    if (showUpload) fetchUploadProfiles();
  }, [showUpload, fetchUploadProfiles]);

  // Populate edit form when editTarget changes
  useEffect(() => {
    if (editTarget) {
      setEditTitle(editTarget.title || '');
      setEditNotes(editTarget.notes || '');
      setEditCategories(editTarget.categories || []);
      setEditError('');
    }
  }, [editTarget]);

  const handleCategoriesChange = useCallback(
    async (newOptions: NotionSelectOption[]) => {
      const prevById = new Map(categories.map((o) => [o.id, o]));
      setUploadError('');

      setCategories(newOptions);

      try {
        for (const opt of newOptions) {
          if (!prevById.has(opt.id)) {
            const { error: insErr } = await supabase.from('moodboard_categories').insert({
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
                .from('moodboard_categories')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of categories) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('moodboard_categories').delete().eq('id', o.id);
            if (delErr) throw delErr;
          }
        }
        await fetchCategories();
      } catch (err: unknown) {
        setCategories(categories);
        const msg = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : err instanceof Error ? err.message : String(err);
        setUploadError(msg);
      }
    },
    [categories, fetchCategories]
  );

  // ── File handling ───────────────────────────────────────────
  const handleFileSelect = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large (max 10 MB)');
      return;
    }
    setUrlInput('');
    setUrlLoadedBlob(null);
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setUploadError('');
    setUrlError('');
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const resetUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    if (uploadPreview.startsWith('blob:')) URL.revokeObjectURL(uploadPreview);
    setUploadPreview('');
    setUrlInput('');
    setUrlLoadedBlob(null);
    setUploadTitle('');
    setUploadCategories([]);
    setUploadNotes('');
    setUploadComment('');
    setUploadTaggedUsers([]);
    setUploadError('');
    setUrlError('');
  };

  const clearImage = () => {
    setUploadFile(null);
    if (uploadPreview.startsWith('blob:')) URL.revokeObjectURL(uploadPreview);
    setUploadPreview('');
    setUrlInput('');
    setUrlLoadedBlob(null);
    setUploadError('');
    setUrlError('');
    fileInputRef.current && (fileInputRef.current.value = '');
  };

  // ── URL paste handler ───────────────────────────────────────
  const handleUrlPaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text').trim();
    if (pastedText) {
      setUrlInput(pastedText);
      handleUrlLoad(pastedText);
    }
  };

  // ── Load image from URL (preview only) ───────────────────────
  const handleUrlLoad = useCallback(async (urlOverride?: string) => {
    const url = (urlOverride ?? urlInput).trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setUrlError(t('moodboard.invalidUrl'));
      return;
    }
    setUrlLoading(true);
    setUrlError('');
    try {
      let blob: Blob;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Direct fetch failed');
        const ct = response.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) throw new Error('Not an image');
        blob = await response.blob();
      } catch {
        const { data, error } = await supabase.functions.invoke('fetch-image', {
          body: { url },
        });
        if (error) {
          let msg = (error as Error).message;
          if (
            (error instanceof FunctionsHttpError || error?.name === 'FunctionsHttpError') &&
            error.context
          ) {
            try {
              const text =
                typeof error.context.text === 'function'
                  ? await error.context.text()
                  : String(error.context?.body ?? '');
              const body = text ? (JSON.parse(text) as { error?: string }) : null;
              if (body?.error) msg = body.error;
            } catch {
              /* ignore parse error */
            }
          }
          throw new Error(msg || 'Invalid');
        }
        if (!data) throw new Error('Invalid');
        const { image: base64, contentType } = data as { image: string; contentType: string };
        if (!base64) throw new Error('Invalid');
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        blob = new Blob([binary], { type: contentType || 'image/png' });
      }
      setUrlLoadedBlob(blob);
      setUploadPreview(URL.createObjectURL(blob));
      setUploadFile(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isGeneric =
        !msg ||
        msg === 'Invalid' ||
        msg === 'Direct fetch failed' ||
        msg === 'Not an image' ||
        msg === 'Edge Function returned a non-2xx status code';
      let displayMsg = t('moodboard.invalidUrl');
      if (!isGeneric) {
        const translated = t(`moodboard.urlErrors.${msg}` as any);
        displayMsg = translated !== `moodboard.urlErrors.${msg}` ? translated : msg;
      }
      setUrlError(displayMsg);
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, t]);

  // ── Upload to Supabase Storage ──────────────────────────────
  const handleUpload = async () => {
    const fileToUpload = uploadFile || (urlLoadedBlob ? new File([urlLoadedBlob], `image-${Date.now()}.png`, { type: urlLoadedBlob.type }) : null);
    if (!fileToUpload) return;
    setUploading(true);
    setUploadError('');

    try {
      const ext = fileToUpload.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `moodboard/${fileName}`;

      // Use ArrayBuffer + explicit contentType – avoids Electron FormData/File issues
      const arrayBuffer = await fileToUpload.arrayBuffer();
      const contentType = fileToUpload.type || 'image/png';
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600' });

      if (storageError) {
        setUploadError(storageError.message);
        setUploading(false);
        return;
      }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    // Insert record
    const { data: insertedItem, error: insertError } = await supabase
      .from('moodboard_items')
      .insert({
        title: uploadTitle || null,
        image_url: urlData.publicUrl,
        categories: uploadCategories.length > 0 ? uploadCategories : [],
        notes: uploadNotes || null,
        created_by: getUserIdForDb(),
      })
      .select('id')
      .single();

    if (insertError) {
      setUploadError(insertError.message);
      setUploading(false);
      return;
    }

    // Optional: add comment with tags (creates notifications for tagged users)
    if (insertedItem && (uploadComment.trim() || uploadTaggedUsers.length > 0)) {
      const authorId = getUserIdForDb();
      const content = uploadComment.trim() || t('moodboard.taggedYou');
      const { data: comment } = await supabase
        .from('moodboard_comments')
        .insert({
          moodboard_item_id: insertedItem.id,
          author_id: authorId,
          content,
          tagged_user_ids: uploadTaggedUsers,
        })
        .select('id')
        .single();

      if (comment && uploadTaggedUsers.length > 0 && user) {
        const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
        for (const taggedId of uploadTaggedUsers) {
          await supabase.from('notifications').insert({
            user_id: taggedId,
            type: 'moodboard_tag',
            title: t('notifications.moodboardTagTitle', { name: authorName }),
            body: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
            link: '/prototyping/moodboard',
            moodboard_item_id: insertedItem.id,
            comment_id: comment.id,
            from_user_id: authorId,
          });
        }
      }
    }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      setUploading(false);
      return;
    }
    setUploading(false);
    resetUpload();
    fetchItems();
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('moodboard_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteTarget(null);
  };

  // ── Edit / Update ───────────────────────────────────────────
  const openEdit = (item: MoodboardItem) => {
    setEditTarget(item);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditError('');
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');
    const { error } = await supabase
      .from('moodboard_items')
      .update({
        title: editTitle || null,
        notes: editNotes || null,
        categories: editCategories,
      })
      .eq('id', editTarget.id);
    setEditSaving(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === editTarget.id
          ? { ...i, title: editTitle || null, notes: editNotes || null, categories: editCategories }
          : i
      )
    );
    closeEdit();
  };

  // ── Toast helpers ──────────────────────────────────────────
  const addToast = useCallback(
    (message: string, type: ToastData['type'] = 'info') => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Clipboard paste handler ────────────────────────────────
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
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
          handleFileSelect(file);
          setShowUpload(true);
          break;
        }
      }
    },
    [handleFileSelect],
  );

  // Register / tear down the paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ── Lightbox nav ────────────────────────────────────────────
  const lightboxPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex > 0 ? lightboxIndex - 1 : items.length - 1);
      setLightboxMenuOpen(false);
    }
  };
  const lightboxNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex < items.length - 1 ? lightboxIndex + 1 : 0);
      setLightboxMenuOpen(false);
    }
  };

  // ── Input class ─────────────────────────────────────────────

  // ── Render ──────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.moodboard.title"
      descriptionKey="pages.moodboard.description"
    >
      {/* ── Action bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-end">

        {/* Category filter (multiselect) */}
        <div className="shrink-0">
          <NotionSelect
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(Array.isArray(v) ? v : v ? [v] : [])}
            options={categories}
            placeholder={t('moodboard.allCategories')}
            optionsI18nKey="moodboard.categories"
            multiple
            filterStyle
          />
        </div>

        {/* Add button + layout toggle */}
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => setGalleryColumns((prev) => (prev === 3 ? 4 : prev === 4 ? 5 : prev === 5 ? 6 : 3))}
            className="flex items-center justify-center size-9 shrink-0 bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 font-medium rounded-lg hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors"
            title={t('moodboard.layoutCycle')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('moodboard.addItem')}
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ImageIcon className="w-12 h-12 text-nokturo-600 mb-4" />
          <p className="text-nokturo-600 font-medium">{t('moodboard.noItems')}</p>
          <p className="text-nokturo-500 text-sm mt-1">{t('moodboard.addFirst')}</p>
        </div>
      ) : (
        /* Masonry grid – images only (Pinterest-style) */
        <div className={`columns-1 sm:columns-2 ${
          galleryColumns === 3 ? 'lg:columns-3' :
          galleryColumns === 4 ? 'lg:columns-4' :
          galleryColumns === 5 ? 'lg:columns-5' :
          'lg:columns-6'
        } gap-4 space-y-4`}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="break-inside-avoid group rounded-lg overflow-hidden cursor-pointer"
              onClick={() => setLightboxIndex(idx)}
            >
              <div className="relative">
                <img
                  src={item.image_url}
                  alt={item.title || 'Moodboard'}
                  className="w-full object-cover rounded-lg"
                  loading="lazy"
                />
                {/* Hover overlay – three-dot menu */}
                <div className="absolute inset-0 bg-nokturo-900/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-start justify-end p-2">
                  <div className="relative" data-card-menu>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardMenuOpen(cardMenuOpen === item.id ? null : item.id);
                      }}
                      className={`p-2 rounded transition-colors ${cardMenuOpen === item.id ? 'bg-white/30' : 'hover:bg-white/20'} text-white`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {cardMenuOpen === item.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[120px] z-20" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { openEdit(item); setCardMenuOpen(null); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          {t('common.edit')}
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => { setDeleteTarget(item.id); setCardMenuOpen(null); }}
                            className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Modal ────────────────────────────────────── */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={resetUpload}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">{t('moodboard.addItem')}</h3>
              <button
                onClick={resetUpload}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drop zone or URL - conditional, one disables the other */}
            {!uploadPreview ? (
              <>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg p-8 text-center cursor-pointer bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors"
                >
                  <Upload className="w-8 h-8 text-nokturo-500 dark:text-nokturo-400 mx-auto mb-2" />
                  <p className="text-nokturo-600 dark:text-nokturo-300 text-sm">{t('moodboard.dropOrClick')}</p>
                  <p className="text-nokturo-500 dark:text-nokturo-400 text-xs mt-1">
                    {t('moodboard.supportedFormats')}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>

                {/* URL input – below drop zone */}
                <div className="mt-3">
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nokturo-500 dark:text-nokturo-400" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        if (urlError) setUrlError('');
                      }}
                      onPaste={handleUrlPaste}
                      onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
                      placeholder={t('moodboard.urlPlaceholder')}
                      className={`${inputClass} pl-10 ${urlError ? 'ring-2 ring-red-400/50 focus:ring-red-400' : ''}`}
                    />
                    {urlLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nokturo-500 animate-spin" />
                    )}
                  </div>
                  {urlError && (
                    <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5 mt-2 space-y-1">
                      <div>{urlError}</div>
                      {urlError === t('moodboard.invalidUrl') && (
                        <div className="text-nokturo-500 dark:text-nokturo-400 text-xs">{t('moodboard.invalidUrlHint')}</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="w-full rounded-lg max-h-48 object-cover"
                  />
                </div>
                <button
                  onClick={clearImage}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/25 rounded-lg transition-colors w-full justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('moodboard.deleteImage')}
                </button>
              </div>
            )}

            {/* Form fields */}
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.title')}
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={t('moodboard.titlePlaceholder')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.notes')}
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder={t('moodboard.notesPlaceholder')}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.category')}
                </label>
                <NotionSelect
                  value={uploadCategories}
                  onChange={(v) => setUploadCategories(Array.isArray(v) ? v : v ? [v] : [])}
                  options={categories}
                  onOptionsChange={handleCategoriesChange}
                  placeholder="—"
                  optionsI18nKey="moodboard.categories"
                  multiple
                  canDelete={canDelete}
                />
              </div>

              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.commentAndTag')}
                </label>
                <textarea
                  value={uploadComment}
                  onChange={(e) => setUploadComment(e.target.value)}
                  placeholder={t('moodboard.tagUserPlaceholder')}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
                {uploadProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {uploadProfiles.map((p) => {
                      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || '?';
                      const selected = uploadTaggedUsers.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setUploadTaggedUsers((prev) =>
                              selected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            selected ? 'bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900' : 'bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-200 dark:hover:bg-nokturo-600'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {uploadError && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5 mt-3">
                {uploadError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={resetUpload}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpload}
                disabled={(!uploadFile && !urlLoadedBlob) || uploading}
                className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 font-medium rounded-lg hover:bg-nokturo-900/90 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? t('moodboard.uploading') : t('moodboard.upload')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeEdit}
        >
          <div
            className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">{t('moodboard.editItem')}</h3>
              <button
                onClick={closeEdit}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <img
                  src={editTarget.image_url}
                  alt={editTarget.title || 'Moodboard'}
                  className="w-full rounded-lg max-h-48 object-cover"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.title')}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('moodboard.titlePlaceholder')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.notes')}
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={t('moodboard.notesPlaceholder')}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-300 mb-1">
                  {t('moodboard.category')}
                </label>
                <NotionSelect
                  value={editCategories}
                  onChange={(v) => setEditCategories(Array.isArray(v) ? v : v ? [v] : [])}
                  options={categories}
                  onOptionsChange={handleCategoriesChange}
                  placeholder="—"
                  optionsI18nKey="moodboard.categories"
                  multiple
                  canDelete={canDelete}
                />
              </div>
            </div>

            {editError && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5 mt-3">
                {editError}
              </div>
            )}

            <div className="flex gap-3 justify-between items-center mt-4">
              <div>
                {canDelete && (
                  <button
                    onClick={() => {
                      setDeleteTarget(editTarget.id);
                      closeEdit();
                    }}
                    className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={closeEdit}
                  className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={editSaving}
                  className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 font-medium rounded-lg hover:bg-nokturo-900/90 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editSaving ? t('moodboard.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox: photo (left) | modal info + comments (right) ───── */}
      {lightboxIndex !== null && items[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col lg:flex-row"
          onClick={() => setLightboxIndex(null)}
        >
          {/* 1. Photo area (left) */}
          <div className="flex-1 relative flex items-center justify-center min-w-0 p-4 min-h-0 order-1">
            {items.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    lightboxPrev();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    lightboxNext();
                  }}
                  className="absolute right-4 lg:right-[calc(320px+1rem)] xl:right-[calc(384px+1rem)] top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            {/\.svg(\?|$)/i.test(items[lightboxIndex].image_url) ? (
              <img
                src={items[lightboxIndex].image_url}
                alt={items[lightboxIndex].title || 'Moodboard'}
                width={400}
                height={400}
                className="max-w-full max-h-[50vh] lg:max-h-[90vh] object-contain rounded-lg aspect-square shrink-0"
                style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
                loading="eager"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={items[lightboxIndex].image_url}
                alt={items[lightboxIndex].title || 'Moodboard'}
                className="max-w-full max-h-[50vh] lg:max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(null);
              }}
              className="absolute top-4 left-4 p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <button
                  onClick={() => setLightboxMenuOpen((p) => !p)}
                  className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {lightboxMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[120px] z-20">
                    <button
                      onClick={() => {
                        openEdit(items[lightboxIndex]);
                        setLightboxIndex(null);
                        setLightboxMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('common.edit')}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          setDeleteTarget(items[lightboxIndex].id);
                          setLightboxIndex(null);
                          setLightboxMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Modal: info + comments (right) */}
          <div
            className="w-full lg:w-80 xl:w-96 bg-white dark:bg-nokturo-800 flex flex-col overflow-hidden shrink-0 max-h-[40vh] lg:max-h-none order-2"
            onClick={(e) => e.stopPropagation()}
          >
            {(items[lightboxIndex].title || items[lightboxIndex].notes || (items[lightboxIndex].categories && items[lightboxIndex].categories.length > 0)) && (
              <div className="px-4 pt-3 pb-2 shrink-0 space-y-0.5">
                {items[lightboxIndex].title && (
                  <p className="text-nokturo-900 dark:text-nokturo-100 font-medium text-sm truncate">
                    {items[lightboxIndex].title}
                  </p>
                )}
                {items[lightboxIndex].notes && (
                  <p className="text-nokturo-600 dark:text-nokturo-400 text-xs leading-relaxed whitespace-pre-wrap mb-2">
                    {items[lightboxIndex].notes}
                  </p>
                )}
                {items[lightboxIndex].categories && items[lightboxIndex].categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {items[lightboxIndex].categories!.map((cat) => {
                      const catOption = categories.find((c) => c.name === cat);
                      const colorClass = TAG_COLORS[catOption?.color ?? 'gray'] ?? TAG_COLORS.gray;
                      return (
                        <span
                          key={cat}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${colorClass}`}
                        >
                          {t(`moodboard.categories.${cat}`) !== `moodboard.categories.${cat}`
                            ? t(`moodboard.categories.${cat}`)
                            : cat}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col px-4 pb-4">
              <MoodboardComments
                moodboardItemId={items[lightboxIndex].id}
                hasHeaderAbove={!!(items[lightboxIndex].title || items[lightboxIndex].notes || (items[lightboxIndex].categories && items[lightboxIndex].categories.length > 0))}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">
              {t('moodboard.deleteConfirm')}
            </p>
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

      {/* ── Toasts ───────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </PageShell>
  );
}
