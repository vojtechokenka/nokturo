import { useTranslation } from 'react-i18next';
import { X, Printer } from 'lucide-react';
import { useExchangeRates, convertToCzk, CURRENCIES } from '../lib/currency';
import type { ProductWithMaterials, ProductTechPack } from './ProductSlideOver';
import { ProductComments } from './ProductComments';
import { RichTextBlockViewer } from './RichTextBlockViewer';
import type { RichTextBlock } from './RichTextBlockEditor';

// ── Status badge colours ──────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pattern: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  prototype: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  production: 'bg-green-500/20 text-green-400 border-green-500/30',
  archived: 'bg-nokturo-600/20 text-nokturo-400 border-nokturo-600/30',
};

// ── Props ─────────────────────────────────────────────────────
interface ProductTechPackProps {
  open: boolean;
  product: ProductWithMaterials;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────
export function ProductTechPack({
  open,
  product,
  onClose,
}: ProductTechPackProps) {
  const { t } = useTranslation();
  useExchangeRates();

  if (!open || !product) return null;

  const materials = product.product_materials ?? [];

  // Cost calculation (per material currency) + CZK total when mixed
  const totalCost = materials.reduce(
    (sum, pm) => sum + pm.consumption_amount * (pm.material?.price_per_unit ?? 0),
    0,
  );
  const currency = materials[0]?.material?.currency ?? 'EUR';
  const totalCostCzk = materials.reduce(
    (sum, pm) => {
      const mat = pm.material;
      const price = mat?.price_per_unit ?? 0;
      const curr = mat?.currency ?? 'EUR';
      return sum + pm.consumption_amount * convertToCzk(price, curr);
    },
    0,
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — wider than the form slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-nokturo-800 border-l border-nokturo-700 flex flex-col animate-slide-in">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-700 shrink-0">
          <h3 className="text-heading-4 font-extralight text-white">
            {t('products.techPack.title')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 text-nokturo-400 hover:text-white transition-colors rounded-lg hover:bg-nokturo-700"
              title={t('products.techPack.printTechPack')}
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-nokturo-400 hover:text-white transition-colors rounded-lg hover:bg-nokturo-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* ── Product information ────────────────────────── */}
          <section>
            <h4 className="text-heading-5 font-extralight text-nokturo-400 uppercase tracking-wider mb-3">
              {t('products.techPack.productInfo')}
            </h4>

            <div className="bg-nokturo-900 border border-nokturo-700 rounded-lg p-5">
              {/* Title row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-heading-4 font-extralight text-white">
                    {product.name}
                  </h2>
                  {product.sku && (
                    <p className="text-sm text-nokturo-400 mt-0.5">
                      SKU: {product.sku}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${
                    STATUS_COLORS[product.status] ?? STATUS_COLORS.concept
                  }`}
                >
                  {t(`products.statuses.${product.status}`)}
                </span>
              </div>

              {/* Short description */}
              {product.short_description && (
                <p className="text-[20px] font-medium text-nokturo-200 mb-4">
                  {product.short_description}
                </p>
              )}

              {/* Meta grid */}
              {(() => {
                const tp = (product.tech_pack || {}) as ProductTechPack;
                const hasSpecs =
                  tp.threads || tp.interlining ||
                  (product.category === 'trousers' && (tp.waistband || tp.seam_allowance));
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <span className="text-nokturo-500">
                          {t('products.category')}:
                        </span>
                        <span className="text-nokturo-200 ml-2">
                          {product.category
                            ? t(`products.categories.${product.category}`)
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-nokturo-500">
                          {t('products.status')}:
                        </span>
                        <span className="text-nokturo-200 ml-2">
                          {t(`products.statuses.${product.status}`)}
                        </span>
                      </div>
                    </div>
                    {hasSpecs && (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pt-2 border-t border-nokturo-700/50">
                        {tp.threads && (
                          <div>
                            <span className="text-nokturo-500">{t('products.threads')}:</span>
                            <span className="text-nokturo-200 ml-2">{tp.threads}</span>
                          </div>
                        )}
                        {tp.interlining && (
                          <div>
                            <span className="text-nokturo-500">{t('products.interlining')}:</span>
                            <span className="text-nokturo-200 ml-2">{tp.interlining}</span>
                          </div>
                        )}
                        {product.category === 'trousers' && tp.waistband && (
                          <div>
                            <span className="text-nokturo-500">{t('products.waistband')}:</span>
                            <span className="text-nokturo-200 ml-2">{tp.waistband}</span>
                          </div>
                        )}
                        {product.category === 'trousers' && tp.seam_allowance && (
                          <div>
                            <span className="text-nokturo-500">{t('products.seamAllowance')}:</span>
                            <span className="text-nokturo-200 ml-2">{tp.seam_allowance}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Description (rich text or plain) */}
              {(() => {
                const descBlocks = (product as ProductWithMaterials & { description_blocks?: RichTextBlock[] }).description_blocks;
                const blocks: RichTextBlock[] = descBlocks && Array.isArray(descBlocks) && descBlocks.length > 0
                  ? descBlocks
                  : product.description && typeof product.description === 'string' && !product.description.startsWith('[')
                    ? [{ id: 'p1', type: 'paragraph', size: 'normal', content: product.description }]
                    : [];
                if (blocks.length > 0) {
                  return (
                    <div className="mt-4 pt-4 border-t border-nokturo-700 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_p]:text-nokturo-300">
                      <RichTextBlockViewer blocks={blocks} showToc={false} />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </section>

          {/* ── Comments ───────────────────────────────────── */}
          <ProductComments productId={product.id} />

          {/* ── Bill of Materials ──────────────────────────── */}
          <section>
            <h4 className="text-heading-5 font-extralight text-nokturo-400 uppercase tracking-wider mb-3">
              {t('products.techPack.billOfMaterials')}
            </h4>

            {materials.length === 0 ? (
              <div className="bg-nokturo-900 border border-nokturo-700 rounded-lg p-8 text-center">
                <p className="text-nokturo-500 text-sm">
                  {t('products.techPack.noMaterialsLinked')}
                </p>
              </div>
            ) : (
              <div className="bg-nokturo-900 border border-nokturo-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-nokturo-700 text-nokturo-400">
                        <th className="text-left px-4 py-2.5 font-medium">
                          {t('products.techPack.material')}
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium">
                          {t('products.techPack.color')}
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium">
                          {t('products.techPack.composition')}
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">
                          {t('products.techPack.consumption')}
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">
                          {t('products.techPack.unitCost')}
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">
                          {t('products.techPack.lineCost')}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {materials.map((pm, idx) => {
                        const mat = pm.material;
                        const lineCost =
                          pm.consumption_amount *
                          (mat?.price_per_unit ?? 0);

                        return (
                          <tr
                            key={pm.id ?? idx}
                            className="border-b border-nokturo-700/50 last:border-0"
                          >
                            {/* Material name + swatch */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {mat?.color && (
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0 border border-nokturo-600"
                                    style={{
                                      backgroundColor: mat.color,
                                    }}
                                  />
                                )}
                                <span className="text-white">
                                  {mat?.name ?? '—'}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-2.5 text-nokturo-300">
                              {mat?.color ?? '—'}
                            </td>

                            <td className="px-4 py-2.5 text-nokturo-300">
                              {mat?.composition ?? '—'}
                            </td>

                            <td className="px-4 py-2.5 text-right text-nokturo-200">
                              {pm.consumption_amount} {mat?.unit}
                            </td>

                            <td className="px-4 py-2.5 text-right text-nokturo-300">
                              {mat?.price_per_unit} {mat?.currency}/
                              {mat?.unit}
                              {mat?.currency &&
                                mat.currency !== 'CZK' &&
                                CURRENCIES.includes(mat.currency as (typeof CURRENCIES)[number]) && (
                                  <span className="block text-nokturo-500 text-xs">
                                    ≈ {convertToCzk(mat?.price_per_unit ?? 0, mat.currency).toFixed(2)} CZK
                                  </span>
                                )}
                            </td>

                            <td className="px-4 py-2.5 text-right text-white font-medium">
                              {lineCost.toFixed(2)} {mat?.currency}
                              {mat?.currency &&
                                mat.currency !== 'CZK' &&
                                CURRENCIES.includes(mat.currency as (typeof CURRENCIES)[number]) && (
                                  <span className="block text-nokturo-500 text-xs font-normal">
                                    ≈ {convertToCzk(lineCost, mat.currency).toFixed(2)} CZK
                                  </span>
                                )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Total row ─────────────────────────────── */}
                <div className="border-t border-nokturo-600 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-nokturo-300">
                    {t('products.techPack.totalMaterialCost')}
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-medium text-white">
                      {totalCost.toFixed(2)} {currency}
                    </span>
                    {(currency !== 'CZK' || materials.some((pm) => pm.material?.currency && pm.material.currency !== 'CZK')) && (
                      <span className="block text-nokturo-500 text-sm">
                        ≈ {totalCostCzk.toFixed(2)} CZK
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
