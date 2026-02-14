import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import {
  ProductSlideOver,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type ProductWithMaterials,
} from '../../components/ProductSlideOver';
import { ProductCard } from '../../components/ProductCard';
import { FilterGroup } from '../../components/FilterGroup';
import {
  Plus,
  Package,
  Loader2,
} from 'lucide-react';

// ── Page component ────────────────────────────────────────────
export default function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');

  // ── State ───────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (multi-select: empty = show all)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Slide-over (add product only – edit is on detail page)
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithMaterials | null>(null);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('products')
      .select(
        `
        *,
        product_materials (
          id,
          material_id,
          consumption_amount,
          notes,
          role,
          variant,
          material:materials (*)
        ),
        product_labels (
          id,
          label_id,
          placement,
          notes,
          label:labels (*, material:materials (*))
        )
      `,
      )
      .order('priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (categoryFilter.length > 0) {
      query = query.in('category', categoryFilter);
    }

    if (statusFilter.length > 0) {
      query = query.in('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Products fetch error:', error);
    }
    if (!error && data) {
      setProducts(data as unknown as ProductWithMaterials[]);
    } else if (!error) {
      setProducts([]);
    }
    setLoading(false);
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Handlers ────────────────────────────────────────────────
  const openAdd = () => {
    setEditingProduct(null);
    setSlideOverOpen(true);
  };

  const hasActiveFilters =
    categoryFilter.length > 0 || statusFilter.length > 0;

  const clearFilters = () => {
    setCategoryFilter([]);
    setStatusFilter([]);
  };

  const handleSaved = (productId?: string, options?: { autoSave?: boolean }) => {
    if (options?.autoSave) {
      fetchProducts();
      return;
    }
    setSlideOverOpen(false);
    setEditingProduct(null);
    fetchProducts();
    if (productId) navigate(`/production/products/${productId}`);
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.products.title"
      descriptionKey="pages.products.description"
    >
      {/* ── Action bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-end">
        {/* Clear filters (when active) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-nokturo-600 hover:text-nokturo-900 px-2 py-1 rounded hover:bg-nokturo-100 transition-colors shrink-0"
          >
            {t('common.clearFilters')}
          </button>
        )}

        {/* Filters (merged) */}
        <FilterGroup
          titleKey="products.filterTitle"
          sections={[
            {
              labelKey: 'products.filterByCategory',
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [
                { value: 'all', label: t('products.allCategories') },
                ...PRODUCT_CATEGORIES.map((cat) => ({
                  value: cat,
                  label: t(`products.categories.${cat}`),
                })),
              ],
            },
            {
              labelKey: 'products.filterByStatus',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'all', label: t('products.allStatuses') },
                ...PRODUCT_STATUSES.map((s) => ({
                  value: s,
                  label: t(`products.statuses.${s}`),
                })),
              ],
            },
          ]}
        />

        {/* Add button */}
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('products.addProduct')}
        </button>
      </div>

      {/* ── Content area ────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 font-medium">
            {hasActiveFilters ? t('products.noMatch') : t('products.noProducts')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {hasActiveFilters
              ? t('products.clearToSeeAll')
              : t('products.addFirst')}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-4 py-2 text-sm font-medium text-nokturo-700 bg-nokturo-200 hover:bg-nokturo-300 rounded-lg transition-colors"
            >
              {t('common.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              to={`/production/products/${product.id}`}
            />
          ))}
        </div>
      )}

      {/* ── Product slide-over (add / edit) ──────────────────── */}
      <ProductSlideOver
        open={slideOverOpen}
        product={editingProduct}
        onClose={() => {
          setSlideOverOpen(false);
          setEditingProduct(null);
        }}
        onSaved={handleSaved}
        canDelete={canDelete}
      />

    </PageShell>
  );
}
