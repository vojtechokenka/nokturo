import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getUserIdForDb } from '../../stores/authStore';
import { PageShell } from '../../components/PageShell';
import { PageHeaderImage } from '../../components/PageHeaderImage';
import { RichTextBlockEditor, type RichTextBlock } from '../../components/RichTextBlockEditor';
import { RichTextBlockViewer, getDefaultTocItems } from '../../components/RichTextBlockViewer';
import { PageStructurePanel } from '../../components/PageStructurePanel';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { Loader2, Pencil, Save } from 'lucide-react';

const DEFAULT_TITLE = 'Strategie značky';

interface DocContent {
  blocks: RichTextBlock[];
  headerImage?: string | null;
}

function parseContent(raw: unknown): DocContent {
  if (Array.isArray(raw)) return { blocks: raw, headerImage: null };
  if (raw && typeof raw === 'object' && 'blocks' in raw) {
    const obj = raw as Record<string, unknown>;
    return {
      blocks: Array.isArray(obj.blocks) ? obj.blocks as RichTextBlock[] : [],
      headerImage: typeof obj.headerImage === 'string' ? obj.headerImage : null,
    };
  }
  return { blocks: [], headerImage: null };
}

export default function StrategyPage() {
  const { t } = useTranslation();
  const [docId, setDocId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<RichTextBlock[]>([]);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const docIdRef = useRef(docId);
  docIdRef.current = docId;

  const fetchContent = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_strategy')
      .select('id, content')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setDocId(data.id);
      const parsed = parseContent(data.content);
      setBlocks(parsed.blocks);
      setHeaderImage(parsed.headerImage);
    } else {
      setDocId(null);
      setBlocks([]);
      setHeaderImage(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const content: DocContent = { blocks, headerImage };

    if (docId) {
      const { error } = await supabase
        .from('brand_strategy')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', docId);
      setSaving(false);
      if (error) {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
      } else {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'success', message: t('common.saved') }]);
        setMode('view');
      }
    } else {
      const { data, error } = await supabase
        .from('brand_strategy')
        .insert({ title: DEFAULT_TITLE, content, created_by: getUserIdForDb(), updated_at: new Date().toISOString() })
        .select('id')
        .single();
      setSaving(false);
      if (error) {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
      } else if (data) {
        setDocId(data.id);
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'success', message: t('common.saved') }]);
        setMode('view');
      }
    }
  }, [docId, blocks, headerImage, t]);

  const handleHeaderImageChange = useCallback(async (url: string | null) => {
    setHeaderImage(url);
    const content: DocContent = { blocks: blocksRef.current, headerImage: url };
    const id = docIdRef.current;

    if (id) {
      const { error } = await supabase
        .from('brand_strategy')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
      }
    } else {
      const { data, error } = await supabase
        .from('brand_strategy')
        .insert({ title: DEFAULT_TITLE, content, created_by: getUserIdForDb(), updated_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', message: error.message }]);
      } else if (data) {
        setDocId(data.id);
      }
    }
  }, []);

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
      headerSlot={
        <PageHeaderImage
          imageUrl={headerImage}
          onUpload={handleUploadImage}
          onChange={handleHeaderImageChange}
        />
      }
    >
      <ToastContainer toasts={toasts} onClose={removeToast} position="left" />
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-nokturo-500" />
        </div>
      ) : (
        <div className={mode === 'view' ? 'max-w-5xl mx-auto' : 'flex flex-col lg:flex-row gap-4 lg:gap-8 w-full max-w-6xl'}>
          {mode === 'view' ? (
            <RichTextBlockViewer
              blocks={blocks}
              tocTitle={t('pages.strategy.title')}
              defaultTocItems={getDefaultTocItems(t)}
              headingFont="headline"
            />
          ) : (
            <>
              <div className="min-w-0 flex-1 max-w-3xl">
                <RichTextBlockEditor
                  value={blocks}
                  onChange={setBlocks}
                  onUploadImage={handleUploadImage}
                  onToast={addToast}
                  headingFont="headline"
                />
              </div>
              <PageStructurePanel
                blocks={blocks}
                onChange={setBlocks}
                className="hidden lg:block"
              />
            </>
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
