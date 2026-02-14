import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2, ImageIcon, MoreVertical, Pencil, Copy, Trash2 } from 'lucide-react';
import {
  NotionSelect,
  type NotionSelectOption,
} from './NotionSelect';
import { INPUT_CLASS } from '../lib/inputStyles';

// ── Types shared with LabelsPage ─────────────────────────
export interface Label {
  id: string;
  name: string;
  typ: string;
  height_mm: number | null;
  width_mm: number | null;
  design_url: string | null;
  material_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Form data model ──────────────────────────────────────────
interface FormData {
  name: string;
  typ: string;
  height_mm: string;
  width_mm: string;
}

const emptyForm: FormData = {
  name: '',
  typ: '',
  height_mm: '',
  width_mm: '',
};

// ── Props ────────────────────────────────────────────────────
interface LabelSlideOverProps {
  open: boolean;
  label: Label | null;
  typOptions: NotionSelectOption[];
  onTypOptionsChange: (options: NotionSelectOption[]) => void;
  onClose: () => void;
  canDelete?: boolean;
  onSaved: () => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (label: Label) => void;
}

// ── Component ────────────────────────────────────────────────
export function LabelSlideOver({
  open,
  label,
  typOptions,
  onTypOptionsChange,
  onClose,
  onSaved,
  canDelete = true,
  onDelete,
  onDuplicate,
}: LabelSlideOverProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (label) {
      setForm({
        name: label.name,
        typ: label.typ || '',
        height_mm: label.height_mm != null ? label.height_mm.toString() : '',
        width_mm: label.width_mm != null ? label.width_mm.toString() : '',
      });
      setDesignPreview(label.design_url || null);
    } else {
      const defaultTyp = typOptions[0]?.name ?? '';
      setForm({
        ...emptyForm,
        typ: defaultTyp,
      });
      setDesignPreview(null);
    }
    setDesignFile(null);
    setError('');
  }, [label, open, typOptions]);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDesignSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDesignFile(file);
    setDesignPreview(URL.createObjectURL(file));
  };

  const uploadDesign = async (file: File): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `designs/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'image/png';
    const { error: uploadError } = await supabase.storage
      .from('labels')
      .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600', upsert: false });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('labels').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (!form.typ.trim()) {
      setError(t('labels.selectTypRequired'));
      setSaving(false);
      return;
    }

    let designUrl = label?.design_url || null;

    if (designFile) {
      if (label?.design_url) {
        const oldPath = label.design_url.split('/labels/')[1];
        if (oldPath) {
          await supabase.storage.from('labels').remove([oldPath]);
        }
      }
      const url = await uploadDesign(designFile);
      if (url) {
        designUrl = url;
      } else {
        setSaving(false);
        return;
      }
    }

    const record = {
      name: form.name,
      typ: form.typ,
      height_mm: form.height_mm ? parseFloat(form.height_mm) : null,
      width_mm: form.width_mm ? parseFloat(form.width_mm) : null,
      design_url: designUrl,
      material_id: null,
      created_by: label ? label.created_by : getUserIdForDb(),
    };

    const result = label
      ? await supabase.from('labels').update(record).eq('id', label.id)
      : await supabase.from('labels').insert(record);

    setSaving(false);

    if (result.error) {
      const e = result.error;
      console.error('Supabase Labels INSERT/UPDATE error:', JSON.stringify(e, null, 2));
      const msg = e.message ?? String(e);
      const parts = [msg];
      if (e.details) parts.push(`Details: ${e.details}`);
      if (e.hint) parts.push(`Hint: ${e.hint}`);
      if (e.code) parts.push(`Code: ${e.code}`);
      setError(parts.join('\n'));
      return;
    }

    onSaved();
  };

  if (!open) return null;

  const inputClass = INPUT_CLASS;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-nokturo-800 border-l border-nokturo-200 dark:border-nokturo-700 flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100">
            {label ? t('labels.editLabel') : t('labels.addLabel')}
          </h3>
          <div className="flex items-center gap-2">
            {label && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((p) => !p)}
                  className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                      {onDuplicate && (
                        <button
                          onClick={() => { onDuplicate(label); setMenuOpen(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {t('materials.duplicate')}
                        </button>
                      )}
                      {canDelete && onDelete && (
                        <button
                          onClick={() => { onDelete(label.id); setMenuOpen(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form
          id="label-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* ── Name ──────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('labels.name')} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* ── Typ (editable select) ───────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('labels.typ')}
            </label>
            <NotionSelect
              value={form.typ}
              onChange={(v) => handleChange('typ', v)}
              options={typOptions}
              onOptionsChange={onTypOptionsChange}
              placeholder={t('labels.selectTyp')}
              optionsI18nKey="labels.types"
              canDelete={canDelete}
            />
          </div>

          {/* ── Výška + Šířka (mm) ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('labels.heightMm')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.height_mm}
                onChange={(e) => handleChange('height_mm', e.target.value)}
                placeholder="mm"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('labels.widthMm')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.width_mm}
                onChange={(e) => handleChange('width_mm', e.target.value)}
                placeholder="mm"
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Design (upload photo) ──────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('labels.design')}
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative rounded-lg overflow-hidden cursor-pointer bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors aspect-[16/9]"
            >
              {designPreview ? (
                <img
                  src={designPreview}
                  alt="Design"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-nokturo-500 dark:text-nokturo-400">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-sm">{t('labels.uploadDesign')}</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleDesignSelect}
              className="hidden"
            />
            {designPreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 mt-1.5 transition-colors"
              >
                {t('labels.changeDesign')}
              </button>
            )}
          </div>

          {error && (
            <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5 font-mono whitespace-pre-wrap break-words">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="label-form"
            disabled={saving}
            className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-900/90 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>
    </>
  );
}
