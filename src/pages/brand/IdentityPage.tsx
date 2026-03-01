import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { hasFeaturePermission } from '../../utils/permissions';
import { PageShell } from '../../components/PageShell';
import { PageHeaderImage } from '../../components/PageHeaderImage';
import { RichTextBlockEditor, type RichTextBlock } from '../../components/RichTextBlockEditor';
import { RichTextBlockViewer, getDefaultTocItems } from '../../components/RichTextBlockViewer';
import { PageStructurePanel } from '../../components/PageStructurePanel';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { Loader2 } from 'lucide-react';
import { EditIcon } from '../../components/icons/EditIcon';
import { SaveIcon } from '../../components/icons/SaveIcon';

const DOC_ID = '00000000-0000-0000-0000-000000000002';

interface DocContent {
  blocks: RichTextBlock[];
  headerImage?: string | null;
}

function parseContent(raw: unknown): DocContent {
  if (Array.isArray(raw)) return { blocks: raw, headerImage: null };
  if (raw && typeof raw === 'object' && 'blocks' in raw) {
    const obj = raw as Record<string, unknown>;
    return {
      blocks: Array.isArray(obj.blocks) ? (obj.blocks as RichTextBlock[]) : [],
      headerImage: typeof obj.headerImage === 'string' ? obj.headerImage : null,
    };
  }
  return { blocks: [], headerImage: null };
}

export default function IdentityPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canEditBrand = user?.role ? hasFeaturePermission('canEditBrand', user.role) : false;
  const [blocks, setBlocks] = useState<RichTextBlock[]>([]);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const fetchContent = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_identity_content')
      .select('content')
      .eq('id', DOC_ID)
      .maybeSingle();

    if (!error && data?.content) {
      const parsed = parseContent(data.content);
      setBlocks(parsed.blocks);
      setHeaderImage(parsed.headerImage);
    } else {
      setBlocks([]);
      setHeaderImage(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    if (!canEditBrand && mode === 'edit') setMode('view');
  }, [canEditBrand, mode]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const content: DocContent = { blocks, headerImage };
    const { error } = await supabase
      .from('brand_identity_content')
      .upsert(
        {
          id: DOC_ID,
          content,
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
  }, [blocks, headerImage, t]);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, { ...toast, id: toast.id || crypto.randomUUID() }]);
  }, []);

  const handleHeaderImageChange = useCallback(async (url: string | null) => {
    setHeaderImage(url);
    const content: DocContent = { blocks: blocksRef.current, headerImage: url };
    const { error } = await supabase
      .from('brand_identity_content')
      .upsert(
        {
          id: DOC_ID,
          content,
          updated_by: getUserIdForDb(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (error) {
      addToast({ type: 'error', message: error.message });
    }
  }, [addToast]);

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

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <PageShell
      titleKey="pages.identity.title"
      descriptionKey="pages.identity.description"
      actionsSlot={canEditBrand && mode === 'view' ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-nokturo-800 dark:bg-white/10 text-white rounded-[6px] hover:bg-nokturo-900 dark:hover:bg-white/20 shadow-sm"
          >
            <EditIcon size={16} />
            {t('common.edit')}
          </button>
        </div>
      ) : undefined}
    >
      <ToastContainer toasts={toasts} onClose={removeToast} position="left" />
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-nokturo-500" />
        </div>
      ) : (
        <>
          {(mode === 'edit' || headerImage) && (
          <div className="-ml-9 -mt-6 w-[calc(100%+4.5rem)] box-border mb-4">
            <PageHeaderImage
              imageUrl={headerImage}
              onUpload={handleUploadImage}
              onChange={handleHeaderImageChange}
              editMode={mode === 'edit'}
            />
          </div>
          )}
          <div className={mode === 'view' ? 'max-w-[1124px] mx-auto' : 'relative'}>
          {mode === 'view' ? (
            <RichTextBlockViewer
              blocks={blocks}
              tocTitle={t('pages.identity.title')}
              defaultTocItems={getDefaultTocItems(t)}
              headingFont="body"
            />
          ) : (
            <>
              <div className="min-w-0 lg:pr-[264px] max-w-[860px] mx-auto">
                <RichTextBlockEditor
                  value={blocks}
                  onChange={setBlocks}
                  onUploadImage={handleUploadImage}
                  onToast={addToast}
                  headingFont="body"
                />
              </div>
              <PageStructurePanel
                blocks={blocks}
                onChange={setBlocks}
                footerSlot={
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-nokturo-800 dark:bg-white/10 text-white rounded-[6px] hover:bg-nokturo-900 dark:hover:bg-white/20 disabled:opacity-60 shadow-sm"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon size={16} />}
                    {t('common.save')}
                  </button>
                }
                className="hidden lg:flex"
              />
              {/* Mobile: floating Save button (panel hidden) */}
              <div className="fixed bottom-6 right-6 left-6 z-40 lg:hidden">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full max-w-[240px] mx-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-nokturo-800 dark:bg-white/10 text-white rounded-[6px] hover:bg-nokturo-900 dark:hover:bg-white/20 disabled:opacity-60 shadow-sm"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon size={16} />}
                  {t('common.save')}
                </button>
              </div>
            </>
          )}
          </div>
        </>
      )}
    </PageShell>
  );
}
