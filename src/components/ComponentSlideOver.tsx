import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2, ImageIcon } from 'lucide-react';
import type { Supplier } from './SupplierSlideOver';
import { CURRENCIES } from '../lib/currency';
import {
  NotionSelect,
  type NotionSelectOption,
} from './NotionSelect';
import { SelectField } from './SelectField';
import { INPUT_CLASS } from '../lib/inputStyles';

// ── Types shared with ComponentsPage ─────────────────────────
export interface Component {
  id: string;
  name: string;
  description: string | null;
  supplier_id: string | null;
  type: string;
  stock_qty: number;
  price_per_unit: number;
  currency: string;
  image_url: string | null;
  parameters: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Form data model ──────────────────────────────────────────
interface FormData {
  name: string;
  description: string;
  type: string;
  stock_qty: string;
  price_per_unit: string;
  currency: string;
  supplier_id: string;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  type: '',
  stock_qty: '0',
  price_per_unit: '0',
  currency: 'EUR',
  supplier_id: '',
};

// ── Props ────────────────────────────────────────────────────
interface ComponentSlideOverProps {
  open: boolean;
  component: Component | null;
  categories: NotionSelectOption[];
  onCategoriesChange: (options: NotionSelectOption[]) => void;
  onClose: () => void;
  canDelete?: boolean;
  onSaved: () => void;
}

// ── Component ────────────────────────────────────────────────
export function ComponentSlideOver({
  open,
  component,
  categories,
  onCategoriesChange,
  onClose,
  onSaved,
  canDelete = true,
}: ComponentSlideOverProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Fetch suppliers for the dropdown
  useEffect(() => {
    if (open) {
      (async () => {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .order('name');
        if (data) setSuppliers(data as Supplier[]);
      })();
    }
  }, [open]);

  // Reset / populate form when the panel opens
  useEffect(() => {
    if (component) {
      const currency = CURRENCIES.includes(component.currency as (typeof CURRENCIES)[number])
        ? component.currency
        : 'EUR';
      setForm({
        name: component.name,
        description: component.description || '',
        type: component.type || '',
        stock_qty: component.stock_qty.toString(),
        price_per_unit: component.price_per_unit.toString(),
        currency,
        supplier_id: component.supplier_id || '',
      });
      setImagePreview(component.image_url || null);
    } else {
      const defaultType = categories[0]?.name ?? '';
      setForm({
        ...emptyForm,
        type: defaultType,
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setError('');
  }, [component, open, categories]);

  // ── Helpers ──────────────────────────────────────────────
  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `swatches/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'image/png';
    const { error: uploadError } = await supabase.storage
      .from('components')
      .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600', upsert: false });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('components').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (!form.type.trim()) {
      setError(t('components.selectTypeRequired'));
      setSaving(false);
      return;
    }

    let imageUrl = component?.image_url || null;

    if (imageFile) {
      if (component?.image_url) {
        const oldPath = component.image_url.split('/components/')[1];
        if (oldPath) {
          await supabase.storage.from('components').remove([oldPath]);
        }
      }
      const url = await uploadImage(imageFile);
      if (url) {
        imageUrl = url;
      } else {
        setSaving(false);
        return;
      }
    }

    const record = {
      name: form.name,
      description: form.description || null,
      type: form.type,
      stock_qty: parseFloat(form.stock_qty) || 0,
      price_per_unit: parseFloat(form.price_per_unit) || 0,
      currency: form.currency,
      image_url: imageUrl,
      parameters: {},
      supplier_id: form.supplier_id || null,
      created_by: component ? component.created_by : getUserIdForDb(),
    };

    const result = component
      ? await supabase.from('components').update(record).eq('id', component.id)
      : await supabase.from('components').insert(record);

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved();
  };

  // ── Render ───────────────────────────────────────────────
  if (!open) return null;

  const inputClass = INPUT_CLASS;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-nokturo-800 border-l border-nokturo-200 dark:border-nokturo-700 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100">
            {component ? t('components.editComponent') : t('components.addComponent')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          id="component-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* ── Image upload ──────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('components.image')}
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative rounded-lg overflow-hidden cursor-pointer bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors aspect-[16/9]"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-nokturo-500 dark:text-nokturo-400">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-sm">{t('components.uploadImage')}</span>
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
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 mt-1.5 transition-colors"
              >
                {t('components.changeImage')}
              </button>
            )}
          </div>

          {/* ── Name ──────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('components.name')} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* ── Type (editable options like suppliers) ───────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('components.type')}
            </label>
            <NotionSelect
              value={form.type}
              onChange={(v) => handleChange('type', v)}
              options={categories}
              onOptionsChange={onCategoriesChange}
              placeholder={t('components.selectType')}
              optionsI18nKey="components.types"
              canDelete={canDelete}
            />
          </div>

          {/* ── Supplier ─────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('components.supplier')}
            </label>
            <SelectField
              value={form.supplier_id}
              onChange={(e) => handleChange('supplier_id', e.target.value)}
              className={inputClass}
            >
              <option value="">{t('components.noSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>

          {/* ── Description ─────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('components.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* ── Stock Quantity ──────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('components.stockQty')}
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.stock_qty}
              onChange={(e) => handleChange('stock_qty', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* ── Price + Currency ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('components.pricePerUnit')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price_per_unit}
                onChange={(e) => handleChange('price_per_unit', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('components.currency')}
              </label>
              <SelectField
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectField>
            </div>
          </div>

          {/* ── Error banner ─────────────────────────────── */}
          {error && (
            <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
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
            form="component-form"
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
