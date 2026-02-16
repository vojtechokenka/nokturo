import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
  GripVertical,
  Images,
  Bell,
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
interface MoodboardSubImage {
  id: string;
  image_url: string;
  sort_order: number;
}

interface MoodboardItem {
  id: string;
  title: string | null;
  image_url: string;
  categories: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  sub_images: MoodboardSubImage[];
}

interface UploadImage {
  id: string;
  file: File | null;
  blob: Blob | null;
  preview: string;
}

// ── Component ─────────────────────────────────────────────────
export default function MoodboardPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  // ── State ───────────────────────────────────────────────────
  const [items, setItems] = useState<MoodboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Stable sort key: only updated on fetch, not on mark-as-read, so posts don't jump
  const [sortUnreadIds, setSortUnreadIds] = useState<Set<string>>(new Set());
  // Track items marked as read to prevent race with fetchUnreadCounts
  const recentlyReadRef = useRef<Set<string>>(new Set());

  // Filter (multiselect: show items that have ANY of selected categories)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadImages, setUploadImages] = useState<UploadImage[]>([]);
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
  const [dragImgIdx, setDragImgIdx] = useState<number | null>(null);
  const dragImgIdxRef = useRef<number | null>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxSubIndex, setLightboxSubIndex] = useState(0);
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

  // (lightboxSubIndex is managed explicitly in navigation handlers)

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
      .select('*, moodboard_item_images(id, image_url, sort_order)')
      .order('created_at', { ascending: false });

    if (categoryFilter.length > 0) {
      query = query.overlaps('categories', categoryFilter);
    }

    let { data, error } = await query;

    // Fallback: if moodboard_item_images table doesn't exist yet, query without join
    if (error) {
      let fallbackQuery = supabase
        .from('moodboard_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (categoryFilter.length > 0) {
        fallbackQuery = fallbackQuery.overlaps('categories', categoryFilter);
      }
      const fallback = await fallbackQuery;
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      setItems(
        (data as any[]).map((row) => ({
          ...row,
          categories: Array.isArray(row.categories) ? row.categories : [],
          sub_images: Array.isArray(row.moodboard_item_images)
            ? (row.moodboard_item_images as MoodboardSubImage[]).sort((a, b) => a.sort_order - b.sort_order)
            : [],
        })) as MoodboardItem[]
      );
    }
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Fetch unread comment counts for all moodboard items
  const fetchUnreadCounts = useCallback(async () => {
    const userId = getUserIdForDb();
    if (!userId) return;
    try {
      const { data: comments } = await supabase
        .from('moodboard_comments')
        .select('moodboard_item_id, created_at')
        .neq('author_id', userId);
      const { data: reads } = await supabase
        .from('moodboard_comment_reads')
        .select('moodboard_item_id, last_read_at')
        .eq('user_id', userId);
      if (!comments) return;
      const readMap = new Map(
        (reads || []).map((r: { moodboard_item_id: string; last_read_at: string }) => [
          r.moodboard_item_id,
          new Date(r.last_read_at),
        ])
      );
      const counts: Record<string, number> = {};
      for (const c of comments as { moodboard_item_id: string; created_at: string }[]) {
        const readAt = readMap.get(c.moodboard_item_id);
        if (!readAt || new Date(c.created_at) > readAt) {
          counts[c.moodboard_item_id] = (counts[c.moodboard_item_id] || 0) + 1;
        }
      }
      // Exclude items the user just marked as read (prevents race condition)
      for (const id of recentlyReadRef.current) {
        delete counts[id];
      }
      setUnreadCounts(counts);
      setSortUnreadIds(new Set(Object.keys(counts).filter((id) => counts[id] > 0)));
    } catch {
      // Silently fail if moodboard_comment_reads table doesn't exist yet
    }
  }, []);

  useEffect(() => {
    if (!loading && items.length > 0) fetchUnreadCounts();
  }, [loading, items.length, fetchUnreadCounts]);

  // Mark moodboard item comments as read when lightbox opens
  const markItemAsRead = useCallback(async (itemId: string) => {
    const userId = getUserIdForDb();
    if (!userId) return;
    // Track to prevent fetchUnreadCounts from re-adding this item
    recentlyReadRef.current.add(itemId);
    // Optimistically remove bell icon (but keep sort position stable via sortUnreadIds)
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    try {
      await supabase.from('moodboard_comment_reads').upsert(
        { user_id: userId, moodboard_item_id: itemId, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,moodboard_item_id' }
      );
    } catch {
      // Silently fail if table doesn't exist yet
    }
  }, []);

  // Sorted items: unread first (uses stable sortUnreadIds so posts don't jump when marked as read)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aUnread = sortUnreadIds.has(a.id);
      const bUnread = sortUnreadIds.has(b.id);
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      return 0;
    });
  }, [items, sortUnreadIds]);

  // Auto-open lightbox when navigating from a notification with ?item=<id>
  useEffect(() => {
    if (loading || items.length === 0) return;
    const itemId = searchParams.get('item');
    if (itemId) {
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        setLightboxIndex(idx);
        setLightboxSubIndex(0);
        markItemAsRead(itemId);
      }
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('item');
      setSearchParams(newParams, { replace: true });
    }
  }, [items, loading, searchParams, setSearchParams, markItemAsRead]);

  // Listen for same-page notification clicks (custom event from Sidebar)
  useEffect(() => {
    if (loading || items.length === 0) return;
    const handler = (e: Event) => {
      const itemId = (e as CustomEvent).detail?.itemId;
      if (!itemId) return;
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        setLightboxIndex(idx);
        setLightboxSubIndex(0);
        markItemAsRead(itemId);
      }
    };
    window.addEventListener('open-moodboard-item', handler);
    return () => window.removeEventListener('open-moodboard-item', handler);
  }, [items, loading, markItemAsRead]);

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
  const addFilesToUpload = useCallback((files: File[]) => {
    const newImages: UploadImage[] = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) continue;
      newImages.push({
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        file,
        blob: null,
        preview: URL.createObjectURL(file),
      });
    }
    if (newImages.length > 0) {
      setUploadImages((prev) => [...prev, ...newImages]);
      setUploadError('');
    }
  }, []);

  const removeUploadImage = useCallback((id: string) => {
    setUploadImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img && img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Skip if this is an internal reorder drag (not an external file drop)
    if (dragImgIdxRef.current !== null) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) addFilesToUpload(files);
  };

  const resetUpload = () => {
    setShowUpload(false);
    uploadImages.forEach((img) => {
      if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
    });
    setUploadImages([]);
    setUrlInput('');
    setUploadTitle('');
    setUploadCategories([]);
    setUploadNotes('');
    setUploadComment('');
    setUploadTaggedUsers([]);
    setUploadError('');
    setUrlError('');
    setDragImgIdx(null);
  };

  // Drag-reorder helpers for upload thumbnails (ref for synchronous index tracking)
  const handleImgDragStart = (idx: number) => {
    dragImgIdxRef.current = idx;
    setDragImgIdx(idx);
  };
  const handleImgDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const fromIdx = dragImgIdxRef.current;
    if (fromIdx === null || fromIdx === idx) return;
    dragImgIdxRef.current = idx;
    setDragImgIdx(idx);
    setUploadImages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
  };
  const handleImgDragEnd = () => {
    dragImgIdxRef.current = null;
    setDragImgIdx(null);
  };

  // ── URL paste handler ───────────────────────────────────────
  const handleUrlPaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text').trim();
    if (pastedText) {
      setUrlInput(pastedText);
      handleUrlLoad(pastedText);
    }
  };

  // ── Load image from URL (adds to gallery) ───────────────────────
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
      const preview = URL.createObjectURL(blob);
      setUploadImages((prev) => [...prev, {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        file: null,
        blob,
        preview,
      }]);
      setUrlInput('');
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
    if (uploadImages.length === 0) return;
    setUploading(true);
    setUploadError('');

    try {
      // Upload all images sequentially to storage
      const uploadedUrls: string[] = [];
      for (const img of uploadImages) {
        const fileToUpload = img.file || (img.blob ? new File([img.blob], `image-${Date.now()}-${Math.random().toString(36).slice(2)}.png`, { type: img.blob.type }) : null);
        if (!fileToUpload) continue;

        const ext = fileToUpload.name.split('.').pop() || 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = `moodboard/${fileName}`;

        const arrayBuffer = await fileToUpload.arrayBuffer();
        const contentType = fileToUpload.type || 'image/png';
        const { error: storageError } = await supabase.storage
          .from('uploads')
          .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600' });

        if (storageError) throw new Error(storageError.message);

        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }

      if (uploadedUrls.length === 0) {
        setUploading(false);
        return;
      }

      // Insert moodboard_items with the first (cover) image
      const { data: insertedItem, error: insertError } = await supabase
        .from('moodboard_items')
        .insert({
          title: uploadTitle || null,
          image_url: uploadedUrls[0],
          categories: uploadCategories.length > 0 ? uploadCategories : [],
          notes: uploadNotes || null,
          created_by: getUserIdForDb(),
        })
        .select('id')
        .single();

      if (insertError) throw new Error(insertError.message);

      // Insert sub-images (additional images beyond the first)
      if (uploadedUrls.length > 1 && insertedItem) {
        const subImages = uploadedUrls.slice(1).map((url, idx) => ({
          moodboard_item_id: insertedItem.id,
          image_url: url,
          sort_order: idx,
        }));
        const { error: subError } = await supabase
          .from('moodboard_item_images')
          .insert(subImages);
        if (subError) throw new Error(subError.message);
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
              link: `/prototyping/moodboard?item=${insertedItem.id}`,
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
          addFilesToUpload([file]);
          setShowUpload(true);
          break;
        }
      }
    },
    [addFilesToUpload],
  );

  // Register / tear down the paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ── Lightbox nav (gallery-aware) ─────────────────────────────
  const getItemGallery = useCallback((item: MoodboardItem): string[] => {
    const urls = [item.image_url];
    if (item.sub_images && item.sub_images.length > 0) {
      urls.push(...item.sub_images.map((si) => si.image_url));
    }
    return urls;
  }, []);

  const lightboxPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    if (lightboxSubIndex > 0) {
      setLightboxSubIndex(lightboxSubIndex - 1);
    } else {
      const prevIdx = lightboxIndex > 0 ? lightboxIndex - 1 : items.length - 1;
      const prevItem = items[prevIdx];
      const prevGalleryLen = 1 + (prevItem?.sub_images?.length || 0);
      setLightboxIndex(prevIdx);
      setLightboxSubIndex(prevGalleryLen - 1);
    }
    setLightboxMenuOpen(false);
  }, [lightboxIndex, lightboxSubIndex, items]);

  const lightboxNext = useCallback(() => {
    if (lightboxIndex === null) return;
    const currentItem = items[lightboxIndex];
    const galleryLen = 1 + (currentItem?.sub_images?.length || 0);
    if (lightboxSubIndex < galleryLen - 1) {
      setLightboxSubIndex(lightboxSubIndex + 1);
    } else {
      const nextIdx = lightboxIndex < items.length - 1 ? lightboxIndex + 1 : 0;
      setLightboxIndex(nextIdx);
      setLightboxSubIndex(0);
    }
    setLightboxMenuOpen(false);
  }, [lightboxIndex, lightboxSubIndex, items]);

  // Keyboard: ESC, Left, Right
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightboxIndex(null); }
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, lightboxPrev, lightboxNext]);

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
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="break-inside-avoid group relative ml-4 cursor-pointer"
              onClick={() => { const origIdx = items.findIndex((i) => i.id === item.id); setLightboxIndex(origIdx); setLightboxSubIndex(0); markItemAsRead(item.id); }}
            >
              {/* Unread comments indicator – left of image */}
              {unreadCounts[item.id] > 0 && (
                <div className="absolute -left-3.5 top-3 z-10">
                  <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-lg ring-2 ring-white dark:ring-nokturo-800">
                    <Bell className="h-3.5 w-3.5 text-white" />
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                  </div>
                </div>
              )}
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.title || 'Moodboard'}
                  className="w-full object-cover rounded-lg"
                  loading="lazy"
                />
                {/* Multi-image badge */}
                {item.sub_images && item.sub_images.length > 0 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded z-[1]">
                    <Images className="w-3 h-3" />
                    <span>{1 + item.sub_images.length}</span>
                  </div>
                )}
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

            {/* Hidden multi-file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) addFilesToUpload(files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            {/* Drop zone / thumbnails */}
            {uploadImages.length === 0 ? (
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
              <div className="space-y-3 mb-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {/* Reorderable thumbnails grid */}
                <div className="grid grid-cols-4 gap-2">
                  {uploadImages.map((img, idx) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={() => handleImgDragStart(idx)}
                      onDragOver={(e) => handleImgDragOver(e, idx)}
                      onDragEnd={handleImgDragEnd}
                      className={`relative group rounded-lg overflow-hidden cursor-grab active:cursor-grabbing ${
                        idx === 0 ? 'ring-2 ring-blue-400' : ''
                      } ${dragImgIdx === idx ? 'opacity-40' : ''}`}
                    >
                      <img src={img.preview} alt="" className="w-full aspect-square object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium leading-tight">
                          Cover
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeUploadImage(img.id); }}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 text-white/50 pointer-events-none">
                        <GripVertical className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add more + URL input */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-300 hover:bg-nokturo-200 dark:hover:bg-nokturo-600 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {t('moodboard.addMoreImages')}
                  </button>
                </div>

                {/* URL input for adding more via URL */}
                <div>
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
                disabled={uploadImages.length === 0 || uploading}
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
      {lightboxIndex !== null && items[lightboxIndex] && (() => {
        const lbItem = items[lightboxIndex];
        const lbGallery = getItemGallery(lbItem);
        const lbImageUrl = lbGallery[lightboxSubIndex] || lbItem.image_url;
        const totalImages = items.reduce((acc, it) => acc + 1 + (it.sub_images?.length || 0), 0);
        return (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col lg:flex-row"
          onClick={() => setLightboxIndex(null)}
        >
          {/* 1. Photo area (left) */}
          <div className="flex-1 relative flex items-center justify-center min-w-0 p-4 min-h-0 order-1">
            {totalImages > 1 && (
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            {/\.svg(\?|$)/i.test(lbImageUrl) ? (
              <img
                src={lbImageUrl}
                alt={lbItem.title || 'Moodboard'}
                width={400}
                height={400}
                className="max-w-full max-h-[50vh] lg:max-h-[85vh] object-contain rounded-lg aspect-square shrink-0"
                style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
                loading="eager"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={lbImageUrl}
                alt={lbItem.title || 'Moodboard'}
                className="max-w-full max-h-[50vh] lg:max-h-[85vh] w-auto h-auto object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* Mini-gallery thumbnails */}
            {lbGallery.length > 1 && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/60 rounded-lg p-1.5 z-10 max-w-[80%] overflow-x-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {lbGallery.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxSubIndex(idx)}
                    className={`w-10 h-10 rounded overflow-hidden border-2 transition-all shrink-0 ${
                      idx === lightboxSubIndex
                        ? 'border-white scale-110'
                        : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
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
                        openEdit(lbItem);
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
                          setDeleteTarget(lbItem.id);
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
            {(lbItem.title || lbItem.notes || (lbItem.categories && lbItem.categories.length > 0)) && (
              <div className="px-4 pt-3 pb-2 shrink-0 space-y-0.5">
                {lbItem.title && (
                  <p className="text-nokturo-900 dark:text-nokturo-100 font-medium text-sm truncate">
                    {lbItem.title}
                  </p>
                )}
                {lbItem.notes && (
                  <p className="text-nokturo-600 dark:text-nokturo-400 text-xs leading-relaxed whitespace-pre-wrap mb-2">
                    {lbItem.notes}
                  </p>
                )}
                {lbItem.categories && lbItem.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {lbItem.categories!.map((cat) => {
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
                moodboardItemId={lbItem.id}
                hasHeaderAbove={!!(lbItem.title || lbItem.notes || (lbItem.categories && lbItem.categories.length > 0))}
              />
            </div>
          </div>
        </div>
        );
      })()}

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
