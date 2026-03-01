import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { countryCodeToFlag } from '../lib/countryUtils';
import { fetchLinkMetadata } from '../lib/fetchLinkMetadata';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2 } from 'lucide-react';
import {
  NotionSelect,
  type NotionSelectOption,
} from '../components/NotionSelect';
import { INPUT_CLASS_DARK, MODAL_HEADING_CLASS } from '../lib/inputStyles';

// ── Types ────────────────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  website_title: string | null;
  address: string | null;
  country: string | null;
  nationality: string | null;
  lead_time_days: number | null;
  notes: string | null;
  rating: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Form data ────────────────────────────────────────────────
interface FormData {
  name: string;
  category: string;
  nationality: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  website_title: string;
}

const emptyForm: FormData = {
  name: '',
  category: '',
  nationality: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  website_title: '',
};

// ── Props ────────────────────────────────────────────────────
interface SupplierSlideOverProps {
  open: boolean;
  supplier: Supplier | null;
  categories: NotionSelectOption[];
  onCategoriesChange: (options: NotionSelectOption[]) => void;
  onClose: () => void;
  onSaved: () => void;
  canDelete?: boolean;
}

// ── Component ────────────────────────────────────────────────
export function SupplierSlideOver({
  open,
  supplier,
  categories,
  onCategoriesChange,
  onClose,
  onSaved,
  canDelete = true,
}: SupplierSlideOverProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fetchingTitle, setFetchingTitle] = useState(false);

  // Auto-fetch SEO title when website URL changes (Notion-style)
  useEffect(() => {
    const url = form.website.trim();
    if (!url || !url.startsWith('http')) return;

    try {
      new URL(url);
    } catch {
      return;
    }

    const timer = setTimeout(async () => {
      setFetchingTitle(true);
      try {
        const meta = await fetchLinkMetadata(url);
        if (meta?.title) {
          setForm((prev) => ({ ...prev, website_title: meta.title }));
        }
        // On 401/500 or any error: meta is null – stop loading, keep basic data (URL only)
      } finally {
        setFetchingTitle(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form.website]);

  // Reset / populate form when panel opens or supplier changes (NOT when categories change –
  // that would overwrite user input e.g. when categories finish loading during edit)
  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name,
        category: supplier.category,
        nationality: supplier.nationality || '',
        contact_name: supplier.contact_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        website: supplier.website || '',
        website_title: supplier.website_title || '',
      });
    } else {
      // New supplier: default to first category if available
      const defaultCat = categories[0]?.name ?? '';
      setForm({
        ...emptyForm,
        category: defaultCat,
      });
    }
    setError('');
  }, [supplier, open]); // eslint-disable-line react-hooks/exhaustive-deps -- categories intentionally excluded to avoid overwriting user input

  // ── Helpers ────────────────────────────────────────────────
  const handleChange = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!form.category.trim()) {
        setError(t('suppliers.selectCategoryRequired'));
        return;
      }

      const record = {
        name: form.name.trim(),
        category: form.category.trim(),
        nationality: form.nationality?.trim() || null,
        contact_name: form.contact_name?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        website: form.website?.trim() || null,
        website_title: form.website_title?.trim() || null,
        lead_time_days: supplier?.lead_time_days ?? null,
        rating: supplier?.rating ?? null,
        created_by: supplier ? supplier.created_by : getUserIdForDb(),
      };

      const result = supplier
        ? await supabase.from('suppliers').update(record).eq('id', supplier.id).select()
        : await supabase.from('suppliers').insert(record).select();

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // Update/insert with no rows returned = RLS or DB issue
      if (!result.data || result.data.length === 0) {
        setError(t('suppliers.saveFailed'));
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  if (!open) return null;

  const inputClass = INPUT_CLASS_DARK;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-nokturo-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <h3 className={MODAL_HEADING_CLASS}>
            {supplier ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-nokturo-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form (formNoValidate - we validate manually; footer z-10 above NotionSelect dropdown) */}
        <form
          id="supplier-form"
          onSubmit={handleSubmit}
          formNoValidate
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-white">
          {/* ── Name ──────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.name')} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* ── Nationality (country of origin) ─────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.nationality')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.nationality}
                onChange={(e) => handleChange('nationality', e.target.value)}
                placeholder="JP, CZ, DE, …"
                className={inputClass}
              />
              {countryCodeToFlag(form.nationality) && (
                <span className="shrink-0 text-lg leading-none" title={form.nationality.trim().toUpperCase()}>
                  {countryCodeToFlag(form.nationality)!}
                </span>
              )}
            </div>
          </div>

          {/* ── Category (editable options like moodboard) ───────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.category')}
            </label>
            <NotionSelect
              value={form.category}
              onChange={(v) => handleChange('category', v)}
              options={categories}
              onOptionsChange={onCategoriesChange}
              placeholder={t('suppliers.selectCategory')}
              optionsI18nKey="suppliers.categories"
              canDelete={canDelete}
            />
          </div>

          {/* ── Contact Person ─────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.contactPerson')}
            </label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => handleChange('contact_name', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* ── Email ──────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.email')}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* ── Phone ─────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.phone')}
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* ── Website (SEO title fetched automatically) ───────── */}
          <div>
            <label className="block text-sm text-nokturo-400 mb-1.5">
              {t('suppliers.website')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://"
                className={inputClass}
              />
              {fetchingTitle && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-nokturo-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              )}
            </div>
            {form.website_title && !fetchingTitle && (
              <p className="text-xs text-nokturo-400 mt-1 truncate" title={form.website_title}>
                → {form.website_title}
              </p>
            )}
          </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 flex flex-col gap-3 px-6 py-4 shrink-0 mt-auto bg-black">
            {error && (
              <div className="text-red-300 text-sm bg-red-900/30 rounded-lg px-3 py-2 shrink-0">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-nokturo-400 hover:text-white transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!form.name.trim()) {
                  setError(t('suppliers.nameRequired'));
                  return;
                }
                handleSubmit({ preventDefault: () => {} } as React.FormEvent);
              }}
              className="px-5 py-2 text-sm bg-white text-nokturo-900 font-medium rounded-lg hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.save')}
            </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
