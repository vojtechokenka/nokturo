import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { countryCodeToFlag } from '../lib/countryUtils';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2, ImageIcon, Plus, Search } from 'lucide-react';
import { NotionSelect, type NotionSelectOption } from './NotionSelect';
import { SelectField } from './SelectField';
import { FilterChevronIcon } from './FilterSelect';
import type { Supplier } from './SupplierSlideOver';
import { CURRENCIES } from '../lib/currency';
import { INPUT_CLASS } from '../lib/inputStyles';

// ── Types shared with MaterialsPage ──────────────────────────
export interface Material {
  id: string;
  name: string;
  description: string | null;
  supplier_id: string | null;
  unit: 'm' | 'pcs' | 'kg' | 'yard';
  stock_qty: number;
  price_per_unit: number;
  currency: string;
  color: string | null;
  composition: string | null;
  width_cm: number | null;
  weight_gsm: number | null;
  shrinkage: string | null;
  image_url: string | null;
  parameters: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Populated when fetching with product_materials join (for target product filter) */
  product_materials?: { product_id: string }[];
}

interface ProductSummary {
  id: string;
  name: string;
}

interface CompositionRow {
  pct: string;
  fiber: string;
}

export const UNITS = ['m', 'pcs', 'kg', 'yard'] as const;

// Common fiber types for composition (editable – can type custom)
export const COMPOSITION_FIBERS = [
  'wool', 'cotton', 'silk', 'linen', 'polyester', 'viscose', 'elastane',
  'nylon', 'acrylic', 'cashmere', 'leather', 'synthetic', 'other',
] as const;

// ── Form data model ──────────────────────────────────────────
interface FormData {
  name: string;
  description: string;
  unit: string;
  stock_qty: string;
  price_per_unit: string;
  currency: string;
  color: string;
  width_cm: string;
  weight_gsm: string;
  shrinkage: string;
  supplier_id: string;
  country_of_origin: string;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  unit: 'm',
  stock_qty: '0',
  price_per_unit: '0',
  currency: 'EUR',
  color: '',
  width_cm: '',
  weight_gsm: '',
  shrinkage: '',
  supplier_id: '',
  country_of_origin: '',
};

// ── Props ────────────────────────────────────────────────────
interface MaterialSlideOverProps {
  open: boolean;
  material: Material | null;
  onClose: () => void;
  onSaved: () => void;
}

// ── Component ────────────────────────────────────────────────
export function MaterialSlideOver({
  open,
  material,
  onClose,
  onSaved,
}: MaterialSlideOverProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [sharedCustomFibers, setSharedCustomFibers] = useState<NotionSelectOption[]>([]);
  const [sharedCustomTargets, setSharedCustomTargets] = useState<NotionSelectOption[]>([]);
  const [targetedIds, setTargetedIds] = useState<string[]>([]);
  const [targetedCustomOptions, setTargetedCustomOptions] = useState<NotionSelectOption[]>([]);
  const [compositionRows, setCompositionRows] = useState<CompositionRow[]>([{ pct: '', fiber: '' }]);
  const [targetedPickerOpen, setTargetedPickerOpen] = useState(false);
  const [targetedSearch, setTargetedSearch] = useState('');
  const targetedPickerRef = useRef<HTMLDivElement>(null);
  const targetedInputRef = useRef<HTMLInputElement>(null);

  // Products excluded from targeted products (e.g. internal/template products)
  const EXCLUDED_TARGET_PRODUCT_NAMES = ['Ordo'];

  const isExcludedTargetProduct = (name: string) =>
    EXCLUDED_TARGET_PRODUCT_NAMES.some((exc) => name.toLowerCase() === exc.toLowerCase());

  // Options = products (excluding Ordo) + custom (like categories)
  const targetedOptions: NotionSelectOption[] = [
    ...products
      .filter((p) => !isExcludedTargetProduct(p.name))
      .map((p, i) => ({ id: p.id, name: p.name, color: 'gray' as const, sort_order: i })),
    ...targetedCustomOptions,
  ];
  const defaultFiberOptions: NotionSelectOption[] = COMPOSITION_FIBERS.map((name, i) => ({
    id: name,
    name,
    color: 'gray',
    sort_order: i,
  }));
  const [fiberOptions, setFiberOptions] = useState<NotionSelectOption[]>(defaultFiberOptions);

  // Close targeted picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (targetedPickerRef.current && !targetedPickerRef.current.contains(e.target as Node)) {
        setTargetedPickerOpen(false);
      }
    };
    if (targetedPickerOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [targetedPickerOpen]);

  // Fetch suppliers, products, and shared custom options from all materials
  useEffect(() => {
    if (open) {
      (async () => {
        const [supRes, prodRes, matRes] = await Promise.all([
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('products').select('id, name').order('name'),
          supabase.from('materials').select('parameters'),
        ]);
        if (supRes.data) setSuppliers(supRes.data as Supplier[]);
        if (prodRes.data) setProducts(prodRes.data as ProductSummary[]);

        // Collect shared custom fibers and targets from all materials
        const fibersByName = new Map<string, NotionSelectOption>();
        const targetsByName = new Map<string, NotionSelectOption>();
        const defaultFiberNames = new Set(COMPOSITION_FIBERS);

        (matRes.data || []).forEach((row: { parameters?: Record<string, unknown> }) => {
          const p = row.parameters || {};
          const customFibers = (p.custom_fibers as NotionSelectOption[]) || [];
          customFibers.forEach((o) => {
            if (o.name && !defaultFiberNames.has(o.name as (typeof COMPOSITION_FIBERS)[number]) && !fibersByName.has(o.name)) {
              fibersByName.set(o.name, { id: o.id, name: o.name, color: o.color || 'gray', sort_order: fibersByName.size });
            }
          });
          const compRows = (p.composition_rows as { fiber: string }[]) || [];
          compRows.forEach((r) => {
            if (r.fiber && !defaultFiberNames.has(r.fiber as (typeof COMPOSITION_FIBERS)[number]) && !fibersByName.has(r.fiber)) {
              fibersByName.set(r.fiber, { id: r.fiber, name: r.fiber, color: 'gray', sort_order: fibersByName.size });
            }
          });
          const customTargets = (p.targeted_custom_targets as NotionSelectOption[]) || [];
          customTargets.forEach((o) => {
            if (o.name && !targetsByName.has(o.name)) {
              targetsByName.set(o.name, { id: o.id, name: o.name, color: o.color || 'gray', sort_order: targetsByName.size });
            }
          });
        });

        setSharedCustomFibers(Array.from(fibersByName.values()));
        setSharedCustomTargets(Array.from(targetsByName.values()));
      })();
    }
  }, [open]);

  // Reset / populate form when the panel opens (depends on shared options when loaded)
  useEffect(() => {
    if (material) {
      const currency = CURRENCIES.includes(material.currency as (typeof CURRENCIES)[number])
        ? material.currency
        : 'EUR';
      setForm({
        name: material.name,
        description: material.description || '',
        unit: material.unit,
        stock_qty: material.stock_qty.toString(),
        price_per_unit: material.price_per_unit.toString(),
        currency,
        color: material.color || '',
        width_cm: material.width_cm?.toString() || '',
        weight_gsm: material.weight_gsm?.toString() || '',
        shrinkage: material.shrinkage?.toString() || '',
        supplier_id: material.supplier_id || '',
        country_of_origin: (material.parameters?.country_of_origin as string) || '',
      });
      setImagePreview(material.image_url || null);
      const rawIds = (material.parameters?.targeted_product_ids as string[]) || [];
      setTargetedIds(
        rawIds.filter((id) => {
          const p = products.find((x) => x.id === id);
          return !p || !isExcludedTargetProduct(p.name);
        })
      );

      // Merge shared custom targets + material's custom targets (material's take precedence for selected ids)
      const matCustomTargets = (material.parameters?.targeted_custom_targets as NotionSelectOption[]) || [];
      const targetsByName = new Map<string, NotionSelectOption>();
      matCustomTargets.forEach((o) => targetsByName.set(o.name, o));
      sharedCustomTargets.forEach((o) => {
        if (!targetsByName.has(o.name)) targetsByName.set(o.name, o);
      });
      setTargetedCustomOptions(Array.from(targetsByName.values()));

      const comp = material.parameters?.composition_rows as { pct: number; fiber: string }[] | undefined;
      if (comp && comp.length > 0) {
        setCompositionRows(comp.map((r) => ({ pct: String(r.pct), fiber: r.fiber })));
      } else if (material.composition) {
        // Legacy: try parse "50% Wool, 50% Cotton"
        const parts = material.composition.split(',').map((s) => s.trim());
        const rows: CompositionRow[] = parts
          .map((s) => {
            const m = s.match(/^(\d+(?:\.\d+)?)\s*%\s*(.+)$/);
            return m ? { pct: m[1], fiber: m[2].trim() } : null;
          })
          .filter((r): r is CompositionRow => r !== null);
        setCompositionRows(rows.length > 0 ? rows : [{ pct: '', fiber: '' }]);
      } else {
        setCompositionRows([{ pct: '', fiber: '' }]);
      }

      // Merge default + shared custom fibers + fibers from current material
      const fiberByName = new Map<string, NotionSelectOption>();
      defaultFiberOptions.forEach((o) => fiberByName.set(o.name, o));
      sharedCustomFibers.forEach((o) => fiberByName.set(o.name, o));
      const fibersFromComp = comp?.map((r) => r.fiber) || [];
      if (material.composition && !comp?.length) {
        const parts = material.composition.split(',').map((s) => s.trim());
        parts.forEach((s) => {
          const m = s.match(/\d+(?:\.\d+)?\s*%\s*(.+)$/);
          if (m && !fiberByName.has(m[1])) fiberByName.set(m[1], { id: m[1], name: m[1], color: 'gray', sort_order: fiberByName.size });
        });
      }
      fibersFromComp.forEach((f) => {
        if (f && !fiberByName.has(f)) fiberByName.set(f, { id: f, name: f, color: 'gray', sort_order: fiberByName.size });
      });
      setFiberOptions(Array.from(fiberByName.values()));
    } else {
      setForm(emptyForm);
      setImagePreview(null);
      setTargetedIds([]);
      setTargetedCustomOptions(sharedCustomTargets);
      setCompositionRows([{ pct: '', fiber: '' }]);
      setFiberOptions([...defaultFiberOptions, ...sharedCustomFibers]);
    }
    setImageFile(null);
    setError('');
  }, [material, open, sharedCustomFibers, sharedCustomTargets, products]);

  // ── Helpers ──────────────────────────────────────────────
  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const compositionSum = compositionRows.reduce((acc, r) => acc + (parseFloat(r.pct) || 0), 0);
  const compositionSumValid = compositionRows.every((r) => r.pct !== '' && r.fiber.trim()) && Math.abs(compositionSum - 100) < 0.01;

  const updateCompositionRow = (idx: number, field: keyof CompositionRow, value: string) => {
    setCompositionRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const addCompositionRow = () => {
    setCompositionRows((prev) => [...prev, { pct: '', fiber: '' }]);
  };

  const removeCompositionRow = (idx: number) => {
    if (compositionRows.length <= 1) return;
    setCompositionRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addTargeted = (id: string) => {
    if (!targetedIds.includes(id)) {
      setTargetedIds((prev) => [...prev, id]);
    }
    setTargetedPickerOpen(false);
    setTargetedSearch('');
  };

  const removeTargeted = (id: string) => {
    setTargetedIds((prev) => prev.filter((x) => x !== id));
  };

  const createTargetedOption = () => {
    const name = targetedSearch.trim();
    if (!name) return;
    const existing = targetedOptions.find((o) => o.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      addTargeted(existing.id);
      return;
    }
    const newOpt: NotionSelectOption = {
      id: crypto.randomUUID(),
      name,
      color: 'gray',
      sort_order: targetedOptions.length,
    };
    setTargetedCustomOptions((prev) => [...prev, newOpt]);
    addTargeted(newOpt.id);
  };

  const filteredTargeted = targetedOptions.filter((o) =>
    o.name.toLowerCase().includes(targetedSearch.toLowerCase())
  );
  const canCreateTargeted = targetedSearch.trim().length > 0 && !filteredTargeted.some(
    (o) => o.name.toLowerCase() === targetedSearch.trim().toLowerCase()
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `swatches/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'image/png';
    const { error: uploadError } = await supabase.storage
      .from('materials')
      .upload(filePath, arrayBuffer, { contentType, cacheControl: '3600', upsert: false });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('materials').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hasComposition = compositionRows.some((r) => r.pct !== '' || r.fiber.trim());
    if (hasComposition && !compositionSumValid) {
      setError(t('materials.compositionSumError'));
      return;
    }

    setSaving(true);

    try {
    let imageUrl = material?.image_url || null;

    // Upload a new image when selected
    if (imageFile) {
      // Remove the old image first if we're updating
      if (material?.image_url) {
        const oldPath = material.image_url.split('/materials/')[1];
        if (oldPath) {
          await supabase.storage.from('materials').remove([oldPath]);
        }
      }
      const url = await uploadImage(imageFile);
      if (url) {
        imageUrl = url;
      } else {
        setSaving(false);
        return; // upload failed – error already set
      }
    }

    const compRows = hasComposition
      ? compositionRows
          .filter((r) => r.pct !== '' && r.fiber.trim())
          .map((r) => ({ pct: parseFloat(r.pct) || 0, fiber: r.fiber.trim() }))
      : [];
    const compositionDisplay =
      compRows.length > 0
        ? compRows.map((r) => `${r.pct}% ${r.fiber}`).join(', ')
        : null;

    const customFibers = fiberOptions.filter((o) => !COMPOSITION_FIBERS.includes(o.name as (typeof COMPOSITION_FIBERS)[number]));

    const record = {
      name: form.name,
      description: form.description || null,
      unit: form.unit,
      stock_qty: parseFloat(form.stock_qty) || 0,
      price_per_unit: parseFloat(form.price_per_unit) || 0,
      currency: form.currency,
      color: form.color || null,
      composition: compositionDisplay,
      width_cm: form.width_cm ? parseFloat(form.width_cm) : null,
      weight_gsm: form.weight_gsm ? parseFloat(form.weight_gsm) : null,
      shrinkage: form.shrinkage?.trim() || null,
      image_url: imageUrl,
      parameters: {
        targeted_product_ids: targetedIds.filter((id) => {
          const p = products.find((x) => x.id === id);
          return !p || !isExcludedTargetProduct(p.name);
        }),
        targeted_custom_targets: targetedCustomOptions,
        composition_rows: compRows,
        custom_fibers: customFibers,
        country_of_origin: form.country_of_origin?.trim() || null,
      },
      supplier_id: form.supplier_id || null,
      created_by: material ? material.created_by : getUserIdForDb(),
    };

    const result = material
      ? await supabase.from('materials').update(record).eq('id', material.id)
      : await supabase.from('materials').insert(record);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Material save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────
  if (!open) return null;

  const inputClass = INPUT_CLASS;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-nokturo-800 border-l border-nokturo-200 dark:border-nokturo-700 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <h3 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100">
            {material ? t('materials.editMaterial') : t('materials.addMaterial')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          id="material-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* ── Image upload ──────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.image')}
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 rounded-lg overflow-hidden cursor-pointer hover:border-nokturo-400 dark:hover:border-nokturo-500 transition-colors aspect-[16/9]"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-nokturo-500 dark:text-nokturo-400">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-sm">{t('materials.uploadImage')}</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 mt-1.5 transition-colors"
              >
                {t('materials.changeImage')}
              </button>
            )}
          </div>

          {/* ── Name ──────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.name')} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* ── Targeted products (multi-select tags) ───── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.targetedProducts')}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {targetedIds.map((id) => {
                const opt = targetedOptions.find((o) => o.id === id);
                return opt ? (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-200 text-xs font-medium"
                  >
                    {opt.name}
                    <button
                      type="button"
                      onClick={() => removeTargeted(id)}
                      className="p-0.5 hover:bg-nokturo-300 dark:hover:bg-nokturo-500 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
            <div className="relative" ref={targetedPickerRef}>
              <button
                type="button"
                onClick={() => {
                  setTargetedPickerOpen((o) => !o);
                  setTargetedSearch('');
                  setTimeout(() => targetedInputRef.current?.focus(), 0);
                }}
                className="w-full flex items-center justify-between gap-2 bg-white dark:bg-nokturo-700/60 border border-nokturo-300 dark:border-nokturo-600 rounded-lg px-3 py-2 text-sm text-left text-nokturo-500 dark:text-nokturo-400 focus:outline-none focus:border-nokturo-500 hover:border-nokturo-400 dark:hover:border-nokturo-500"
              >
                <span>{t('materials.addTargetedProduct')}</span>
                <FilterChevronIcon
                  className={`w-4 h-4 shrink-0 transition-transform ml-1 ${targetedPickerOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {targetedPickerOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-nokturo-800 border border-nokturo-200 dark:border-nokturo-600 rounded-xl overflow-hidden">
                  <div className="p-1.5 border-b border-nokturo-200 dark:border-nokturo-600">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nokturo-500 dark:text-nokturo-400" />
                      <input
                        ref={targetedInputRef}
                        type="text"
                        value={targetedSearch}
                        onChange={(e) => setTargetedSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (canCreateTargeted) createTargetedOption();
                            else if (filteredTargeted.length === 1) addTargeted(filteredTargeted[0].id);
                          }
                          if (e.key === 'Escape') setTargetedPickerOpen(false);
                        }}
                        placeholder={t('materials.searchProducts')}
                        className="w-full bg-white dark:bg-nokturo-700/60 border border-nokturo-300 dark:border-nokturo-600 rounded-lg pl-8 pr-3 py-1.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500 focus:outline-none focus:border-nokturo-500"
                      />
                    </div>
                    <p className="text-nokturo-500 dark:text-nokturo-400 text-xs mt-1">{t('notionSelect.selectOrCreate')}</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {filteredTargeted.length === 0 && !canCreateTargeted ? (
                      <p className="text-nokturo-500 dark:text-nokturo-400 text-sm py-3 text-center">{t('notionSelect.noOptions')}</p>
                    ) : (
                      <div className="space-y-px">
                        {filteredTargeted
                          .filter((o) => !targetedIds.includes(o.id))
                          .map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => addTargeted(opt.id)}
                              className="w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-nokturo-50 dark:hover:bg-nokturo-700"
                            >
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-200">
                                {opt.name}
                              </span>
                            </button>
                          ))}
                        {canCreateTargeted && (
                          <button
                            type="button"
                            onClick={createTargetedOption}
                            className="w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-50 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200"
                          >
                            <span className="text-nokturo-500 dark:text-nokturo-400">+</span>
                            {t('notionSelect.createOption', { name: targetedSearch.trim() })}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Composition (% + fiber rows, editable) ─── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.composition')}
            </label>
            <div className="space-y-2">
              {compositionRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="%"
                    value={row.pct}
                    onChange={(e) => updateCompositionRow(idx, 'pct', e.target.value)}
                    className="w-16 bg-white dark:bg-nokturo-700/60 border border-nokturo-300 dark:border-nokturo-600 rounded-lg px-2 py-1.5 text-sm text-nokturo-900 dark:text-nokturo-100 focus:outline-none focus:border-nokturo-500"
                  />
                  <div className="flex-1 min-w-0">
                    <NotionSelect
                      value={row.fiber}
                      onChange={(v) => updateCompositionRow(idx, 'fiber', v)}
                      options={fiberOptions}
                      onOptionsChange={setFiberOptions}
                      placeholder={t('materials.fiberPlaceholder')}
                      optionsI18nKey="materials.fibers"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompositionRow(idx)}
                    disabled={compositionRows.length <= 1}
                    className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCompositionRow}
                className="flex items-center gap-1.5 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200"
              >
                <Plus className="w-4 h-4" />
                {t('materials.addCompositionRow')}
              </button>
              {compositionRows.some((r) => r.pct !== '' || r.fiber.trim()) && !compositionSumValid && (
                <p className="text-xs text-red-500">{t('materials.compositionSumError')}</p>
              )}
              {compositionSumValid && (
                <p className="text-xs text-nokturo-500 dark:text-nokturo-400">
                  {t('materials.compositionTotal')}: {compositionSum.toFixed(1)}%
                </p>
              )}
            </div>
          </div>

          {/* ── Supplier ─────────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.supplier')}
            </label>
            <SelectField
              value={form.supplier_id}
              onChange={(e) => handleChange('supplier_id', e.target.value)}
              className={inputClass}
            >
              <option value="">{t('materials.noSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>

          {/* ── Country of origin (země původu) ───────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.countryOfOrigin')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.country_of_origin}
                onChange={(e) => handleChange('country_of_origin', e.target.value)}
                placeholder="JP, CZ, DE, …"
                className={inputClass}
              />
              {countryCodeToFlag(form.country_of_origin) && (
                <span className="shrink-0 text-lg leading-none" title={form.country_of_origin.trim().toUpperCase()}>
                  {countryCodeToFlag(form.country_of_origin)!}
                </span>
              )}
            </div>
          </div>

          {/* ── Description ─────────────────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* ── Color (text input only) ─────────────────── */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('materials.color')}
            </label>
            <input
              type="text"
              value={form.color}
              onChange={(e) => handleChange('color', e.target.value)}
              placeholder="e.g. Navy Blue, #1a1a2e"
              className={inputClass}
            />
          </div>

          {/* ── Stock Quantity + Unit ────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.stockQty')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.stock_qty}
                onChange={(e) => handleChange('stock_qty', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.unit')}
              </label>
              <SelectField
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                className={inputClass}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`materials.units.${unit}`)}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {/* ── Price + Currency ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.pricePerUnit')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price_per_unit}
                onChange={(e) => handleChange('price_per_unit', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.currency')}
              </label>
              <SelectField
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectField>
            </div>
          </div>

          {/* ── Width + Weight + Shrinkage ─────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.widthCm')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.width_cm}
                onChange={(e) => handleChange('width_cm', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.weightGsm')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.weight_gsm}
                onChange={(e) => handleChange('weight_gsm', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                {t('materials.shrinkage')}
              </label>
              <input
                type="text"
                value={form.shrinkage}
                onChange={(e) => handleChange('shrinkage', e.target.value)}
                placeholder="%"
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Error banner ─────────────────────────────── */}
          {error && (
            <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="material-form"
            disabled={saving}
            className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-900/90 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>
    </>
  );
}
