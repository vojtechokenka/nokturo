import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { getUserIdForDb } from '../stores/authStore';
import { X, Loader2, Trash2 } from 'lucide-react';
import { SimpleDropdown } from './SimpleDropdown';
import { NotionSelect, type NotionSelectOption } from './NotionSelect';
import { INPUT_CLASS } from '../lib/inputStyles';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  next_billing_date: string | null;
  status: 'active' | 'paused' | 'cancelled';
  note: string | null;
  supplier_id: string | null;
  supplier?: { name: string } | null;
  payment_method: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  amount: string;
  currency: string;
  billing_cycle: string;
  next_billing_day: string;
  next_billing_month: string;
  next_billing_year: string;
  status: string;
  note: string;
  supplier_id: string;
  payment_method: string;
}

const CURRENCY_OPTIONS = ['EUR', 'CZK', 'USD'] as const;
const YEAR_OPTIONS = [2025, 2026, 2027, 2028] as const;
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

const STATUS_OPTIONS: NotionSelectOption[] = [
  { id: 'sub-active', name: 'active', color: 'green', sort_order: 0 },
  { id: 'sub-paused', name: 'paused', color: 'yellow', sort_order: 1 },
  { id: 'sub-cancelled', name: 'cancelled', color: 'red', sort_order: 2 },
];

const PAYMENT_METHOD_OPTIONS: NotionSelectOption[] = [
  { id: 'pm-1', name: 'hotove_fio', color: 'pink', sort_order: 0 },
  { id: 'pm-2', name: 'hotove_moneta', color: 'yellow', sort_order: 1 },
  { id: 'pm-3', name: 'hotove_revolut', color: 'green', sort_order: 2 },
  { id: 'pm-4', name: 'moneta_prevod', color: 'orange', sort_order: 3 },
  { id: 'pm-5', name: 'revolut_visa', color: 'blue', sort_order: 4 },
];

const emptyForm: FormData = {
  name: '',
  amount: '',
  currency: 'EUR',
  billing_cycle: 'monthly',
  next_billing_day: '',
  next_billing_month: '',
  next_billing_year: '',
  status: 'active',
  note: '',
  supplier_id: '',
  payment_method: '',
};

interface SubscriptionSlideOverProps {
  open: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
}

export function SubscriptionSlideOver({
  open,
  subscription,
  onClose,
  onSaved,
  onDelete,
}: SubscriptionSlideOverProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      supabase
        .from('suppliers')
        .select('id, name')
        .order('name')
        .then(({ data }) => setSuppliers((data as { id: string; name: string }[]) || []));
    }
  }, [open]);

  useEffect(() => {
    if (subscription) {
      const d = subscription.next_billing_date?.slice(0, 10);
      const [year, month, day] = d ? d.split('-') : ['', '', ''];
      setForm({
        name: subscription.name || '',
        amount: subscription.amount != null ? String(subscription.amount) : '',
        currency: subscription.currency || 'EUR',
        billing_cycle: subscription.billing_cycle || 'monthly',
        next_billing_day: day ? String(parseInt(day, 10)) : '',
        next_billing_month: month ? String(parseInt(month, 10)) : '',
        next_billing_year: year || '',
        status: subscription.status || 'active',
        note: subscription.note || '',
        supplier_id: subscription.supplier_id || '',
        payment_method: subscription.payment_method || '',
      });
    } else {
      const now = new Date();
      setForm({
        ...emptyForm,
        next_billing_day: String(now.getDate()),
        next_billing_month: String(now.getMonth() + 1),
        next_billing_year: String(now.getFullYear()),
      });
    }
    setError('');
  }, [subscription, open]);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError(t('subscriptions.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const nextBillingDate =
        form.next_billing_day && form.next_billing_month && form.next_billing_year
          ? `${form.next_billing_year}-${String(form.next_billing_month).padStart(2, '0')}-${String(form.next_billing_day).padStart(2, '0')}`
          : null;

      const record = {
        name: form.name.trim(),
        amount: form.amount ? parseFloat(form.amount) : 0,
        currency: form.currency,
        billing_cycle: form.billing_cycle,
        next_billing_date: nextBillingDate,
        status: form.status,
        note: form.note?.trim() || null,
        supplier_id: form.supplier_id?.trim() || null,
        payment_method: form.payment_method?.trim() || null,
        created_by: subscription?.id ? subscription.created_by : getUserIdForDb(),
      };

      const result = subscription?.id
        ? await supabase.from('subscriptions').update(record).eq('id', subscription.id).select()
        : await supabase.from('subscriptions').insert(record).select();

      if (result.error) {
        setError(result.error.message);
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-nokturo-800 border-l border-nokturo-200 dark:border-nokturo-700 flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 tracking-tight">
            {subscription?.id ? t('subscriptions.edit') : t('subscriptions.add')}
          </h3>
          <div className="flex items-center gap-1">
            {subscription?.id && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(subscription.id); onClose(); }}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100/80 dark:hover:bg-red-900/30 transition-colors rounded-lg"
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

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('subscriptions.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('subscriptions.namePlaceholder')}
                className={INPUT_CLASS}
                autoFocus
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('subscriptions.status')}</label>
              <NotionSelect
                value={form.status}
                onChange={(v) => handleChange('status', v)}
                options={STATUS_OPTIONS}
                placeholder={t('subscriptions.selectStatus')}
                optionsI18nKey="subscriptions.statuses"
              />
            </div>

            {/* Amount + Currency */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('subscriptions.amount')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  className={`${INPUT_CLASS} flex-1`}
                />
                <div className="shrink-0 min-w-[72px]">
                  <SimpleDropdown
                    value={form.currency}
                    onChange={(v) => handleChange('currency', v)}
                    options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
                    compact
                  />
                </div>
              </div>
            </div>

            {/* Billing Cycle */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('subscriptions.billingCycle')}</label>
              <SimpleDropdown
                value={form.billing_cycle}
                onChange={(v) => handleChange('billing_cycle', v)}
                options={[
                  { value: 'monthly', label: t('subscriptions.monthly') },
                  { value: 'yearly', label: t('subscriptions.yearly') },
                ]}
              />
            </div>

            {/* Next Billing Date */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('subscriptions.nextBillingDate')}</label>
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
                <SimpleDropdown
                  value={form.next_billing_day}
                  onChange={(v) => handleChange('next_billing_day', v)}
                  options={[
                    { value: '', label: t('accounting.selectDay') },
                    ...DAY_OPTIONS.map((d) => ({ value: String(d), label: String(d) })),
                  ]}
                />
                <SimpleDropdown
                  value={form.next_billing_month}
                  onChange={(v) => handleChange('next_billing_month', v)}
                  options={[
                    { value: '', label: t('accounting.selectMonth') },
                    ...MONTH_NUMBERS.map((m) => ({
                      value: String(m),
                      label: t(`accounting.months.${m}`),
                    })),
                  ]}
                />
                <SimpleDropdown
                  value={form.next_billing_year}
                  onChange={(v) => handleChange('next_billing_year', v)}
                  options={[
                    { value: '', label: t('accounting.selectYear') },
                    ...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
                  ]}
                />
              </div>
            </div>

            {/* Supplier */}
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

            {/* Note */}
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('accounting.note')}</label>
              <textarea
                value={form.note}
                onChange={(e) => handleChange('note', e.target.value)}
                rows={3}
                className="w-full bg-nokturo-200/60 dark:bg-nokturo-700/60 border border-nokturo-300 dark:border-nokturo-600 rounded-lg px-3 py-2.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-500 dark:placeholder-nokturo-500 focus:outline-none focus:ring-2 focus:ring-nokturo-500/40 focus:border-nokturo-400 dark:focus:border-nokturo-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-3 px-6 py-4 shrink-0 mt-auto bg-white dark:bg-nokturo-800 border-t border-nokturo-200 dark:border-nokturo-600">
            {error && (
              <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 shrink-0">{error}</div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
