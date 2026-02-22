import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getUserIdForDb } from '../../stores/authStore';
import { PageShell } from '../../components/PageShell';
import { RichTextBlockEditor, type RichTextBlock } from '../../components/RichTextBlockEditor';
import { RichTextBlockViewer, getDefaultTocItems } from '../../components/RichTextBlockViewer';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { Loader2, Pencil, Save } from 'lucide-react';

const DOC_ID = '00000000-0000-0000-0000-000000000002';

export default function IdentityPage() {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<RichTextBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const fetchContent = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_identity_content')
      .select('content')
      .eq('id', DOC_ID)
      .maybeSingle();

    if (!error && data?.content) {
      try {
        const parsed = Array.isArray(data.content) ? data.content : [];
        setBlocks(parsed);
      } catch {
        setBlocks([]);
      }
    } else {
      setBlocks([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from('brand_identity_content')
      .upsert(
        {
          id: DOC_ID,
          content: blocks,
          updated_by: getUserIdForDb(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    setSaving(false);
    if (error) {
      setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
    } else {
      setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'success', message: t('common.saved') }]);
      setMode('view');
    }
  }, [blocks, t]);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `brand-identity/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'image/png';
    const { error } = await supabase.storage.from('uploads').upload(filePath, arrayBuffer, { contentType, cacheControl: '3600' });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
    return data.publicUrl;
  }, []);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, { ...toast, id: toast.id || crypto.randomUUID() }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <PageShell
      titleKey="pages.identity.title"
      descriptionKey="pages.identity.description"
    >
      <ToastContainer toasts={toasts} onClose={removeToast} position="left" />
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-nokturo-500" />
        </div>
      ) : (
        <div className={mode === 'view' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}>
          {mode === 'view' ? (
            <RichTextBlockViewer
              blocks={blocks}
              tocTitle={t('pages.identity.title')}
              defaultTocItems={getDefaultTocItems(t)}
              headingFont="body"
            />
          ) : (
            <RichTextBlockEditor
              value={blocks}
              onChange={setBlocks}
              onUploadImage={handleUploadImage}
              onToast={addToast}
              headingFont="body"
            />
          )}
          <div className="fixed bottom-6 right-6 z-40">
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-nokturo-800 dark:bg-white dark:text-nokturo-900 text-white rounded-lg hover:bg-nokturo-900 dark:hover:bg-nokturo-100 disabled:opacity-60 shadow-sm"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t('common.save')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-nokturo-800 dark:bg-white dark:text-nokturo-900 text-white rounded-lg hover:bg-nokturo-900 dark:hover:bg-nokturo-100 shadow-sm"
              >
                <Pencil size={16} />
                {t('common.edit')}
              </button>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
