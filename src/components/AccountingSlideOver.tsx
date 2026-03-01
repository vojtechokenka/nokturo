import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2, FileText, Upload, Trash2 } from 'lucide-react';
import {
  NotionSelect,
  type NotionSelectOption,
} from './NotionSelect';
import { SimpleDropdown } from './SimpleDropdown';
import { INPUT_CLASS, MODAL_HEADING_CLASS } from '../lib/inputStyles';

// ── Types ────────────────────────────────────────────────────
export interface AccountingOrder {
  id: string;
  order_status: string;
  category: string | null;
  supplier_id: string | null;
  supplier?: { name: string } | null;
  eshop_link: string | null;
  order_number: string | null;
  order_value: number | null;
  order_currency: string;
  monthly_payment: boolean;
  monthly_value: number | null;
  yearly_payment: boolean;
  yearly_value: number | null;
  order_date: string | null;
  payment_method: string | null;
  note: string | null;
  invoice_pdf_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  order_status: string;
  category: string;
  supplier_id: string;
  eshop_link: string;
  order_number: string;
  order_value: string;
  order_currency: string;
  monthly_payment: boolean;
  monthly_value: string;
  yearly_payment: boolean;
  yearly_value: string;
  order_date_day: string;
  order_date_month: string;
  order_date_year: string;
  payment_method: string;
  note: string;
}

const CURRENCY_OPTIONS = ['EUR', 'CZK', 'USD'] as const;

const YEAR_OPTIONS = [2023, 2024, 2025, 2026] as const;
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1) as number[];

const emptyForm: FormData = {
  order_status: 'ordered',
  category: '',
  supplier_id: '',
  eshop_link: '',
  order_number: '',
  order_value: '',
  order_currency: 'EUR',
  monthly_payment: false,
  monthly_value: '',
  yearly_payment: false,
  yearly_value: '',
  order_date_day: '',
  order_date_month: '',
  order_date_year: '',
  payment_method: '',
  note: '',
};

// Order status options (Notion-style: To-do / Complete)
const ORDER_STATUS_OPTIONS: NotionSelectOption[] = [
  { id: 'todo-ordered', name: 'ordered', color: 'gray', sort_order: 0 },
  { id: 'complete-canceled', name: 'canceled', color: 'orange', sort_order: 1 },
  { id: 'complete-delivered', name: 'delivered', color: 'green', sort_order: 2 },
  { id: 'complete-returned', name: 'returned', color: 'red', sort_order: 3 },
];

// Payment method options (from Notion screenshot)
const PAYMENT_METHOD_OPTIONS: NotionSelectOption[] = [
  { id: 'pm-1', name: 'hotove_fio', color: 'pink', sort_order: 0 },
  { id: 'pm-2', name: 'hotove_moneta', color: 'yellow', sort_order: 1 },
  { id: 'pm-3', name: 'hotove_revolut', color: 'green', sort_order: 2 },
  { id: 'pm-4', name: 'moneta_prevod', color: 'orange', sort_order: 3 },
  { id: 'pm-5', name: 'revolut_visa', color: 'blue', sort_order: 4 },
];

interface AccountingSlideOverProps {
  open: boolean;
  order: AccountingOrder | null;
  categories: NotionSelectOption[];
  onCategoriesChange: (options: NotionSelectOption[]) => void;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

export function AccountingSlideOver({
  open,
  order,
  categories,
  onCategoriesChange,
  onClose,
  onSaved,
  onDelete,
  canDelete: canDeleteProp = true,
}: AccountingSlideOverProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [existingInvoiceUrl, setExistingInvoiceUrl] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; website: string | null }[]>([]);

  useEffect(() => {
    if (open) {
      supabase
        .from('suppliers')
        .select('id, name, website')
        .order('name')
        .then(({ data }) => setSuppliers((data as { id: string; name: string; website: string | null }[]) || []));
    }
  }, [open]);

  useEffect(() => {
    if (order) {
      setForm({
        order_status: order.order_status || 'ordered',
        category: order.category || '',
        supplier_id: order.supplier_id || '',
        eshop_link: order.eshop_link || '',
        order_number: order.order_number || '',
        order_value: order.order_value != null ? String(order.order_value) : '',
        order_currency: order.order_currency || 'EUR',
        monthly_payment: order.monthly_payment ?? false,
        monthly_value: order.monthly_value != null ? String(order.monthly_value) : '',
        yearly_payment: order.yearly_payment ?? false,
        yearly_value: order.yearly_value != null ? String(order.yearly_value) : '',
        order_date_day: (() => {
          const d = order.order_date?.slice(0, 10);
          if (!d) return '';
          const [, , day] = d.split('-');
          return day ? String(parseInt(day, 10)) : '';
        })(),
        order_date_month: (() => {
          const d = order.order_date?.slice(0, 10);
          if (!d) return '';
          const [, month] = d.split('-');
          return month ? String(parseInt(month, 10)) : '';
        })(),
        order_date_year: (() => {
          const d = order.order_date?.slice(0, 10);
          if (!d) return '';
          const [year] = d.split('-');
          return year || '';
        })(),
        payment_method: order.payment_method || '',
        note: order.note || '',
      });
      setExistingInvoiceUrl(order.invoice_pdf_url);
      setInvoiceFile(null);
    } else {
      const now = new Date();
      setForm({
        ...emptyForm,
        category: categories[0]?.name ?? '',
        supplier_id: '',
        order_date_day: String(now.getDate()),
        order_date_month: String(now.getMonth() + 1),
        order_date_year: String(now.getFullYear()),
      });
      setExistingInvoiceUrl(null);
      setInvoiceFile(null);
    }
    setError('');
  }, [order, open, categories]);

  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'supplier_id' && typeof value === 'string') {
        const supplier = suppliers.find((s) => s.id === value);
        if (supplier?.website?.trim()) {
          next.eshop_link = supplier.website.trim();
        }
      }
      return next;
    });
  };

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError(t('accounting.invoicePdfOnly'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('accounting.invoiceTooBig'));
      return;
    }
    setInvoiceFile(file);
    setError('');
  };

  const removeInvoice = () => {
    setInvoiceFile(null);
    setExistingInvoiceUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let invoicePath: string | null = existingInvoiceUrl;

      // Upload new PDF if selected
      if (invoiceFile) {
        setUploadingPdf(true);
        const orderId = order?.id ?? crypto.randomUUID();
        const ext = invoiceFile.name.toLowerCase().endsWith('.pdf') ? '' : '.pdf';
        const storagePath = `invoices/${orderId}/faktura${ext}`;
        const arrayBuffer = await invoiceFile.arrayBuffer();
        const contentType = invoiceFile.type || 'application/pdf';
        const { error: uploadErr } = await supabase.storage
          .from('invoices')
          .upload(storagePath, arrayBuffer, { contentType, cacheControl: '3600', upsert: true });
        if (uploadErr) {
          setError(uploadErr.message);
          setSaving(false);
          setUploadingPdf(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(storagePath);
        invoicePath = urlData.publicUrl;
        setUploadingPdf(false);
      }

      const record = {
        order_status: form.order_status,
        category: form.category?.trim() || null,
        supplier_id: form.supplier_id?.trim() || null,
        eshop_link: form.eshop_link?.trim() || null,
        order_number: form.order_number?.trim() || null,
        order_value: form.order_value ? parseFloat(form.order_value) : null,
        order_currency: form.order_currency,
        monthly_payment: form.monthly_payment,
        monthly_value: form.monthly_payment && form.monthly_value ? parseFloat(form.monthly_value) : null,
        yearly_payment: form.yearly_payment,
        yearly_value: form.yearly_payment && form.yearly_value ? parseFloat(form.yearly_value) : null,
        order_date:
          form.order_date_day && form.order_date_month && form.order_date_year
            ? `${form.order_date_year}-${String(form.order_date_month).padStart(2, '0')}-${String(form.order_date_day).padStart(2, '0')}`
            : null,
        payment_method: form.payment_method?.trim() || null,
        note: form.note?.trim() || null,
        invoice_pdf_url: invoicePath,
        created_by: order?.id ? order.created_by : getUserIdForDb(),
      };

      const result = order?.id
        ? await supabase.from('accounting_orders').update(record).eq('id', order.id).select()
        : await supabase.from('accounting_orders').insert(record).select();

      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (!result.data || result.data.length === 0) {
        setError(t('accounting.saveFailed'));
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass = INPUT_CLASS;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-nokturo-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className={MODAL_HEADING_CLASS}>
            {order?.id ? t('accounting.editOrder') : t('accounting.addOrder')}
          </h3>
          <div className="flex items-center gap-1">
            {order?.id && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(order.id);
                  onClose();
                }}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:bg-red-500 hover:text-white transition-colors rounded-lg"
                title={t('common.delete')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form
          id="accounting-form"
          onSubmit={handleSubmit}
          formNoValidate
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Order status */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.orderStatus')}</label>
              <NotionSelect
                value={form.order_status}
                onChange={(v) => handleChange('order_status', v)}
                options={ORDER_STATUS_OPTIONS}
                placeholder={t('accounting.selectStatus')}
                optionsI18nKey="accounting.orderStatuses"
              />
            </div>

            {/* Kategorie */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.category')}</label>
              <NotionSelect
                value={form.category}
                onChange={(v) => handleChange('category', v)}
                options={categories}
                onOptionsChange={onCategoriesChange}
                placeholder={t('accounting.selectCategory')}
                optionsI18nKey="accounting.categories"
                canDelete={canDeleteProp}
              />
            </div>

            {/* Dodavatel */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.supplier')}</label>
              <SimpleDropdown
                value={form.supplier_id}
                onChange={(v) => handleChange('supplier_id', v)}
                options={[
                  { value: '', label: t('accounting.selectSupplier') },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>

            {/* Link na e-shop */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.eshopLink')}</label>
              <input
                type="url"
                value={form.eshop_link}
                onChange={(e) => handleChange('eshop_link', e.target.value)}
                placeholder="https://"
                className={inputClass}
              />
            </div>

            {/* Order number */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.orderNumber')}</label>
              <input
                type="text"
                value={form.order_number}
                onChange={(e) => handleChange('order_number', e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Order value + currency */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.orderValue')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.order_value}
                  onChange={(e) => handleChange('order_value', e.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <div className="shrink-0 min-w-[72px]">
                  <SimpleDropdown
                    value={form.order_currency}
                    onChange={(v) => handleChange('order_currency', v)}
                    options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
                    compact
                  />
                </div>
              </div>
            </div>

            {/* Monthly payment switch */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.monthly_payment}
                  onChange={(e) => handleChange('monthly_payment', e.target.checked)}
                  className="w-4 h-4 rounded-[4px] border-nokturo-300 text-nokturo-900 focus:ring-nokturo-500"
                />
                <span className="text-sm text-nokturo-700 dark:text-nokturo-400">{t('accounting.monthlyPayment')}</span>
              </label>
              {form.monthly_payment && (
                <div className="mt-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.monthly_value}
                    onChange={(e) => handleChange('monthly_value', e.target.value)}
                    placeholder={t('accounting.monthlyValuePlaceholder')}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {/* Yearly payment switch */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.yearly_payment}
                  onChange={(e) => handleChange('yearly_payment', e.target.checked)}
                  className="w-4 h-4 rounded-[4px] border-nokturo-300 text-nokturo-900 focus:ring-nokturo-500"
                />
                <span className="text-sm text-nokturo-700 dark:text-nokturo-400">{t('accounting.yearlyPayment')}</span>
              </label>
              {form.yearly_payment && (
                <div className="mt-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.yearly_value}
                    onChange={(e) => handleChange('yearly_value', e.target.value)}
                    placeholder={t('accounting.yearlyValuePlaceholder')}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {/* Order date (Day / Month / Year) */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.orderDate')}</label>
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
                <SimpleDropdown
                  value={form.order_date_day}
                  onChange={(v) => handleChange('order_date_day', v)}
                  options={[
                    { value: '', label: t('accounting.selectDay') },
                    ...DAY_OPTIONS.map((d) => ({ value: String(d), label: String(d) })),
                  ]}
                />
                <SimpleDropdown
                  value={form.order_date_month}
                  onChange={(v) => handleChange('order_date_month', v)}
                  options={[
                    { value: '', label: t('accounting.selectMonth') },
                    ...MONTH_NUMBERS.map((m) => ({
                      value: String(m),
                      label: t(`accounting.months.${m}`),
                    })),
                  ]}
                />
                <SimpleDropdown
                  value={form.order_date_year}
                  onChange={(v) => handleChange('order_date_year', v)}
                  options={[
                    { value: '', label: t('accounting.selectYear') },
                    ...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
                  ]}
                />
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.paymentMethod')}</label>
              <NotionSelect
                value={form.payment_method}
                onChange={(v) => handleChange('payment_method', v)}
                options={PAYMENT_METHOD_OPTIONS}
                placeholder={t('accounting.selectPaymentMethod')}
                optionsI18nKey="accounting.paymentMethods"
              />
            </div>

            {/* Poznámka */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.note')}</label>
              <textarea
                value={form.note}
                onChange={(e) => handleChange('note', e.target.value)}
                rows={3}
                className="w-full min-h-[44px] bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] px-3 py-2.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-500 dark:placeholder-nokturo-500 focus:outline-none focus:ring-2 focus:ring-nokturo-500/40 transition-colors resize-none"
              />
            </div>

            {/* PDF Faktura */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.invoicePdf')}</label>
              <div className="flex flex-col gap-2">
                {(invoiceFile || existingInvoiceUrl) && (
                  <div className="flex items-center gap-2 py-2">
                    <FileText className="w-4 h-4 text-nokturo-500 shrink-0" />
                    <span className="text-sm text-nokturo-700 dark:text-nokturo-300 truncate flex-1">
                      {invoiceFile?.name ?? t('accounting.invoiceUploaded')}
                    </span>
                    <button
                      type="button"
                      onClick={removeInvoice}
                      className="text-sm bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors">
                  <Upload className="w-4 h-4 text-nokturo-500" />
                  <span className="text-sm text-nokturo-600 dark:text-nokturo-400">{t('accounting.uploadInvoice')}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-3 px-6 py-4 shrink-0 mt-auto bg-black">
            {error && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 shrink-0">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving || uploadingPdf}
                className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(saving || uploadingPdf) && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
