import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import { MaterialSlideOver, type Material } from '../../components/MaterialSlideOver';
import { CompositionFilter } from '../../components/CompositionFilter';
import { useExchangeRates, convertToCzk, CURRENCIES } from '../../lib/currency';
import {
  getUniqueFibersFromMaterials,
  materialContainsAnyFiber,
  getUniqueTargetCategoriesFromMaterials,
  materialHasAnyTargetCategory,
} from '../../lib/compositionUtils';
import { MaterialDetailSlideOver } from '../../components/MaterialDetailSlideOver';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../components/icons/DeleteIcon';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { DuplicateIcon } from '../../components/icons/DuplicateIcon';

export default function MaterialsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  useExchangeRates(); // Prefetch rates for CZK conversion

  // ── State ──────────────────────────────────────────────────
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Composition filter (checkboxes – fibers from materials)
  const [compositionFilters, setCompositionFilters] = useState<string[]>([]);
  // Target category filter (coats, jackets, trousers – not specific products)
  const [targetCategoryFilters, setTargetCategoryFilters] = useState<string[]>([]);

  // Products (id, category) for target category filter
  const [products, setProducts] = useState<{ id: string; category: string | null }[]>([]);

  // Slide-over (add/edit)
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Detail view (read-only)
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Card three-dot menu
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);

  // Close card menu on outside click
  useEffect(() => {
    if (!cardMenuOpen) return;
    const handle = () => setCardMenuOpen(null);
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [cardMenuOpen]);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchMaterials = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('materials')
      .select('*, product_materials(product_id)')
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setMaterials(data as Material[]);
    }
    setLoading(false);
  }, []);

  const uniqueFibers = getUniqueFibersFromMaterials(materials);
  const productIdToCategory = new Map(products.map((p) => [p.id, p.category]).filter(([, c]) => c) as [string, string][]);
  const uniqueTargetCategories = getUniqueTargetCategoriesFromMaterials(materials, productIdToCategory);
  const targetCategoryOptions = uniqueTargetCategories.map((cat) => ({
    id: cat,
    name: t(`products.categories.${cat}`) !== `products.categories.${cat}` ? t(`products.categories.${cat}`) : cat,
  }));
  const filteredMaterials = materials.filter((m) => {
    const matchComposition = compositionFilters.length === 0 || materialContainsAnyFiber(m, compositionFilters);
    const matchCategory = targetCategoryFilters.length === 0 || materialHasAnyTargetCategory(m, targetCategoryFilters, productIdToCategory);
    return matchComposition && matchCategory;
  });

  // ── Overview stats (filtered materials) ──────────────────────
  const YARD_TO_M = 0.9144;
  const lengthMaterials = filteredMaterials.filter((m) => m.unit === 'm' || m.unit === 'yard');
  const totalMeters =
    lengthMaterials.reduce((sum, m) => {
      if (m.unit === 'm') return sum + m.stock_qty;
      return sum + m.stock_qty * YARD_TO_M;
    }, 0) ?? 0;
  const avgPricePerMCzk =
    lengthMaterials.length > 0
      ? lengthMaterials.reduce((sum, m) => {
          const pricePerM = m.unit === 'm' ? m.price_per_unit : m.price_per_unit / YARD_TO_M;
          return sum + convertToCzk(pricePerM, m.currency ?? 'EUR');
        }, 0) / lengthMaterials.length
      : 0;
  const totalInventoryValueCzk = filteredMaterials.reduce((sum, m) => {
    const lineValue = m.stock_qty * (m.price_per_unit ?? 0);
    return sum + convertToCzk(lineValue, m.currency ?? 'EUR');
  }, 0);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, category')
      .then(({ data }) => setProducts((data as { id: string; category: string | null }[]) || []));
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingMaterial(null);
    setSlideOverOpen(true);
  };

  const openEdit = (m: Material) => {
    setEditingMaterial(m);
    setSlideOverOpen(true);
  };

  const openDetail = (m: Material) => {
    setViewingMaterial(m);
  };

  const closeDetailAndEdit = (m: Material) => {
    setViewingMaterial(null);
    setEditingMaterial(m);
    setSlideOverOpen(true);
  };

  const handleDelete = async (id: string) => {
    const mat = materials.find((m) => m.id === id);

    // Remove swatch image from storage if it exists
    if (mat?.image_url) {
      const storagePath = mat.image_url.split('/materials/')[1];
      if (storagePath) {
        await supabase.storage.from('materials').remove([storagePath]);
      }
    }

    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (!error) {
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleSaved = () => {
    setSlideOverOpen(false);
    setEditingMaterial(null);
    fetchMaterials();
  };

  const handleDuplicate = async (mat: Material) => {
    let imageUrl: string | null = mat.image_url;
    if (mat.image_url) {
      const oldPath = mat.image_url.split('/materials/')[1];
      if (oldPath) {
        const ext = oldPath.includes('.') ? oldPath.substring(oldPath.lastIndexOf('.')) : '';
        const newPath = `${crypto.randomUUID()}${ext}`;
        const { error } = await supabase.storage.from('materials').copy(oldPath, newPath);
        if (!error) {
          const { data } = supabase.storage.from('materials').getPublicUrl(newPath);
          imageUrl = data.publicUrl;
        }
      }
    }
    const { id, created_at, updated_at, product_materials: _, ...rest } = mat;
    const { error } = await supabase.from('materials').insert({
      ...rest,
      name: `${mat.name} (${t('materials.duplicateSuffix')})`,
      image_url: imageUrl,
    });
    if (!error) fetchMaterials();
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.materialLibrary.title"
      descriptionKey="pages.materialLibrary.description"
      bare
      actionsSlot={
        <div className="w-full flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <CompositionFilter
              fibers={uniqueFibers}
              selectedFibers={compositionFilters}
              onChange={setCompositionFilters}
              titleKey="materials.filterTitle"
              emptyLabelKey="materials.filterEmpty"
              targetProducts={targetCategoryOptions}
              selectedTargetProductIds={targetCategoryFilters}
              onTargetProductsChange={setTargetCategoryFilters}
              targetProductTitleKey="materials.filterTargetProduct"
              targetProductEmptyLabelKey="materials.filterTargetProductEmpty"
              activeCount={compositionFilters.length + targetCategoryFilters.length}
            />
            {(compositionFilters.length > 0 || targetCategoryFilters.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setCompositionFilters([]);
                  setTargetCategoryFilters([]);
                }}
                className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-2 py-1 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
              >
                {t('common.clearFilters')}
              </button>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-[6px] px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
          >
            <MaterialIcon name="add" size={16} className="shrink-0" />
            {t('materials.addMaterial')}
          </button>
        </div>
      }
    >
      {/* ── Overview stats (sticky at top) ───────────────────── */}
      <div className="sticky top-0 z-20 bg-nokturo-50 dark:bg-black">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-0 pb-6">
        <div className="bg-white/5 rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('materials.overview.totalStock')}
          </p>
          <p className="text-xl font-medium text-white">
            {totalMeters.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
          </p>
        </div>
        <div className="bg-white/5 rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('materials.overview.avgPricePerM')}
          </p>
          <p className="text-xl font-medium text-white">
            {avgPricePerMCzk.toFixed(2)} {t('materials.overview.perM')}
          </p>
        </div>
        <div className="bg-white/5 rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('materials.overview.totalStockValue')}
          </p>
          <p className="text-xl font-medium text-green-fg">
            {totalInventoryValueCzk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-white/5 rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('materials.overview.materialCount')}
          </p>
          <p className="text-xl font-medium text-white">
            {filteredMaterials.length}
          </p>
        </div>
      </div>
      </div>

      {/* ── Content area ──────────────────────────────────── */}
      <div className="px-0 pb-4">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <MaterialIcon name="progress_activity" size={24} className="text-nokturo-500 animate-spin shrink-0" />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-nokturo-600 font-medium">
            {compositionFilters.length > 0 || targetCategoryFilters.length > 0
              ? t('materials.noMatch')
              : t('materials.noMaterials')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {compositionFilters.length > 0 || targetCategoryFilters.length > 0 ? '' : t('materials.addFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail(mat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDetail(mat);
                }
              }}
              className="group bg-white dark:bg-nokturo-800 transition-all cursor-pointer"
              style={{ borderRadius: '8px', overflow: 'hidden' }}
            >
              {/* Swatch image */}
              <div className="aspect-[4/3] bg-nokturo-100 dark:bg-nokturo-700 relative overflow-hidden">
                {mat.image_url ? (
                  <img
                    src={mat.image_url}
                    alt={mat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MaterialIcon name="inventory_2" size={40} className="text-nokturo-400 shrink-0" />
                  </div>
                )}

                {/* Three-dot menu (top-right) */}
                <div className="absolute top-2 right-2 z-10">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardMenuOpen(cardMenuOpen === mat.id ? null : mat.id);
                      }}
                      className={`p-1.5 rounded transition-all ${cardMenuOpen === mat.id ? 'opacity-100 bg-white dark:bg-nokturo-700 text-white' : 'opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-nokturo-700/80 text-nokturo-700 dark:text-nokturo-200 hover:bg-white dark:hover:bg-nokturo-700'}`}
                    >
                      <MaterialIcon name="more_vert" size={16} className="shrink-0" />
                    </button>
                    {cardMenuOpen === mat.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-1 shadow-lg py-1 min-w-[140px] z-20" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => { openEdit(mat); setCardMenuOpen(null); }}
                          className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <MaterialIcon name="edit" size={14} className="shrink-0" />
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleDuplicate(mat); setCardMenuOpen(null); }}
                          className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <DuplicateIcon size={14} className="shrink-0" />
                          {t('materials.duplicate')}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(mat.id); setCardMenuOpen(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-red hover:text-red-fg flex items-center gap-2"
                          >
                            <DeleteIcon size={14} className="shrink-0" />
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="p-3">
                <h3 className="text-heading-5 font-medium text-white truncate">
                  {mat.name}
                </h3>

                {mat.composition && (
                  <p className="text-nokturo-600 dark:text-nokturo-400 text-xs mt-0.5 truncate">
                    {mat.composition}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* ── Delete confirmation dialog ────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}

      {/* ── Slide-over (add / edit) ───────────────────────── */}
      <MaterialSlideOver
        open={slideOverOpen}
        material={editingMaterial}
        onClose={() => {
          setSlideOverOpen(false);
          setEditingMaterial(null);
        }}
        onSaved={handleSaved}
      />

      {/* ── Detail slide-over (read-only) ─────────────────── */}
      <MaterialDetailSlideOver
        open={!!viewingMaterial}
        material={viewingMaterial}
        onClose={() => setViewingMaterial(null)}
        onEdit={closeDetailAndEdit}
        onDuplicate={(mat) => { handleDuplicate(mat); setViewingMaterial(null); }}
        onDelete={(id) => { setDeleteTarget(id); setViewingMaterial(null); }}
        canDelete={canDelete}
      />
    </PageShell>
  );
}
