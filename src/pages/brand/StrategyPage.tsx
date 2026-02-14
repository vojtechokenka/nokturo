import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getUserIdForDb } from '../../stores/authStore';
import { PageShell } from '../../components/PageShell';
import { RichTextBlockEditor, type RichTextBlock } from '../../components/RichTextBlockEditor';
import { RichTextBlockViewer, getDefaultTocItems } from '../../components/RichTextBlockViewer';
import { PageStructurePanel } from '../../components/PageStructurePanel';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { Loader2, Eye, Pencil } from 'lucide-react';

const DEFAULT_TITLE = 'Strategie značky';

export default function StrategyPage() {
  const { t } = useTranslation();
  const [docId, setDocId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<RichTextBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const fetchContent = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_strategy')
      .select('id, content')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setDocId(data.id);
      try {
        const c = data.content;
        const parsed = Array.isArray(c) ? c : [];
        setBlocks(parsed);
      } catch {
        setBlocks([]);
      }
    } else {
      setDocId(null);
      setBlocks([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const payload = {
      title: DEFAULT_TITLE,
      content: blocks,
      created_by: getUserIdForDb(),
      updated_at: new Date().toISOString(),
    };

    if (docId) {
      const { error } = await supabase
        .from('brand_strategy')
        .update({ content: payload.content, updated_at: payload.updated_at })
        .eq('id', docId);
      setSaving(false);
      if (error) {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
      } else {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'success', message: t('common.saved') }]);
      }
    } else {
      const { data, error } = await supabase
        .from('brand_strategy')
        .insert({ ...payload, content: blocks })
        .select('id')
        .single();
      setSaving(false);
      if (error) {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
      } else if (data) {
        setDocId(data.id);
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'success', message: t('common.saved') }]);
      }
    }
  }, [docId, blocks, t]);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `brand-strategy/${fileName}`;

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
      titleKey="pages.strategy.title"
      descriptionKey="pages.strategy.description"
    >
      <ToastContainer toasts={toasts} onClose={removeToast} position="left" />
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-nokturo-500" />
        </div>
      ) : (
        <div className={mode === 'view' ? 'max-w-5xl mx-auto' : 'flex gap-8 w-full max-w-6xl'}>
          {mode === 'view' ? (
            <RichTextBlockViewer
              blocks={blocks}
              tocTitle={t('pages.strategy.title')}
              defaultTocItems={getDefaultTocItems(t)}
            />
          ) : (
            <>
              <div className="min-w-0 flex-1 max-w-3xl">
                <RichTextBlockEditor
                  value={blocks}
                  onChange={setBlocks}
                  onUploadImage={handleUploadImage}
                  onToast={addToast}
                />
              </div>
              <PageStructurePanel
                blocks={blocks}
                onChange={setBlocks}
                className="hidden lg:block"
              />
            </>
          )}
          {/* Fixed: Save + View buttons vedle sebe vpravo dole */}
          <div className="fixed bottom-6 right-6 flex items-center gap-2 z-40">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-nokturo-800 dark:bg-white dark:text-nokturo-900 text-white rounded-lg hover:bg-nokturo-900 dark:hover:bg-nokturo-100 disabled:opacity-60 shadow-sm"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {t('common.save')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-transparent border border-nokturo-300 dark:border-nokturo-600 text-nokturo-700 dark:text-nokturo-300 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-800 hover:border-nokturo-400 dark:hover:border-nokturo-500 transition-colors"
            >
              {mode === 'view' ? (
                <>
                  <Pencil size={16} />
                  {t('richText.editMode')}
                </>
              ) : (
                <>
                  <Eye size={16} />
                  {t('richText.viewMode')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
