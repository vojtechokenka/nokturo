import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MODAL_HEADING_CLASS } from '../../lib/inputStyles';
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
  materialHasAnyTargetProduct,
  getUniqueTargetProductOptions,
} from '../../lib/compositionUtils';
import { MaterialDetailSlideOver } from '../../components/MaterialDetailSlideOver';
import { Plus, Pencil, Trash2, Package, Loader2, Copy, MoreVertical } from 'lucide-react';

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
  // Target product filter
  const [targetProductFilters, setTargetProductFilters] = useState<string[]>([]);

  // Products (for target product filter labels)
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

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
  const productIdToName = new Map(products.map((p) => [p.id, p.name]));
  const uniqueTargetProducts = getUniqueTargetProductOptions(materials, productIdToName);
  const filteredMaterials = materials.filter((m) => {
    const matchComposition = compositionFilters.length === 0 || materialContainsAnyFiber(m, compositionFilters);
    const matchTargetProduct = targetProductFilters.length === 0 || materialHasAnyTargetProduct(m, targetProductFilters);
    return matchComposition && matchTargetProduct;
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
      .select('id, name')
      .order('name')
      .then(({ data }) => setProducts((data as { id: string; name: string }[]) || []));
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
              targetProducts={uniqueTargetProducts}
              selectedTargetProductIds={targetProductFilters}
              onTargetProductsChange={setTargetProductFilters}
              targetProductTitleKey="materials.filterTargetProduct"
              targetProductEmptyLabelKey="materials.filterTargetProductEmpty"
              activeCount={compositionFilters.length + targetProductFilters.length}
            />
            {(compositionFilters.length > 0 || targetProductFilters.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setCompositionFilters([]);
                  setTargetProductFilters([]);
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
            <Plus className="w-4 h-4" />
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
          <p className="text-xl font-medium text-emerald-400">
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
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-nokturo-600 font-medium">
            {compositionFilters.length > 0 || targetProductFilters.length > 0
              ? t('materials.noMatch')
              : t('materials.noMaterials')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {compositionFilters.length > 0 ? '' : t('materials.addFirst')}
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
                    <Package className="w-10 h-10 text-nokturo-400" />
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
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {cardMenuOpen === mat.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 shadow-lg py-1 min-w-[130px] z-20" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => { openEdit(mat); setCardMenuOpen(null); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleDuplicate(mat); setCardMenuOpen(null); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <Copy className="w-3 h-3" />
                          {t('materials.duplicate')}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(mat.id); setCardMenuOpen(null); }}
                            className="w-full px-3 py-1.5 text-left text-xs bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-nokturo-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className={`${MODAL_HEADING_CLASS} mb-2`}>
              {t('common.confirm')}
            </h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">
              {t('materials.deleteConfirm')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
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
