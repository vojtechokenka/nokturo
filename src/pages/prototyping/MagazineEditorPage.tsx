import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getUserIdForDb } from '../../stores/authStore';
import { PageShell } from '../../components/PageShell';
import { RichTextBlockEditor, type RichTextBlock } from '../../components/RichTextBlockEditor';
import { PageStructurePanel } from '../../components/PageStructurePanel';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { INPUT_CLASS } from '../../lib/inputStyles';
import {
  ArrowLeft,
  Loader2,
  Upload,
} from 'lucide-react';
import { SaveIcon } from '../../components/icons/SaveIcon';

export default function MagazineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isNew = !id;

  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<RichTextBlock[]>(() =>
    !id ? [{ id: crypto.randomUUID(), type: 'paragraph', size: 'normal', content: '' }] : []
  );
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    supabase
      .from('magazine_articles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setTitle(data.title ?? '');
          setThumbnailUrl(data.thumbnail_url ?? null);
          const content = data.content;
          setBlocks(Array.isArray(content) ? content : []);
        }
        setLoading(false);
      });
  }, [id, isNew]);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `magazine/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || (ext.toLowerCase() === 'svg' ? 'image/svg+xml' : 'image/png');
    const { error } = await supabase.storage
      .from('uploads')
      .upload(fileName, arrayBuffer, { contentType, cacheControl: '3600' });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
    return data.publicUrl;
  }, []);

  const handleThumbnailUpload = async (file: File) => {
    try {
      const url = await handleUploadImage(file);
      setThumbnailUrl(url);
    } catch (err) {
      addToast({
        id: crypto.randomUUID(),
        type: 'error',
        message: (err as Error).message,
      });
    }
  };

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, { ...toast, id: toast.id || crypto.randomUUID() }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      addToast({
        id: crypto.randomUUID(),
        type: 'error',
        message: t('magazine.titleRequired'),
      });
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      thumbnail_url: thumbnailUrl,
      content: blocks,
      updated_at: new Date().toISOString(),
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('magazine_articles')
        .insert({
          ...payload,
          created_by: getUserIdForDb(),
        })
        .select('id')
        .single();

      setSaving(false);
      if (error) {
        addToast({ id: crypto.randomUUID(), type: 'error', message: error.message });
      } else if (data) {
        addToast({ id: crypto.randomUUID(), type: 'success', message: t('common.saved') });
        navigate(`/prototyping/magazine/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase
        .from('magazine_articles')
        .update(payload)
        .eq('id', id);

      setSaving(false);
      if (error) {
        addToast({ id: crypto.randomUUID(), type: 'error', message: error.message });
      } else {
        addToast({ id: crypto.randomUUID(), type: 'success', message: t('common.saved') });
        navigate(`/prototyping/magazine/${id}`, { replace: true });
      }
    }
  }, [id, isNew, title, thumbnailUrl, blocks, t, navigate, addToast]);

  if (loading) {
    return (
      <PageShell titleKey="pages.magazine.title" descriptionKey="pages.magazine.description">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-nokturo-500" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      titleKey="pages.magazine.title"
      descriptionKey="pages.magazine.description"
      actionsSlot={
        <div className="flex items-center justify-between gap-4 w-full">
          <button
            onClick={() => navigate('/prototyping/magazine')}
            className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-[6px] bg-nokturo-700 text-white hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <SaveIcon size={16} />
            )}
            {t('common.save')}
          </button>
        </div>
      }
    >
      <ToastContainer toasts={toasts} onClose={removeToast} position="left" />

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full max-w-6xl">
        <div className="min-w-0 flex-1 max-w-3xl space-y-6">
          {/* Thumbnail */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('magazine.thumbnail')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleThumbnailUpload(f);
                e.target.value = '';
              }}
            />
            {thumbnailUrl ? (
              <div className="relative w-full">
                <div className="content-panel relative w-full aspect-video overflow-hidden bg-nokturo-100 dark:bg-nokturo-700">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full block group"
                  >
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  </button>
                  <div className="absolute bottom-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="px-2 py-1 text-xs text-white bg-black/60 hover:bg-black/80 rounded transition-colors"
                    >
                      {t('magazine.replaceThumbnail')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setThumbnailUrl(null); }}
                      className="px-2 py-1 text-xs text-white bg-red-500/90 hover:bg-red-600 rounded transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === 'Enter' && fileInputRef.current?.click()
                }
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 h-20 px-3 py-2 rounded-[6px] text-nokturo-500 dark:text-nokturo-400 border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 bg-transparent hover:border-nokturo-400 dark:hover:border-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors text-sm w-full justify-center cursor-pointer"
              >
                <Upload className="w-4 h-4 shrink-0" />
                {t('magazine.uploadThumbnail')}
              </div>
            )}
          </div>

          {/* Title (H1) */}
          <div>
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
              rows={1}
              placeholder={t('magazine.titlePlaceholder')}
              className="w-full bg-transparent border-0 px-0 py-3 text-[32px] sm:text-[40px] font-headline font-extralight text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500 focus:outline-none transition-colors resize-none overflow-hidden leading-[1.2]"
            />
          </div>

          {/* Rich text editor */}
          <RichTextBlockEditor
            value={blocks}
            onChange={setBlocks}
            onUploadImage={handleUploadImage}
            onToast={addToast}
          />
        </div>

        {/* Structure panel – always visible with placeholder to avoid layout jump */}
        <PageStructurePanel
          blocks={blocks}
          onChange={setBlocks}
          inline
          className="hidden lg:flex"
        />
      </div>
    </PageShell>
  );
}
