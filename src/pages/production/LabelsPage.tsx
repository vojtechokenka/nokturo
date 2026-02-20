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
  MoreVertical,
  Copy,
} from 'lucide-react';

const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-amber-600 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-emerald-600 text-white',
  purple: 'bg-violet-600 text-white',
  pink: 'bg-pink-600 text-white',
  red: 'bg-red-600 text-white',
  yellow: 'bg-amber-500 text-nokturo-900',
};

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
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);

  // Close card menu on outside click
  useEffect(() => {
    if (!cardMenuOpen) return;
    const handle = () => setCardMenuOpen(null);
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [cardMenuOpen]);

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

  const handleDuplicate = async (lbl: Label) => {
    const { data, error } = await supabase
      .from('labels')
      .insert({
        name: `${lbl.name} (copy)`,
        typ: lbl.typ,
        height_mm: lbl.height_mm,
        width_mm: lbl.width_mm,
        design_url: lbl.design_url,
        material_id: lbl.material_id,
      })
      .select('*')
      .single();
    if (!error && data) {
      fetchLabels();
    }
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

                <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCardMenuOpen(cardMenuOpen === lbl.id ? null : lbl.id)}
                      className={`p-1.5 rounded transition-all ${cardMenuOpen === lbl.id ? 'opacity-100 bg-white dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100' : 'opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-nokturo-700/80 text-nokturo-700 dark:text-nokturo-200 hover:bg-white dark:hover:bg-nokturo-700'}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {cardMenuOpen === lbl.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[120px] z-20">
                        <button
                          type="button"
                          onClick={() => { openEdit(lbl); setCardMenuOpen(null); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          {t('common.edit')}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(lbl.id); setCardMenuOpen(null); }}
                            className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {lbl.typ && (() => {
                  const typOpt = typOptions.find((o) => o.name === lbl.typ);
                  const colorCls = typOpt ? TAG_BADGE_CLASSES[typOpt.color] ?? TAG_BADGE_CLASSES.gray : TAG_BADGE_CLASSES.gray;
                  return (
                    <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium ${colorCls}`}>
                      {t(`labels.types.${lbl.typ}`) !== `labels.types.${lbl.typ}` ? t(`labels.types.${lbl.typ}`) : lbl.typ}
                    </span>
                  );
                })()}
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
          <div className="bg-white dark:bg-nokturo-800 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">
              {t('common.confirm')}
            </h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">
              {t('labels.deleteConfirm')}
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
        onDelete={(id) => { setDeleteTarget(id); setSlideOverOpen(false); setEditingLabel(null); }}
        onDuplicate={(lbl) => { handleDuplicate(lbl); setSlideOverOpen(false); setEditingLabel(null); }}
      />
    </PageShell>
  );
}
