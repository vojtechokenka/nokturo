import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil, Trash2, ExternalLink, MoreVertical } from 'lucide-react';
import { countryCodeToFlag } from '../lib/countryUtils';
import type { Supplier } from './SupplierSlideOver';
import type { NotionSelectOption } from './NotionSelect';

const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-800 dark:text-nokturo-200',
  orange: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  green: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  purple: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  pink: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  yellow: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
};

interface SupplierDetailSlideOverProps {
  open: boolean;
  supplier: Supplier | null;
  categories: NotionSelectOption[];
  onClose: () => void;
  onEdit: (supplier: Supplier) => void;
  onDelete?: (id: string) => void;
}

export function SupplierDetailSlideOver({
  open,
  supplier,
  categories,
  onClose,
  onEdit,
  onDelete,
}: SupplierDetailSlideOverProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!open || !supplier) return null;

  const categoryLabel = supplier.category
    ? (t(`suppliers.categories.${supplier.category}`) !== `suppliers.categories.${supplier.category}` ? t(`suppliers.categories.${supplier.category}`) : supplier.category)
    : '—';
  const categoryColor = categories.find((c) => c.name === supplier.category)?.color ?? 'gray';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-nokturo-800 border-l border-nokturo-200 dark:border-nokturo-700 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 truncate min-w-0">
            {supplier.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((p) => !p)}
                className="p-2 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                    <button
                      onClick={() => { onEdit(supplier); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('common.edit')}
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(supplier.id); onClose(); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
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
              className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Nationality + Category */}
          <div className="flex items-center gap-3">
            {supplier.nationality && (
              <span className="text-2xl leading-none" title={supplier.nationality}>
                {countryCodeToFlag(supplier.nationality) ?? supplier.nationality}
              </span>
            )}
            {supplier.category && (
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                  TAG_BADGE_CLASSES[categoryColor] ?? TAG_BADGE_CLASSES.gray
                }`}
              >
                {categoryLabel}
              </span>
            )}
          </div>

          {/* Contact person */}
          {supplier.contact_name && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.contactPerson')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">{supplier.contact_name}</p>
            </div>
          )}

          {/* Email */}
          {supplier.email && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.email')}
              </label>
              <a
                href={`mailto:${supplier.email}`}
                className="text-base font-medium text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
              >
                {supplier.email}
              </a>
            </div>
          )}

          {/* Phone */}
          {supplier.phone && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.phone')}
              </label>
              <a
                href={`tel:${supplier.phone}`}
                className="text-base font-medium text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
              >
                {supplier.phone}
              </a>
            </div>
          )}

          {/* Address */}
          {(supplier.address || supplier.country) && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.address')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">
                {[supplier.address, supplier.country].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {/* Website */}
          {supplier.website && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.website')}
              </label>
              <a
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-base font-medium text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
              >
                <ExternalLink className="w-4 h-4" />
                {supplier.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}

          {/* No contact info */}
          {!supplier.contact_name &&
            !supplier.email &&
            !supplier.phone &&
            !supplier.address &&
            !supplier.country &&
            !supplier.website &&
            !supplier.notes && (
              <p className="text-nokturo-500 dark:text-nokturo-400 text-sm">{t('suppliers.noContactInfo')}</p>
            )}

          {/* Notes */}
          {supplier.notes && (
            <>
              <hr className="border-nokturo-200 dark:border-nokturo-600" />
              <div>
                <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                  {t('suppliers.notes')}
                </label>
                <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 whitespace-pre-wrap leading-relaxed">
                  {supplier.notes}
                </p>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}
