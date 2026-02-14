import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import {
  LabelSlideOver,
  type Label,
} from '../../components/LabelSlideOver';
import type { NotionSelectOption } from '../../components/NotionSelect';
import { FilterSelect } from '../../components/FilterSelect';
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  Loader2,
} from 'lucide-react';

export default function LabelsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');

  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [typOptions, setTypOptions] = useState<NotionSelectOption[]>([]);

  const [typFilter, setTypFilter] = useState<string[]>([]);

  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchLabels = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('labels')
      .select('*')
      .order('created_at', { ascending: false });

    if (typFilter.length > 0) {
      query = query.in('typ', typFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setLabels(data as Label[]);
    }
    setLoading(false);
  }, [typFilter]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  // Global loading timeout: po 7s natvrdo ukončit loading, i když data nedorazila
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 7000);
    return () => clearTimeout(t);
  }, []);

  const fetchTypOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('label_types')
      .select('*')
      .order('sort_order');
    if (!error && data) {
      setTypOptions(
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
    fetchTypOptions();
  }, [fetchTypOptions]);

  const handleTypOptionsChange = useCallback(
    async (newOptions: NotionSelectOption[]) => {
      const prevById = new Map(typOptions.map((o) => [o.id, o]));
      const prevOptions = typOptions;
      setTypOptions(newOptions);

      try {
        for (const opt of newOptions) {
          if (!prevById.has(opt.id)) {
            const { error: insErr } = await supabase.from('label_types').insert({
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
                .from('label_types')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of prevOptions) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('label_types').delete().eq('id', o.id);
            if (delErr) throw delErr;
          }
        }
        await fetchTypOptions();
      } catch (err: unknown) {
        setTypOptions(prevOptions);
      }
    },
    [typOptions, fetchTypOptions]
  );

  const openAdd = () => {
    setEditingLabel(null);
    setSlideOverOpen(true);
  };

  const openEdit = (l: Label) => {
    setEditingLabel(l);
    setSlideOverOpen(true);
  };

  const handleDelete = async (id: string) => {
    const lbl = labels.find((l) => l.id === id);

    if (lbl?.design_url) {
      const storagePath = lbl.design_url.split('/labels/')[1];
      if (storagePath) {
        await supabase.storage.from('labels').remove([storagePath]);
      }
    }

    const { error } = await supabase.from('labels').delete().eq('id', id);
    if (!error) {
      setLabels((prev) => prev.filter((l) => l.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleSaved = () => {
    setSlideOverOpen(false);
    setEditingLabel(null);
    fetchLabels();
  };

  return (
    <PageShell
      titleKey="pages.labelsLibrary.title"
      descriptionKey="pages.labelsLibrary.description"
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-end">
        {typFilter.length > 0 && (
          <button
            type="button"
            onClick={() => setTypFilter([])}
            className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-2 py-1 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-800 transition-colors shrink-0"
          >
            {t('common.clearFilters')}
          </button>
        )}
        <FilterSelect
          value={typFilter}
          onChange={setTypFilter}
          titleKey="labels.filterTitle"
          options={[
            { value: 'all', label: t('labels.allTypes') },
            ...typOptions.map((opt) => ({
              value: opt.name,
              label: t(`labels.types.${opt.name}`) !== `labels.types.${opt.name}` ? t(`labels.types.${opt.name}`) : opt.name,
            })),
          ]}
        />

        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('labels.addLabel')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : labels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Tag className="w-12 h-12 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 font-medium">
            {t('labels.noLabels')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {t('labels.addFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {labels.map((lbl) => (
            <div
              key={lbl.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(lbl)}
              onKeyDown={(e) => e.key === 'Enter' && openEdit(lbl)}
              className="group relative bg-nokturo-50 dark:bg-nokturo-800 rounded-lg overflow-hidden transition-all cursor-pointer hover:ring-2 hover:ring-nokturo-300 dark:hover:ring-nokturo-600"
            >
              <div className="aspect-[16/9] bg-nokturo-100 relative overflow-hidden">
                {lbl.design_url ? (
                  <img
                    src={lbl.design_url}
                    alt={lbl.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tag className="w-10 h-10 text-nokturo-400" />
                  </div>
                )}

                <div
                  className="absolute inset-0 bg-nokturo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end gap-2 p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(lbl)}
                    className="p-2 rounded bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 transition-colors"
                    title={t('common.edit')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(lbl.id)}
                      className="p-2 rounded bg-red-700 text-red-100 hover:text-red-50 transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <span className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm text-nokturo-700 text-xs px-2 py-0.5 rounded-full">
                  {t(`labels.types.${lbl.typ}`) !== `labels.types.${lbl.typ}` ? t(`labels.types.${lbl.typ}`) : lbl.typ}
                </span>
              </div>

              <div className="p-3">
                <h3 className="text-heading-5 text-xl font-extralight text-nokturo-900 dark:text-nokturo-100 truncate mt-0 mb-0">
                  {lbl.name}
                </h3>

                {(lbl.height_mm != null || lbl.width_mm != null) && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-nokturo-600 dark:text-nokturo-400">
                    {lbl.height_mm != null && lbl.width_mm != null ? (
                      <span>
                        {lbl.height_mm} × {lbl.width_mm} mm
                      </span>
                    ) : (
                      <span>
                        {lbl.height_mm ?? lbl.width_mm} mm
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nokturo-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 mb-2">
              {t('common.confirm')}
            </h3>
            <p className="text-nokturo-600 text-sm mb-4">
              {t('labels.deleteConfirm')}
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

      <LabelSlideOver
        open={slideOverOpen}
        label={editingLabel}
        typOptions={typOptions}
        onTypOptionsChange={handleTypOptionsChange}
        onClose={() => {
          setSlideOverOpen(false);
          setEditingLabel(null);
        }}
        onSaved={handleSaved}
        canDelete={canDelete}
      />
    </PageShell>
  );
}
