import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { ProductComments } from '../../components/ProductComments';
import { MaterialIcon } from '../../components/icons/MaterialIcon';

// ── Types ─────────────────────────────────────────────────────
interface ProductSummary {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  category: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-blue-600 text-white',
  pattern: 'bg-violet-600 text-white',
  prototype: 'bg-orange text-orange-fg',
  production: 'bg-green text-green-fg',
  archived: 'bg-nokturo-500 text-white',
};

// ── Component ─────────────────────────────────────────────────
export default function CommentsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Auto-select product from ?product= query param (e.g. from notification deep-link)
  const productFromUrl = searchParams.get('product');
  useEffect(() => {
    if (productFromUrl && !selectedProductId) {
      setSelectedProductId(productFromUrl);
    }
  }, [productFromUrl]);

  // Fetch products
  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('id, name, sku, status, category')
        .order('name');

      const { data } = await query;
      setProducts((data || []) as ProductSummary[]);
      setLoading(false);
    })();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <PageShell
      titleKey="pages.comments.title"
      descriptionKey="pages.comments.description"
    >
      <div className="flex-1 min-h-0 overflow-hidden bg-nokturo-900 rounded-lg">
        <div className="md:hidden h-full">
          {!selectedProductId ? (
            <div className="h-full overflow-y-auto py-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <MaterialIcon name="progress_activity" size={20} className="text-nokturo-400 animate-spin shrink-0" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-nokturo-500 text-sm text-center py-8">
                  {t('products.noProducts')}
                </p>
              ) : (
                products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-nokturo-300 hover:bg-nokturo-700/40 hover:text-nokturo-100 transition-colors"
                  >
                    <MaterialIcon name="inventory_2" size={16} className="shrink-0 text-nokturo-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      {product.sku && (
                        <p className="text-xs text-nokturo-500 truncate">{product.sku}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-[6px] font-medium shrink-0 ${
                        STATUS_COLORS[product.status] ?? STATUS_COLORS.concept
                      }`}
                    >
                      {t(`products.statuses.${product.status}`)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : selectedProduct ? (
            <div className="h-full flex flex-col">
              <div className="shrink-0 px-4 py-3 bg-nokturo-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductId(null)}
                  className="p-2 -ml-2 text-nokturo-300 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={t('common.back')}
                >
                  <MaterialIcon name="arrow_back" size={18} className="shrink-0" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">{selectedProduct.name}</h3>
                  {selectedProduct.sku && (
                    <p className="text-xs text-nokturo-400 truncate">SKU: {selectedProduct.sku}</p>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <ProductComments productId={selectedProductId} />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <MaterialIcon name="chat_bubble" size={48} className="text-nokturo-600 mb-4 shrink-0" />
              <p className="text-nokturo-400 text-sm">{t('comments.selectProduct')}</p>
            </div>
          )}
        </div>

        <div className="hidden md:flex h-full">
          {/* ── Product list sidebar ──────────────────────────── */}
          <div className="w-72 shrink-0 bg-nokturo-800 flex flex-col">
            {/* Product list */}
            <div className="flex-1 overflow-y-auto py-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <MaterialIcon name="progress_activity" size={20} className="text-nokturo-400 animate-spin shrink-0" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-nokturo-500 text-sm text-center py-8">
                  {t('products.noProducts')}
                </p>
              ) : (
                products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selectedProductId === product.id
                        ? 'bg-nokturo-700 text-white'
                        : 'text-nokturo-300 hover:bg-nokturo-700/40 hover:text-nokturo-100'
                    }`}
                  >
                    <MaterialIcon name="inventory_2" size={16} className="shrink-0 text-nokturo-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      {product.sku && (
                        <p className="text-xs text-nokturo-500 truncate">{product.sku}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-[6px] font-medium shrink-0 ${
                        STATUS_COLORS[product.status] ?? STATUS_COLORS.concept
                      }`}
                    >
                      {t(`products.statuses.${product.status}`)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Comments area ─────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedProductId && selectedProduct ? (
              <div>
                {/* Product header */}
                <div className="mb-4 pb-4">
                  <h3 className="text-heading-4 font-extralight text-white">
                    {selectedProduct.name}
                  </h3>
                  {selectedProduct.sku && (
                    <p className="text-sm text-nokturo-400 mt-0.5">
                      SKU: {selectedProduct.sku}
                    </p>
                  )}
                </div>

                <ProductComments productId={selectedProductId} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MaterialIcon name="chat_bubble" size={48} className="text-nokturo-600 mb-4 shrink-0" />
                <p className="text-nokturo-400 text-sm">
                  {t('comments.selectProduct')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
