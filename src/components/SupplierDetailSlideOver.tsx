import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil, Trash2, ExternalLink, MoreVertical } from 'lucide-react';
import { countryCodeToFlag } from '../lib/countryUtils';
import type { Supplier } from './SupplierSlideOver';
import { MODAL_HEADING_CLASS } from '../lib/inputStyles';
import type { NotionSelectOption } from './NotionSelect';

const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-amber-600 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-600 text-white',
  purple: 'bg-violet-600 text-white',
  pink: 'bg-pink-600 text-white',
  red: 'bg-red-600 text-white',
  yellow: 'bg-amber-500 text-nokturo-900',
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
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-nokturo-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <h3 className={MODAL_HEADING_CLASS}>
            {supplier.name}
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
                      onClick={() => { onEdit(supplier); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-nokturo-200 hover:bg-nokturo-700 flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('common.edit')}
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(supplier.id); onClose(); setMenuOpen(false); }}
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
          {/* Nationality + Category */}
          <div className="flex items-center gap-3">
            {supplier.nationality && (
              <span className="text-2xl leading-none" title={supplier.nationality}>
                {countryCodeToFlag(supplier.nationality) ?? supplier.nationality}
              </span>
            )}
            {supplier.category && (
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-[4px] font-medium ${
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
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.contactPerson')}
              </label>
              <p className="text-base font-medium text-white">{supplier.contact_name}</p>
            </div>
          )}

          {/* Email */}
          {supplier.email && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.email')}
              </label>
              <a
                href={`mailto:${supplier.email}`}
                className="text-base font-medium text-nokturo-300 hover:text-white"
              >
                {supplier.email}
              </a>
            </div>
          )}

          {/* Phone */}
          {supplier.phone && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.phone')}
              </label>
              <a
                href={`tel:${supplier.phone}`}
                className="text-base font-medium text-nokturo-300 hover:text-white"
              >
                {supplier.phone}
              </a>
            </div>
          )}

          {/* Address */}
          {(supplier.address || supplier.country) && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.address')}
              </label>
              <p className="text-base font-medium text-white">
                {[supplier.address, supplier.country].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {/* Website */}
          {supplier.website && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                {t('suppliers.website')}
              </label>
              <a
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-base font-medium text-nokturo-300 hover:text-white"
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
              <p className="text-nokturo-400 text-sm">{t('suppliers.noContactInfo')}</p>
            )}

          {/* Notes */}
          {supplier.notes && (
            <>
              <hr className="border-nokturo-600" />
              <div>
                <label className="block text-[14px] font-normal text-nokturo-400 mb-2 opacity-70">
                  {t('suppliers.notes')}
                </label>
                <p className="text-base font-medium text-white whitespace-pre-wrap leading-relaxed">
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
