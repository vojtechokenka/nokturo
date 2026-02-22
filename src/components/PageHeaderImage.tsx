import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Upload, X, Loader2 } from 'lucide-react';

interface PageHeaderImageProps {
  imageUrl?: string | null;
  onUpload: (file: File) => Promise<string>;
  onChange: (url: string | null) => void;
}

export function PageHeaderImage({ imageUrl, onUpload, onChange }: PageHeaderImageProps) {
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

  // With image — banner with hover controls
  if (imageUrl) {
    return (
      <div
        className="relative group w-full h-[280px] overflow-hidden"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />

        {/* Controls — bottom right, Notion-style */}
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

        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-sm font-medium">{t('headerImage.dropHere')}</span>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleInputChange} />
      </div>
    );
  }

  // No image — subtle hover trigger (Notion-style "Add cover")
  return (
    <div
      className="group relative w-full"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver ? (
        <div className="h-[140px] border-2 border-dashed border-nokturo-400 bg-nokturo-200/60 dark:bg-nokturo-700/60 flex items-center justify-center rounded-b-lg mx-2">
          <span className="text-sm text-nokturo-600 dark:text-nokturo-300">{t('headerImage.dropHere')}</span>
        </div>
      ) : (
        <div className="h-9 flex items-center justify-end px-4 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 size={14} className="animate-spin text-nokturo-400" />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-200 hover:bg-nokturo-200/60 dark:hover:bg-nokturo-700/60 rounded-md transition-colors"
            >
              <ImagePlus size={14} />
              {t('headerImage.addCover')}
            </button>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleInputChange} />
    </div>
  );
}
