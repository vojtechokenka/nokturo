import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { ProductComments } from '../../components/ProductComments';
import {
  Package,
  Loader2,
  MessageSquare,
} from 'lucide-react';

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
  prototype: 'bg-amber-600 text-white',
  production: 'bg-emerald-600 text-white',
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
      <div
        className="flex bg-nokturo-900 border border-nokturo-700 rounded-lg overflow-hidden"
        style={{ height: 'calc(100vh - 220px)' }}
      >
        {/* ── Product list sidebar ──────────────────────────── */}
        <div className="w-72 shrink-0 border-r border-nokturo-700 bg-nokturo-800 flex flex-col">
          {/* Product list */}
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-nokturo-400 animate-spin" />
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
                  <Package className="w-4 h-4 shrink-0 text-nokturo-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    {product.sku && (
                      <p className="text-xs text-nokturo-500 truncate">{product.sku}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
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
              <div className="mb-4 pb-4 border-b border-nokturo-700">
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
              <MessageSquare className="w-12 h-12 text-nokturo-600 mb-4" />
              <p className="text-nokturo-400 text-sm">
                {t('comments.selectProduct')}
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
