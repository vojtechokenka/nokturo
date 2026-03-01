import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil, Copy, Trash2, FileText, ExternalLink, MoreVertical } from 'lucide-react';
import { convertToCzk } from '../lib/currency';
import type { AccountingOrder } from './AccountingSlideOver';
import { MODAL_HEADING_CLASS } from '../lib/inputStyles';
import type { NotionSelectOption } from './NotionSelect';

const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-amber-600 text-white',
  green: 'bg-emerald-600 text-white',
  red: 'bg-red-600 text-white',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  ordered: 'gray',
  canceled: 'orange',
  delivered: 'green',
  returned: 'red',
};

interface AccountingDetailSlideOverProps {
  open: boolean;
  order: AccountingOrder | null;
  categories: NotionSelectOption[];
  onClose: () => void;
  onEdit: (order: AccountingOrder) => void;
  onDuplicate?: (order: AccountingOrder) => void;
  onDelete?: (id: string) => void;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}

function formatValueInCzk(v: number | null, currency: string = 'EUR'): string {
  if (v == null) return '—';
  const czk = convertToCzk(v, currency || 'EUR');
  return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(czk) + ' Kč';
}

export function AccountingDetailSlideOver({
  open,
  order,
  categories,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: AccountingDetailSlideOverProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!open || !order) return null;

  const categoryLabel = order.category
    ? (t(`accounting.categories.${order.category}`) !== `accounting.categories.${order.category}` ? t(`accounting.categories.${order.category}`) : order.category)
    : '—';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-nokturo-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <h3 className={MODAL_HEADING_CLASS}>
            {order.order_number ?? t('accounting.orderNumber')}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((p) => !p)}
                className="p-2 text-nokturo-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-nokturo-800 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                    <button
                      onClick={() => { onEdit(order); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-nokturo-200 hover:bg-nokturo-700 flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('common.edit')}
                    </button>
                    {onDuplicate && (
                      <button
                        onClick={() => { onDuplicate(order); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-200 hover:bg-nokturo-700 flex items-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {t('common.duplicate')}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(order.id); onClose(); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-nokturo-400 hover:text-white transition-colors rounded-lg hover:bg-white/10 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-white">
          {/* Status */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
              {t('accounting.orderStatus')}
            </label>
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-[4px] font-medium ${
                TAG_BADGE_CLASSES[ORDER_STATUS_COLORS[order.order_status] ?? 'gray'] ?? TAG_BADGE_CLASSES.gray
              }`}
            >
              {t(`accounting.orderStatuses.${order.order_status}`)}
            </span>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
              {t('accounting.category')}
            </label>
            <p className="text-base font-medium text-white">{categoryLabel}</p>
          </div>

          {/* Supplier */}
          {order.supplier?.name && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('accounting.supplier')}
              </label>
              <p className="text-base font-medium text-white">{order.supplier.name}</p>
            </div>
          )}

          <hr className="border-nokturo-600" />

          {/* Order value */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
              {t('accounting.orderValue')}
            </label>
            <p className="text-base font-medium text-white">
              {formatValueInCzk(order.order_value, order.order_currency || 'EUR')}
            </p>
          </div>

          {/* Order date */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
              {t('accounting.orderDate')}
            </label>
            <p className="text-base font-medium text-white">{formatDate(order.order_date)}</p>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
              {t('accounting.paymentMethod')}
            </label>
            <p className="text-base font-medium text-white">
              {order.payment_method
                ? t(`accounting.paymentMethods.${order.payment_method}`) !== `accounting.paymentMethods.${order.payment_method}`
                  ? t(`accounting.paymentMethods.${order.payment_method}`)
                  : order.payment_method
                : '—'}
            </p>
          </div>

          {/* Monthly/Yearly payment */}
          {(order.monthly_payment || order.yearly_payment) && (
            <div className="grid grid-cols-2 gap-6">
              {order.monthly_payment && (
                <div>
                  <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                    {t('accounting.monthlyPayment')}
                  </label>
                  <p className="text-base font-medium text-white">
                    {formatValueInCzk(order.monthly_value, order.order_currency || 'EUR')}
                  </p>
                </div>
              )}
              {order.yearly_payment && (
                <div>
                  <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                    {t('accounting.yearlyPayment')}
                  </label>
                  <p className="text-base font-medium text-white">
                    {formatValueInCzk(order.yearly_value, order.order_currency || 'EUR')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* E-shop link */}
          {order.eshop_link && (
            <>
              <hr className="border-nokturo-600" />
              <div>
                <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                  {t('accounting.eshopLink')}
                </label>
                <a
                  href={order.eshop_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-base font-medium text-nokturo-300 hover:text-white"
                >
                  <ExternalLink className="w-4 h-4" />
                  {order.eshop_link.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </>
          )}

          {/* Invoice PDF */}
          {order.invoice_pdf_url && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('accounting.invoicePdf')}
              </label>
              <a
                href={order.invoice_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-nokturo-200 hover:text-white bg-nokturo-800 hover:bg-nokturo-700 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                {t('accounting.downloadInvoice')}
              </a>
            </div>
          )}

          {/* Note */}
          {order.note && (
            <>
              <hr className="border-nokturo-600" />
              <div>
                <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                  {t('accounting.note')}
                </label>
                <p className="text-base font-medium text-white whitespace-pre-wrap leading-relaxed">
                  {order.note}
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
