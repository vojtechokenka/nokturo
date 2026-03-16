import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { countryCodeToFlag } from '../lib/countryUtils';
import { MaterialIcon } from './icons/MaterialIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { DuplicateIcon } from './icons/DuplicateIcon';
import { MODAL_HEADING_CLASS } from '../lib/inputStyles';
import type { Material } from './MaterialSlideOver';

interface Supplier {
  id: string;
  name: string;
}

interface ProductSummary {
  id: string;
  name: string;
}

interface MaterialDetailSlideOverProps {
  open: boolean;
  material: Material | null;
  onClose: () => void;
  onEdit: (material: Material) => void;
  onDuplicate?: (material: Material) => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

export function MaterialDetailSlideOver({
  open,
  material,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  canDelete = false,
}: MaterialDetailSlideOverProps) {
  const { t } = useTranslation();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [targetedProducts, setTargetedProducts] = useState<ProductSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!open || !material) return;

    const loadRelated = async () => {
      if (material.supplier_id) {
        const { data } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('id', material.supplier_id)
          .single();
        setSupplier(data as Supplier | null);
      } else {
        setSupplier(null);
      }

      const ids = (material.parameters?.targeted_product_ids as string[]) || [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from('products')
          .select('id, name')
          .in('id', ids);
        setTargetedProducts((data as ProductSummary[]) || []);
      } else {
        setTargetedProducts([]);
      }
    };

    loadRelated();
  }, [open, material]);

  if (!open || !material) return null;

  const compRows = material.parameters?.composition_rows as { pct: number; fiber: string }[] | undefined;
  const compositionDisplay =
    compRows && compRows.length > 0
      ? compRows.map((r) => `${r.pct}% ${r.fiber}`).join(', ')
      : material.composition;

  const fmtStock = (qty: number, unit: string) => {
    const n = qty % 1 === 0 ? qty.toString() : qty.toFixed(2);
    return `${n} ${t(`materials.units.${unit}`)}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-nokturo-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className={MODAL_HEADING_CLASS}>
            {material.name}
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((p) => !p)}
                className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
              >
                <MaterialIcon name="more_vert" size={20} className="shrink-0" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="dropdown-menu absolute right-0 top-full mt-1 shadow-lg py-1 min-w-[140px] z-20">
                    <button
                      onClick={() => { onEdit(material); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                    >
                      <MaterialIcon name="edit" size={14} className="shrink-0" />
                      {t('common.edit')}
                    </button>
                    {onDuplicate && (
                      <button
                        onClick={() => { onDuplicate(material); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                      >
                        <DuplicateIcon className="w-3.5 h-3.5" />
                        {t('materials.duplicate')}
                      </button>
                    )}
                    {canDelete && onDelete && (
                      <button
                        onClick={() => { onDelete(material.id); setMenuOpen(false); }}
                        className="dropdown-menu-item-destructive w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-red hover:text-red-fg flex items-center gap-2"
                      >
                        <DeleteIcon className="w-3.5 h-3.5" />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
            >
              <MaterialIcon name="close" size={20} className="shrink-0" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Image */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
              {t('materials.image')}
            </label>
            <div className="aspect-[16/9] bg-nokturo-100 dark:bg-nokturo-700 rounded-lg overflow-hidden border border-nokturo-200 dark:border-nokturo-600">
              {material.image_url ? (
                <img
                  src={material.image_url}
                  alt={material.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-nokturo-500 dark:text-nokturo-400">
                  <MaterialIcon name="inventory_2" size={40} className="mb-2 shrink-0" />
                  <span className="text-sm">{t('materials.uploadImage')}</span>
                </div>
              )}
            </div>
          </div>

          <hr className="border-nokturo-200 dark:border-nokturo-600" />

          {/* Description */}
          {material.description && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('materials.description')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 whitespace-pre-wrap leading-relaxed">
                {material.description}
              </p>
            </div>
          )}

          <hr className="border-nokturo-200 dark:border-nokturo-600" />

          {/* Composition */}
          {compositionDisplay && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('materials.composition')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">{compositionDisplay}</p>
            </div>
          )}

          {/* Supplier */}
          <div>
            <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
              {t('materials.supplier')}
            </label>
            <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">
              {supplier ? supplier.name : t('materials.noSupplier')}
            </p>
          </div>

          {/* Country of origin */}
          {(material.parameters?.country_of_origin as string) && (
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('materials.countryOfOrigin')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 flex items-center gap-2">
                {(() => {
                  const code = (material.parameters?.country_of_origin as string).trim().toUpperCase();
                  const flag = countryCodeToFlag(code);
                  return flag ? (
                    <>
                      <span className="text-lg leading-none" title={code}>{flag}</span>
                      {code}
                    </>
                  ) : (
                    material.parameters?.country_of_origin as string
                  );
                })()}
              </p>
            </div>
          )}

          <hr className="border-nokturo-200 dark:border-nokturo-600" />

          {/* Stock & Price */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('materials.stockQty')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">
                {fmtStock(material.stock_qty, material.unit)}
              </p>
            </div>
            <div>
              <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                {t('materials.pricePerUnit')}
              </label>
              <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">
                {material.price_per_unit} {material.currency}/{material.unit}
              </p>
            </div>
          </div>

          {/* Width, Weight & Shrinkage */}
          {(material.width_cm != null || material.weight_gsm != null || material.shrinkage != null) && (
            <div className="grid grid-cols-2 gap-6">
              {material.width_cm != null && (
                <div>
                  <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                    {t('materials.widthCm')}
                  </label>
                  <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">{material.width_cm} cm</p>
                </div>
              )}
              {material.weight_gsm != null && (
                <div>
                  <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                    {t('materials.weightGsm')}
                  </label>
                  <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">{material.weight_gsm} g/m²</p>
                </div>
              )}
              {material.shrinkage != null && (
                <div>
                  <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                    {t('materials.shrinkage')}
                  </label>
                  <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100">{material.shrinkage}</p>
                </div>
              )}
            </div>
          )}

          {/* Targeted products */}
          {targetedProducts.length > 0 && (
            <>
              <hr className="border-nokturo-200 dark:border-nokturo-600" />
              <div>
                <label className="block text-[14px] font-normal text-nokturo-700 dark:text-nokturo-400 mb-2 opacity-70">
                  {t('materials.targetedProducts')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {targetedProducts.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex px-2.5 py-1 rounded-[6px] bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-800 dark:text-nokturo-200 text-xs font-medium"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
