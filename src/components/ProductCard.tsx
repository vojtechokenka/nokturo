import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import type { ProductWithMaterials } from './ProductSlideOver';

// ── Status badge colours (shared with product pages) ─────────────
const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-blue-600 text-white',
  pattern: 'bg-violet-600 text-white',
  prototype: 'bg-amber-600 text-white',
  production: 'bg-emerald-600 text-white',
  archived: 'bg-nokturo-500 text-white',
};

export interface ProductCardProps {
  product: ProductWithMaterials;
  /** URL to navigate on click (e.g. `/production/products/${id}` or `/production/sampling/${id}`) */
  to: string;
  /** When true, always show the "Připraveno" badge (e.g. on Sampling page) */
  showReadyBadge?: boolean;
}

/**
 * Shared product card component – used by ProductsPage and SamplingPage.
 * Changes here apply to both pages (like Webflow symbols).
 */
export function ProductCard({ product, to, showReadyBadge = false }: ProductCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const tp = product.tech_pack as { preview_photo_url?: string; design_gallery?: { url: string }[] } | undefined;
  const previewImage = tp?.preview_photo_url ?? tp?.design_gallery?.[0]?.url;

  return (
    <div className="group relative bg-nokturo-50 dark:bg-nokturo-800 transition-all" style={{ borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => navigate(to)}
        className="w-full text-left"
      >
        {/* Visual top section – first image from Design gallery or placeholder (4:5 format) */}
        <div className="aspect-[4/5] bg-nokturo-100 dark:bg-nokturo-700 relative flex flex-col items-center justify-center p-4 overflow-hidden">
          {product.priority && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[4px] bg-red-600 text-white text-xs font-medium whitespace-nowrap z-10">
              {t('products.priority')}
            </span>
          )}
          {previewImage ? (
            <img
              src={previewImage}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <>
              <Package className="w-10 h-10 text-nokturo-400 mb-2" />
              {product.category && (
                <span className="text-xs text-nokturo-500 dark:text-nokturo-400">
                  {t(`products.categories.${product.category}`)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Card body */}
        <div className="p-3">
          <h3 className="text-heading-5 font-body font-normal h-fit leading-4 text-nokturo-900 dark:text-nokturo-100 truncate mt-0 mb-0 flex items-center gap-1.5">
            {(showReadyBadge || product.ready_for_sampling) && (
              <span className="avatar-round w-2 h-2 bg-emerald-500 shrink-0" aria-hidden />
            )}
            <span className="truncate font-semibold">{product.name}</span>
          </h3>
          <p className="text-nokturo-700 dark:text-nokturo-300 text-xs mt-0.5 opacity-80">
            {[
              product.category && t(`products.categories.${product.category}`),
              t(`products.statuses.${product.status}`),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {product.sku && (
            <p className="text-nokturo-400 dark:text-nokturo-500 text-xs mt-1.5 truncate">
              {product.sku}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}
