import { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { NotionSelectOption } from '../../components/NotionSelect';
import { ProductCard } from '../../components/ProductCard';
import { FilterGroup } from '../../components/FilterGroup';
import { SimpleDropdown } from '../../components/SimpleDropdown';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { PRIMARY_BUTTON_CLASS } from '../../lib/inputStyles';

// ── Page component ────────────────────────────────────────────
export default function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');

  // ── State ───────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<NotionSelectOption[]>([]);

  // Filters (multi-select: empty = show all)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [sortBy, setSortBy] = useState<'category' | 'dateAdded' | 'priority'>('category');
  const [sortAsc, setSortAsc] = useState(false);

  // Slide-over (add product only – edit is on detail page)
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithMaterials | null>(null);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchProducts = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);

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

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('sort_order');
    if (!error && data) {
      setCategories(
        data.map((r: { id: string; name: string; color: string; sort_order: number }) => ({
          id: r.id,
          name: r.name,
          color: r.color || 'gray',
          sort_order: r.sort_order,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCategoriesChange = useCallback(
    async (newOptions: NotionSelectOption[]) => {
      const prevById = new Map(categories.map((o) => [o.id, o]));
      const prevCategories = categories;
      setCategories(newOptions);

      try {
        for (const opt of newOptions) {
          if (!prevById.has(opt.id)) {
            const { error: insErr } = await supabase.from('product_categories').insert({
              id: opt.id,
              name: opt.name,
              color: opt.color,
              sort_order: opt.sort_order,
            });
            if (insErr) throw insErr;
          } else {
            const prev = prevById.get(opt.id);
            if (prev && (prev.name !== opt.name || prev.color !== opt.color || prev.sort_order !== opt.sort_order)) {
              const { error: updErr } = await supabase
                .from('product_categories')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of prevCategories) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('product_categories').delete().eq('id', o.id);
            if (delErr) throw delErr;
          }
        }
        await fetchCategories();
      } catch {
        setCategories(prevCategories);
      }
    },
    [categories, fetchCategories]
  );

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
      fetchProducts({ silent: true });
      return;
    }
    setSlideOverOpen(false);
    setEditingProduct(null);
    fetchProducts({ silent: true });
    if (productId) navigate(`/production/products/${productId}`);
  };

  const visibleProducts = useMemo(
    () =>
      products.filter((p) =>
        showDrafts ? (p.hidden ?? false) : !(p.hidden ?? false),
      ),
    [products, showDrafts]
  );

  const sortedProducts = useMemo(() => {
    if (visibleProducts.length <= 1) {
      return visibleProducts;
    }

    const dateDescSort = (a: ProductWithMaterials, b: ProductWithMaterials) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const dateSort = (a: ProductWithMaterials, b: ProductWithMaterials) =>
      sortAsc
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const prioritySort = (a: ProductWithMaterials, b: ProductWithMaterials) =>
      Number(b.priority ?? false) - Number(a.priority ?? false);
    const categorySort = (a: ProductWithMaterials, b: ProductWithMaterials) => {
      const aCategory = a.category?.trim() ?? '';
      const bCategory = b.category?.trim() ?? '';
      const categoryDiff = aCategory.localeCompare(bCategory, undefined, { sensitivity: 'base' });
      return sortAsc ? categoryDiff : -categoryDiff;
    };

    return [...visibleProducts].sort((a, b) => {
      if (sortBy === 'category') {
        const categoryDiff = categorySort(a, b);
        if (categoryDiff !== 0) return categoryDiff;

        const priorityDiff = prioritySort(a, b);
        if (priorityDiff !== 0) return priorityDiff;
        return dateDescSort(a, b);
      }

      if (sortBy === 'dateAdded') {
        return dateSort(a, b);
      }

      const priorityDiff = prioritySort(a, b);
      if (priorityDiff !== 0) return sortAsc ? -priorityDiff : priorityDiff;
      return dateDescSort(a, b);
    });
  }, [visibleProducts, sortBy, sortAsc]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.products.title"
      descriptionKey="pages.products.description"
      compactContent
      noHorizontalPadding
      noContentPadding
      contentBg="black"
      actionsSlot={
        <div className="w-full flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex gap-1">
            {(['published', 'drafts'] as const).map((tab) => {
              const isActive = showDrafts === (tab === 'drafts');
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setShowDrafts(tab === 'drafts')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-[6px] ${
                    isActive
                      ? 'bg-nokturo-800 text-white dark:bg-surface dark:text-nokturo-100'
                      : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300'
                  }`}
                >
                  {tab === 'published' ? (
                    <MaterialIcon name="inventory_2" size={20} className="shrink-0 opacity-60" />
                  ) : (
                    <MaterialIcon name="edit_note" size={20} className="shrink-0 opacity-60" />
                  )}
                  {t(`products.${tab}`)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-center justify-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-2 py-1 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-800 transition-colors shrink-0"
              >
                {t('common.clearFilters')}
              </button>
            )}
            <FilterGroup
              titleKey="products.filterTitle"
              sections={[
                {
                  labelKey: 'products.filterByCategory',
                  value: categoryFilter,
                  onChange: setCategoryFilter,
                  options: [
                    { value: 'all', label: t('products.allCategories') },
                    ...(categories.length > 0
                      ? categories.map((cat) => ({
                          value: cat.name,
                          label: t(`products.categories.${cat.name}`) !== `products.categories.${cat.name}` ? t(`products.categories.${cat.name}`) : cat.name,
                        }))
                      : PRODUCT_CATEGORIES.map((cat) => ({
                          value: cat,
                          label: t(`products.categories.${cat}`),
                        }))),
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
            <SimpleDropdown
              value={sortBy}
              onChange={(value) => setSortBy(value as 'category' | 'dateAdded' | 'priority')}
              options={[
                { value: 'category', label: t('products.sortByCategory') },
                { value: 'dateAdded', label: t('products.sortByDateAdded') },
                { value: 'priority', label: t('products.sortByPriority') },
              ]}
              compact
              className="min-w-[170px]"
            />
            <button
              type="button"
              onClick={() => setSortAsc((a) => !a)}
              title={sortAsc ? t('products.sortDesc') : t('products.sortAsc')}
              className="flex items-center justify-center size-9 shrink-0 rounded-[6px] bg-nokturo-200/80 dark:bg-white/10 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-300 dark:hover:bg-nokturo-700 transition-colors"
            >
              <MaterialIcon name="swap_vert" size={16} className={`transition-transform shrink-0 ${sortAsc ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={openAdd}
              className={`${PRIMARY_BUTTON_CLASS} shrink-0`}
            >
              <MaterialIcon name="add" size={16} className="shrink-0" />
              {t('products.addProduct')}
            </button>
          </div>
        </div>
      }
    >
      {/* ── Content area ────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <MaterialIcon name="progress_activity" size={24} className="text-nokturo-500 animate-spin shrink-0" />
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
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
          {sortedProducts.map((product) => (
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
        categories={categories}
        onCategoriesChange={handleCategoriesChange}
        canDelete={canDelete}
      />

    </PageShell>
  );
}
