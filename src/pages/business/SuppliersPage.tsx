import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { canDeleteAnything } from '../../lib/rbac';
import { countryCodeToFlag } from '../../lib/countryUtils';
import { fetchLinkMetadata } from '../../lib/fetchLinkMetadata';
import { PageShell } from '../../components/PageShell';
import { ToastContainer, type ToastData } from '../../components/Toast';
import {
  SupplierSlideOver,
  type Supplier,
} from '../../components/SupplierSlideOver';
import { SupplierDetailSlideOver } from '../../components/SupplierDetailSlideOver';
import type { NotionSelectOption } from '../../components/NotionSelect';
import { FilterSelect } from '../../components/FilterSelect';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { PRIMARY_BUTTON_CLASS } from '../../lib/inputStyles';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { useIsMobile } from '../../hooks/useIsMobile';

const FETCH_TIMEOUT_MS = 5000;

// ── Category badge colours by NotionSelect color ─────────────────
const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-orange text-orange-fg',
  blue: 'bg-blue-600 text-white',
  green: 'bg-green text-green-fg',
  purple: 'bg-violet-600 text-white',
  pink: 'bg-pink-600 text-white',
  red: 'bg-red text-red-fg',
  yellow: 'bg-orange text-nokturo-900',
};

export default function SuppliersPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  const isMobile = useIsMobile();

  // ── State ──────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter (multi-select: empty = show all)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  // Detail slide-over (view)
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  // Edit slide-over
  const [editOpen, setEditOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Categories (from DB, editable like moodboard)
  const [categories, setCategories] = useState<NotionSelectOption[]>([]);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [showMobileCta, setShowMobileCta] = useState(true);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }]);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let query = supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (categoryFilter.length > 0) {
      query = query.in('category', categoryFilter);
    }

    try {
      const { data, error } = await query.abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) throw error;

      if (data) {
        const list = data as Supplier[];
        setSuppliers(list);

        // Non-blocking backfill: metadata never blocks page render. On 401/500, show URL only.
        for (const s of list) {
          if (s.website?.startsWith('http') && !s.website_title?.trim()) {
            fetchLinkMetadata(s.website).then(async (meta) => {
              if (meta?.title) {
                const { error } = await supabase.from('suppliers').update({ website_title: meta.title }).eq('id', s.id);
                if (!error) {
                  setSuppliers((prev) =>
                    prev.map((x) => (x.id === s.id ? { ...x, website_title: meta.title } : x)),
                  );
                }
              }
            });
          }
        }
      } else {
        setSuppliers([]);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setFetchError(isTimeout ? 'timeout' : (err instanceof Error ? err.message : String(err)));
      setSuppliers((prev) => prev.length > 0 ? prev : []);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Global loading timeout: po 7s natvrdo ukončit loading, i když data nedorazila
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 7000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowMobileCta(true);
      return;
    }
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement | null;
    if (!scrollContainer) return;
    let lastScrollTop = scrollContainer.scrollTop;
    const onScroll = () => {
      const nextScrollTop = scrollContainer.scrollTop;
      const delta = nextScrollTop - lastScrollTop;
      if (Math.abs(delta) < 8) return;
      if (delta > 0 && nextScrollTop > 64) {
        setShowMobileCta(false);
      } else if (delta < 0) {
        setShowMobileCta(true);
      }
      lastScrollTop = nextScrollTop;
    };
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && editOpen) setEditOpen(false);
  }, [isMobile, editOpen]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('supplier_categories')
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
            const { error: insErr } = await supabase.from('supplier_categories').insert({
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
                .from('supplier_categories')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of prevCategories) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('supplier_categories').delete().eq('id', o.id);
            if (delErr) throw delErr;
          }
        }
        await fetchCategories();
      } catch (err: unknown) {
        setCategories(prevCategories);
        const msg = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : err instanceof Error ? err.message : String(err);
        addToast(msg, 'error');
      }
    },
    [categories, fetchCategories, addToast]
  );

  // ── Handlers ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingSupplier(null);
    setEditOpen(true);
  };

  const openDetail = (s: Supplier) => {
    setViewingSupplier(s);
    setDetailOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setDetailOpen(false);
    setViewingSupplier(null);
    setEditingSupplier(s);
    setEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (!error) {
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleSaved = () => {
    setEditOpen(false);
    setEditingSupplier(null);
    fetchSuppliers();
    addToast(t('suppliers.saved'), 'success');
  };

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Render ─────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.supplierDirectory.title"
      descriptionKey="pages.supplierDirectory.description"
      compactContent
      noHorizontalPadding
      actionsSlot={
        <div className="flex w-full items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-2">
            {categoryFilter.length > 0 && (
              <button
                type="button"
                onClick={() => setCategoryFilter([])}
                className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-2 py-1 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-800 transition-colors shrink-0"
              >
                {t('common.clearFilters')}
              </button>
            )}
            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              titleKey="suppliers.filterTitle"
              options={[
                { value: 'all', label: t('suppliers.allCategories') },
                ...categories.map((cat) => ({
                  value: cat.name,
                  label: t(`suppliers.categories.${cat.name}`) !== `suppliers.categories.${cat.name}` ? t(`suppliers.categories.${cat.name}`) : cat.name,
                })),
              ]}
            />
          </div>
          <button
            onClick={openAdd}
            className={`${PRIMARY_BUTTON_CLASS} hidden sm:inline-flex shrink-0`}
          >
            <MaterialIcon name="add" size={16} className="shrink-0" />
            {t('suppliers.addSupplier')}
          </button>
        </div>
      }
    >
      <ToastContainer toasts={toasts} onClose={closeToast} />
      {/* ── Content area ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <MaterialIcon name="progress_activity" size={24} className="text-nokturo-500 animate-spin shrink-0" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium mb-4">
            {t('suppliers.fetchError')}
          </p>
          <button
            onClick={() => fetchSuppliers()}
            className={PRIMARY_BUTTON_CLASS}
          >
            <MaterialIcon name="refresh" size={16} className="shrink-0" />
            {t('suppliers.refresh')}
          </button>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MaterialIcon name="group" size={48} className="text-nokturo-400 mb-4 shrink-0" />
          <p className="text-nokturo-600 font-medium">
            {t('suppliers.noSuppliers')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {t('suppliers.addFirst')}
          </p>
        </div>
      ) : (
        <>
          <div className="sm:hidden space-y-2 px-4">
            {suppliers.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                onClick={() => openDetail(supplier)}
                className="w-full text-left bg-white/5 hover:bg-white/10 transition-colors p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    {supplier.nationality && (
                      <span className="shrink-0 text-base leading-none" title={supplier.nationality}>
                        {countryCodeToFlag(supplier.nationality) ?? supplier.nationality}
                      </span>
                    )}
                    <span className="font-medium text-sm text-nokturo-900 dark:text-nokturo-100 truncate">
                      {supplier.name}
                    </span>
                  </span>
                  {supplier.category && (
                    <span
                      className={`inline-block text-xs px-2 py-0.5 font-medium whitespace-nowrap ${
                        TAG_BADGE_CLASSES[
                          categories.find((c) => c.name === supplier.category)?.color ?? 'gray'
                        ] ?? TAG_BADGE_CLASSES.gray
                      }`}
                      style={{ borderRadius: '4px' }}
                    >
                      {t(`suppliers.categories.${supplier.category}`) !== `suppliers.categories.${supplier.category}` ? t(`suppliers.categories.${supplier.category}`) : supplier.category}
                    </span>
                  )}
                </div>
                {supplier.website ? (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 font-medium text-nokturo-600 dark:text-white opacity-80 hover:opacity-100 hover:text-nokturo-900 dark:hover:text-white bg-nokturo-900/10 dark:bg-white/10 hover:bg-nokturo-900/20 dark:hover:bg-white/20 transition-colors max-w-full"
                    style={{ borderRadius: '6px' }}
                  >
                    <MaterialIcon name="open_in_new" size={12} className="shrink-0" />
                    <span className="truncate">
                      {supplier.website_title || supplier.website.replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-nokturo-500 dark:text-nokturo-400">—</p>
                )}
              </button>
            ))}
          </div>
          <div className="hidden sm:block w-full min-w-0 overflow-x-auto">
            <div className="min-w-[600px] grid grid-cols-[0.7fr_1fr_auto_60px] gap-x-3">
              {/* Header row – single border-b for continuous divider */}
              <div className="col-span-4">
                <div className="grid grid-cols-[0.7fr_1fr_auto_60px] gap-x-3 py-2 pl-4 text-[11px] font-medium text-nokturo-500 uppercase tracking-widest">
                  <span>{t('suppliers.company')}</span>
                  <span>{t('suppliers.website')}</span>
                  <span>{t('suppliers.category')}</span>
                  <span />
                </div>
              </div>

              {/* Data rows – subgrid for alignment + row hover */}
              {suppliers.map((supplier, idx) => (
                <button
                  key={supplier.id}
                  type="button"
                  onClick={() => openDetail(supplier)}
                  className={`col-span-4 grid grid-cols-subgrid gap-x-3 group py-2.5 pl-4 text-sm text-nokturo-900 dark:text-nokturo-100 text-left cursor-pointer hover:!bg-nokturo-100/60 dark:hover:!bg-nokturo-800/60 transition-colors rounded-none ${
                    idx % 2 === 1 ? 'bg-nokturo-900/5 dark:bg-white/5' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {supplier.nationality && (
                      <span
                        className="shrink-0 text-base leading-none"
                        title={supplier.nationality}
                      >
                        {countryCodeToFlag(supplier.nationality) ?? supplier.nationality}
                      </span>
                    )}
                    <span className="font-medium truncate min-w-0" title={supplier.name}>
                      {supplier.name}
                    </span>
                  </span>
                  <span className="truncate min-w-0" onClick={(e) => e.stopPropagation()}>
                    {supplier.website ? (
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 font-medium text-nokturo-600 dark:text-white opacity-60 hover:opacity-100 hover:text-nokturo-900 dark:hover:text-white bg-nokturo-900/10 dark:bg-white/10 hover:bg-nokturo-900/20 dark:hover:bg-white/20 transition-colors truncate max-w-full"
                        style={{ borderRadius: '6px' }}
                      >
                        <MaterialIcon name="open_in_new" size={12} className="shrink-0" />
                        <span className="truncate">
                          {supplier.website_title || supplier.website.replace(/^https?:\/\//, '')}
                        </span>
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span className="shrink-0 flex justify-start items-center">
                    {supplier.category && (
                      <span
                        className={`inline-block text-xs px-2 py-0.5 font-medium whitespace-nowrap ${
                          TAG_BADGE_CLASSES[
                            categories.find((c) => c.name === supplier.category)?.color ?? 'gray'
                          ] ?? TAG_BADGE_CLASSES.gray
                        }`}
                        style={{ borderRadius: '4px' }}
                      >
                        {t(`suppliers.categories.${supplier.category}`) !== `suppliers.categories.${supplier.category}` ? t(`suppliers.categories.${supplier.category}`) : supplier.category}
                      </span>
                    )}
                  </span>
                  <span />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Floating mobile CTA ──────────────────────────────── */}
      <div className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${showMobileCta && !mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-[110%] opacity-0 pointer-events-none'}`}>
        <button
          type="button"
          onClick={openAdd}
          className="h-[54px] w-full inline-flex items-center justify-center gap-2 bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 font-medium text-button-text rounded-none hover:bg-nokturo-900 dark:hover:bg-white transition-colors"
        >
          <MaterialIcon name="add" size={16} className="shrink-0" />
          {t('suppliers.addSupplier')}
        </button>
      </div>

      {/* ── Detail slide-over ────────────────────────────────────── */}
      <SupplierDetailSlideOver
        open={detailOpen}
        supplier={viewingSupplier}
        categories={categories}
        onClose={() => {
          setDetailOpen(false);
          setViewingSupplier(null);
        }}
        onEdit={openEdit}
        onDelete={canDelete ? (id) => {
          setDetailOpen(false);
          setViewingSupplier(null);
          setDeleteTarget(id);
        } : undefined}
      />

      {/* ── Delete confirmation dialog ────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}

      {/* ── Slide-over (add / edit) ───────────────────────── */}
      <SupplierSlideOver
        open={!isMobile && editOpen}
        supplier={editingSupplier}
        categories={categories}
        onCategoriesChange={handleCategoriesChange}
        onClose={() => {
          setEditOpen(false);
          setEditingSupplier(null);
        }}
        onSaved={handleSaved}
        canDelete={canDelete}
      />
    </PageShell>
  );
}
