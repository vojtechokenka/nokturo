import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../../stores/authStore';
import { hasFeaturePermission } from '../../utils/permissions';
import { PageShell } from '../../components/PageShell';
import { PageHeaderImage } from '../../components/PageHeaderImage';
import { PageElementEditor } from '../../components/PageElementEditor';
import { PageElementViewer } from '../../components/PageElementViewer';
import { ToastContainer, type ToastData } from '../../components/Toast';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { EditIcon } from '../../components/icons/EditIcon';
import { SaveIcon } from '../../components/icons/SaveIcon';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePersistedEditMode } from '../../hooks/usePersistedEditMode';
import { useImageLuminance } from '../../hooks/useImageLuminance';
import { parseDocContent } from '../../utils/contentMigration';
import type { PageElement } from '../../types/pageElement';

const DOC_ID = '00000000-0000-0000-0000-000000000003';

interface DocContent {
  elements: PageElement[];
  headerImage?: string | null;
}

function parseContent(raw: unknown): DocContent {
  const parsed = parseDocContent(raw);
  return { elements: parsed.elements, headerImage: parsed.headerImage };
}

export default function CompliancePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canEditBrand = user?.role ? hasFeaturePermission('canEditBrand', user.role) : false;
  const isMobile = useIsMobile();
  const canUseEditMode = canEditBrand && !isMobile;
  const [elements, setElements] = useState<PageElement[]>([]);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const getScrollElement = useCallback(
    () => document.querySelector('[data-scroll-container]') as HTMLElement | null,
    [],
  );
  const { mode, setMode, exitEditMode } = usePersistedEditMode({
    storageKey: 'brand-compliance-mode',
    canEdit: canUseEditMode,
    getScrollElement,
  });
  const headerEditLuminance = useImageLuminance(headerImage);
  const headerEditButtonClass = headerEditLuminance === 'light'
    ? 'bg-nokturo-900/85 text-white hover:bg-nokturo-900'
    : 'bg-white/85 text-nokturo-900 hover:bg-white';

  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const fetchContent = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_compliance')
      .select('content')
      .eq('id', DOC_ID)
      .maybeSingle();

    if (!error && data?.content) {
      const parsed = parseContent(data.content);
      setElements(parsed.elements);
      setHeaderImage(parsed.headerImage ?? null);
    } else {
      setElements([]);
      setHeaderImage(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    if (!canEditBrand && mode === 'edit') setMode('view');
    if (isMobile && mode === 'edit') setMode('view');
  }, [canEditBrand, isMobile, mode, setMode]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const content: DocContent = { elements, headerImage };
    const { error } = await supabase
      .from('brand_compliance')
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
      exitEditMode();
    }
  }, [elements, headerImage, t, exitEditMode]);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, { ...toast, id: toast.id || crypto.randomUUID() }]);
  }, []);

  const handleHeaderImageChange = useCallback(async (url: string | null) => {
    setHeaderImage(url);
    const content: DocContent = { elements: elementsRef.current, headerImage: url };
    const { error } = await supabase
      .from('brand_compliance')
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
    const filePath = `brand-compliance/${fileName}`;

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
      titleKey="pages.compliance.title"
      descriptionKey="pages.compliance.description"
      actionsSlot={undefined}
    >
      <ToastContainer toasts={toasts} onClose={removeToast} position="left" />
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <MaterialIcon name="progress_activity" size={24} className="animate-spin text-nokturo-500 shrink-0" />
        </div>
      ) : (
        <>
          {(mode === 'edit' || headerImage) && (
          <div className={`relative group ${mode === 'edit' || !headerImage ? 'min-w-0 w-full max-w-[860px] mx-auto mb-4' : '-ml-4 -mt-6 w-[calc(100%+2rem)] mb-6 sm:-ml-9 sm:w-[calc(100%+4.5rem)] sm:box-border'}`}>
            <PageHeaderImage
              imageUrl={headerImage}
              onUpload={handleUploadImage}
              onChange={handleHeaderImageChange}
              editMode={mode === 'edit'}
            />
            {canEditBrand && mode === 'view' && headerImage && !isMobile && (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`absolute top-3 right-3 flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-[6px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${headerEditButtonClass}`}
              >
                <EditIcon size={16} />
                {t('common.edit')}
              </button>
            )}
          </div>
          )}
          <div className={mode === 'view' ? 'max-w-[1124px] mx-auto' : 'relative'}>
          {mode === 'view' ? (
            <>
              <PageElementViewer
                elements={elements}
                tocTitle={t('pages.compliance.title')}
                headingFont="body"
                tocFooterSlot={canEditBrand && !headerImage && !isMobile ? (
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className="w-full flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-nokturo-800 dark:bg-white/10 text-white rounded-[6px] hover:bg-nokturo-900 dark:hover:bg-white/20 shadow-sm"
                  >
                    <EditIcon size={16} />
                    {t('common.edit')}
                  </button>
                ) : undefined}
              />
              {canEditBrand && !isMobile && elements.length === 0 && (
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className="flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-nokturo-800 dark:bg-white/10 text-white rounded-[6px] hover:bg-nokturo-900 dark:hover:bg-white/20 shadow-sm"
                  >
                    <EditIcon size={16} />
                    {t('common.edit')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="min-w-0 max-w-[860px] mx-auto">
                <PageElementEditor
                  elements={elements}
                  onChange={setElements}
                  onUploadImage={handleUploadImage}
                  onToast={addToast}
                  headingFont="body"
                />
              </div>
              <div className="fixed bottom-9 right-9 z-40">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-white text-nokturo-900 rounded-[6px] hover:bg-white/90 disabled:opacity-60 shadow-sm"
                >
                  {saving ? <MaterialIcon name="progress_activity" size={16} className="animate-spin shrink-0" /> : <SaveIcon size={16} />}
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
