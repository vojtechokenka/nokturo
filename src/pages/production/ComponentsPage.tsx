import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import {
  ComponentSlideOver,
  type Component,
} from '../../components/ComponentSlideOver';
import type { NotionSelectOption } from '../../components/NotionSelect';
import { useExchangeRates, convertToCzk, CURRENCIES } from '../../lib/currency';
import { FilterSelect } from '../../components/FilterSelect';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Loader2,
} from 'lucide-react';

const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-800 dark:text-nokturo-200',
  orange: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  green: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  purple: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  pink: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  yellow: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
};

export default function ComponentsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  useExchangeRates();

  // ── State ──────────────────────────────────────────────────
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<NotionSelectOption[]>([]);

  // Filter (multi-select: empty = show all)
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  // Slide-over
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchComponents = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('components')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeFilter.length > 0) {
      query = query.in('type', typeFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setComponents(data as Component[]);
    }
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('component_categories')
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
            const { error: insErr } = await supabase.from('component_categories').insert({
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
                .from('component_categories')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of prevCategories) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('component_categories').delete().eq('id', o.id);
            if (delErr) throw delErr;
          }
        }
        await fetchCategories();
      } catch (err: unknown) {
        setCategories(prevCategories);
      }
    },
    [categories, fetchCategories]
  );

  // ── Handlers ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingComponent(null);
    setSlideOverOpen(true);
  };

  const openEdit = (c: Component) => {
    setEditingComponent(c);
    setSlideOverOpen(true);
  };

  const handleDelete = async (id: string) => {
    const comp = components.find((c) => c.id === id);

    if (comp?.image_url) {
      const storagePath = comp.image_url.split('/components/')[1];
      if (storagePath) {
        await supabase.storage.from('components').remove([storagePath]);
      }
    }

    const { error } = await supabase.from('components').delete().eq('id', id);
    if (!error) {
      setComponents((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleSaved = () => {
    setSlideOverOpen(false);
    setEditingComponent(null);
    fetchComponents();
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.componentsLibrary.title"
      descriptionKey="pages.componentsLibrary.description"
    >
      {/* ── Action bar ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-end">
        {typeFilter.length > 0 && (
          <button
            type="button"
            onClick={() => setTypeFilter([])}
            className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-2 py-1 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-800 transition-colors shrink-0"
          >
            {t('common.clearFilters')}
          </button>
        )}
        {/* Type filter */}
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          titleKey="components.filterTitle"
          options={[
            { value: 'all', label: t('components.allTypes') },
            ...categories.map((cat) => ({
              value: cat.name,
              label: t(`components.types.${cat.name}`) !== `components.types.${cat.name}` ? t(`components.types.${cat.name}`) : cat.name,
            })),
          ]}
        />

        {/* Add button */}
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('components.addComponent')}
        </button>
      </div>

      {/* ── Content area ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : components.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 font-medium">
            {t('components.noComponents')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {t('components.addFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {components.map((comp) => (
            <div
              key={comp.id}
              className="group relative bg-nokturo-50 dark:bg-nokturo-800 rounded-lg overflow-hidden transition-all"
            >
              {/* Image */}
              <div className="aspect-[16/9] bg-nokturo-100 relative overflow-hidden">
                {comp.image_url ? (
                  <img
                    src={comp.image_url}
                    alt={comp.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-nokturo-400" />
                  </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-nokturo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end gap-2 p-2">
                  <button
                    onClick={() => openEdit(comp)}
                    className="p-2 rounded bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 transition-colors"
                    title={t('common.edit')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(comp.id)}
                      className="p-2 rounded bg-red-700 text-red-100 hover:text-red-50 transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Type badge */}
                {comp.type && (() => {
                  const catOpt = categories.find((o) => o.name === comp.type);
                  const colorCls = catOpt ? TAG_BADGE_CLASSES[catOpt.color] ?? TAG_BADGE_CLASSES.gray : TAG_BADGE_CLASSES.gray;
                  return (
                    <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium ${colorCls}`}>
                      {t(`components.types.${comp.type}`) !== `components.types.${comp.type}` ? t(`components.types.${comp.type}`) : comp.type}
                    </span>
                  );
                })()}
              </div>

              {/* Card body */}
              <div className="p-3">
                <h3 className="text-heading-5 text-xl font-extralight text-nokturo-900 dark:text-nokturo-100 truncate mt-0 mb-0">
                  {comp.name}
                </h3>

                {comp.description && (
                  <p className="text-nokturo-600 dark:text-nokturo-400 text-xs mt-0.5 truncate">
                    {comp.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2 text-xs text-nokturo-600 dark:text-nokturo-400">
                  <span>
                    {comp.stock_qty} {t('components.pcs')}
                  </span>
                  <span className="text-right">
                    {comp.price_per_unit} {comp.currency}/{t('components.pcs')}
                    {comp.currency !== 'CZK' && CURRENCIES.includes(comp.currency as (typeof CURRENCIES)[number]) && (
                      <span className="block text-nokturo-500">
                        ≈ {convertToCzk(comp.price_per_unit, comp.currency).toFixed(2)} CZK
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete confirmation dialog ────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nokturo-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 mb-2">
              {t('common.confirm')}
            </h3>
            <p className="text-nokturo-600 text-sm mb-4">
              {t('components.deleteConfirm')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-nokturo-600 hover:text-nokturo-800 transition-colors"
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
      <ComponentSlideOver
        open={slideOverOpen}
        component={editingComponent}
        categories={categories}
        onCategoriesChange={handleCategoriesChange}
        onClose={() => {
          setSlideOverOpen(false);
          setEditingComponent(null);
        }}
        onSaved={handleSaved}
        canDelete={canDelete}
      />
    </PageShell>
  );
}
