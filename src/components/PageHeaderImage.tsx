import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Loader2 } from 'lucide-react';

function AddCoverIcon({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M6 17h12l-3.75-5l-3 4L9 13zm-3 4V3h18v18zM9.563 9.563Q10 9.125 10 8.5t-.437-1.062T8.5 7t-1.062.438T7 8.5t.438 1.063T8.5 10t1.063-.437" />
    </svg>
  );
}

interface PageHeaderImageProps {
  imageUrl?: string | null;
  onUpload: (file: File) => Promise<string>;
  onChange: (url: string | null) => void;
  editMode?: boolean;
}

export function PageHeaderImage({ imageUrl, onUpload, onChange, editMode = true }: PageHeaderImageProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const url = await onUpload(file);
      onChange(url);
    } catch {
      // upload error handled by parent via toast
    } finally {
      setUploading(false);
    }
  }, [onUpload, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  // With image — banner with hover controls (edit mode) or read-only (view mode)
  if (imageUrl) {
    return (
      <div
        className="relative group w-full h-[280px] overflow-hidden"
        onDragOver={editMode ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
        onDragLeave={editMode ? () => setDragOver(false) : undefined}
        onDrop={editMode ? handleDrop : undefined}
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />

        {/* Hover overlay — only in edit mode */}
        {editMode && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
        )}

        {/* Controls — bottom right, Notion-style — only in edit mode */}
        {editMode && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <div className="px-3 py-1.5 text-xs font-medium bg-black/60 text-white rounded-md">
              <Loader2 size={14} className="animate-spin inline mr-1.5" />
              {t('common.loading')}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-black/60 text-white rounded-md hover:bg-black/80 transition-colors"
              >
                <Upload size={13} />
                {t('headerImage.change')}
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-black/60 text-white rounded-md hover:bg-red-600/90 transition-colors"
              >
                <X size={13} />
                {t('headerImage.remove')}
              </button>
            </>
          )}
        </div>
        )}

        {/* Drag overlay */}
        {editMode && dragOver && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-sm font-medium">{t('headerImage.dropHere')}</span>
          </div>
        )}

        {editMode && <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleInputChange} />}
      </div>
    );
  }

  // No image — Add cover button only in edit mode
  if (!editMode) return null;

  return (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className="relative w-full min-h-[140px] flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] text-nokturo-500 dark:text-nokturo-400 border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 bg-transparent hover:border-nokturo-400 dark:hover:border-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors text-sm disabled:opacity-60 cursor-pointer"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver ? (
        <span className="pointer-events-none">{t('headerImage.dropHere')}</span>
      ) : uploading ? (
        <Loader2 size={24} className="animate-spin shrink-0" />
      ) : (
        <>
          <AddCoverIcon size={20} className="shrink-0" />
          <span className="pointer-events-none">{t('headerImage.addCover')}</span>
        </>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleInputChange} />
    </button>
  );
}
