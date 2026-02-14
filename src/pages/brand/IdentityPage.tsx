import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getUserIdForDb } from '../../stores/authStore';
import { PageShell } from '../../components/PageShell';
import { RichTextBlockEditor, type RichTextBlock } from '../../components/RichTextBlockEditor';
import { RichTextBlockViewer, getDefaultTocItems } from '../../components/RichTextBlockViewer';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { Loader2, Eye, Pencil, MoreVertical, Save } from 'lucide-react';

const DOC_ID = '00000000-0000-0000-0000-000000000002';

export default function IdentityPage() {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<RichTextBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [pageMenuOpen, setPageMenuOpen] = useState(false);

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
          {mode === 'view' && (
            <div className="flex justify-end mb-4">
              <div className="relative">
                <button
                  onClick={() => setPageMenuOpen((p) => !p)}
                  className="p-2 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {pageMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPageMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                      <button
                        onClick={() => { setMode('edit'); setPageMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('richText.editMode')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {mode === 'view' ? (
            <RichTextBlockViewer
              blocks={blocks}
              tocTitle={t('pages.identity.title')}
              defaultTocItems={getDefaultTocItems(t)}
            />
          ) : (
            <RichTextBlockEditor
              value={blocks}
              onChange={setBlocks}
              onUploadImage={handleUploadImage}
              onToast={addToast}
            />
          )}
          {mode === 'edit' && (
            <div className="fixed bottom-6 right-6 flex items-center gap-2 z-40">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-nokturo-800 dark:bg-white dark:text-nokturo-900 text-white rounded-lg hover:bg-nokturo-900 dark:hover:bg-nokturo-100 disabled:opacity-60 shadow-sm"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setMode('view')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-transparent border border-nokturo-300 dark:border-nokturo-600 text-nokturo-700 dark:text-nokturo-300 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-800 hover:border-nokturo-400 dark:hover:border-nokturo-500 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {t('richText.viewMode')}
              </button>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
