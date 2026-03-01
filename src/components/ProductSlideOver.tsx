import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuthStore, getUserIdForDb } from '../stores/authStore';
import { X, Loader2, Plus, Trash2, Search, Image as ImageIcon, GripVertical, RefreshCw, Tag } from 'lucide-react';
import { NotionSelect } from './NotionSelect';
import { SelectField } from './SelectField';
import { RichTextBlockEditor } from './RichTextBlockEditor';
import type { Material } from './MaterialSlideOver';
import type { Label } from './LabelSlideOver';
import type { NotionSelectOption } from './NotionSelect';

type MaterialWithSupplier = Material & { supplier?: { name: string } | null };
import type { RichTextBlock } from './RichTextBlockEditor';
import { ToastContainer } from './Toast';
import type { ToastData } from './Toast';
import { useExchangeRates, convertToCzk } from '../lib/currency';
import { UploadImageIcon } from './icons/UploadImageIcon';
import { MoodboardIcon } from './icons/MoodboardIcon';
import { INPUT_CLASS, MODAL_HEADING_CLASS } from '../lib/inputStyles';

// ── Constants ─────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = ['coats', 'jackets', 'trousers'] as const;

const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((cat, i) => ({
  id: cat,
  name: cat,
  color: ['gray', 'blue', 'green'][i] as string,
  sort_order: i,
}));
export const PRODUCT_STATUSES = [
  'concept',
  'pattern',
  'prototype',
  'production',
  'archived',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type MaterialRole = 'main' | 'lining' | 'pocket';

// ── Types ─────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  short_description?: string | null;
  description: string | null;
  description_blocks?: RichTextBlock[] | null;
  category: string | null;
  season: string | null;
  status: string;
  labor_cost: number;
  overhead_cost: number;
  markup_multiplier: number;
  tech_pack: ProductTechPack;
  images: string[];
  ready_for_sampling?: boolean;
  priority?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductTechPack {
  /** Preview/thumbnail photo for product cards (4:5 format) – separate from design_gallery */
  preview_photo_url?: string | null;
  design_gallery?: { url: string; caption?: string }[];
  moodboard_gallery?: { url: string; caption?: string; notes?: string }[];
  threads?: string;
  interlining?: string;
  waistband?: string;
  seam_allowance?: string;
  [key: string]: unknown;
}

export interface ProductMaterialRow {
  id: string;
  material_id: string;
  consumption_amount: number;
  notes: string | null;
  role?: MaterialRole;
  variant?: string | null;
  material: Material;
}

export interface ProductLabelRow {
  id: string;
  label_id: string;
  placement: string[];
  notes: string | null;
  label: Label;
}

export interface ProductWithMaterials extends Product {
  product_materials: ProductMaterialRow[];
  product_labels?: ProductLabelRow[];
}

// ── Local link model for labels (with placement) ─────────────────
interface LinkedLabel {
  label_id: string;
  label: Label;
  placement: string[];
}

// ── Local link model (for the form) ──────────────────────────
interface LinkedMaterial {
  material_id: string;
  material: Material;
  consumption_amount: number;
  role: MaterialRole;
  variant?: string;
}

interface GalleryImage {
  url: string;
  caption?: string;
  notes?: string;
}

// ── Form data ─────────────────────────────────────────────────
interface FormData {
  name: string;
  sku: string;
  category: string;
  status: string;
  ready_for_sampling: boolean;
  priority: boolean;
  short_description: string;
  labor_cost: string;
  overhead_cost: string;
  markup_multiplier: string;
  threads: string;
  interlining: string;
  waistband: string;
  seam_allowance: string;
}

const emptyForm: FormData = {
  name: '',
  sku: '',
  category: 'coats',
  status: 'concept',
  ready_for_sampling: false,
  priority: false,
  short_description: '',
  labor_cost: '0',
  overhead_cost: '0',
  markup_multiplier: '2.5',
  threads: '',
  interlining: '',
  waistband: '',
  seam_allowance: '',
};

const PRODUCT_DRAFT_KEY = 'nokturo-product-draft';
/** Debounce: only save to DB 1.8s after user stops typing — never save mid-edit */
const AUTO_SAVE_DEBOUNCE_MS = 1_800;

interface ProductDraft {
  form: FormData;
  descriptionBlocks: RichTextBlock[];
  linkedMaterials: LinkedMaterial[];
  linkedLabels?: LinkedLabel[];
  previewPhotoUrl: string | null;
  designGallery: GalleryImage[];
  moodboardGallery: GalleryImage[];
  savedAt: string;
}

// ── Parse description (legacy plain text or rich blocks) ───────
function parseDescriptionBlocks(
  desc: string | null | undefined,
  blocks: RichTextBlock[] | null | undefined
): RichTextBlock[] {
  if (blocks && Array.isArray(blocks) && blocks.length > 0) return blocks;
  if (desc && typeof desc === 'string') {
    try {
      const parsed = JSON.parse(desc);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* plain text */
    }
    return [{ id: `block_${Date.now()}`, type: 'paragraph', size: 'normal', content: desc }];
  }
  return [];
}

function saveDraftToStorage(draft: ProductDraft) {
  try {
    localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota exceeded or disabled */
  }
}

function loadDraftFromStorage(): ProductDraft | null {
  try {
    const raw = localStorage.getItem(PRODUCT_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProductDraft;
  } catch {
    return null;
  }
}

function clearDraftFromStorage() {
  try {
    localStorage.removeItem(PRODUCT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// ── Props ─────────────────────────────────────────────────────
interface ProductSlideOverProps {
  open: boolean;
  product: ProductWithMaterials | null;
  onClose: () => void;
  onSaved: (productId?: string, options?: { autoSave?: boolean }) => void;
  /** Only founder can delete. Hides remove material, delete version, etc. */
  canDelete?: boolean;
}

// ── Material section (reusable, per version) ───────────────────
function MaterialSection({
  title,
  role,
  version,
  materials,
  availableMaterials,
  linkedIdsInSection,
  onAdd,
  onRemove,
  onUpdateConsumption,
  pickerOpen,
  setPickerOpen,
  search,
  setSearch,
  t,
  inputClass,
  canDelete = true,
  hideHeaderButton = false,
}: {
  title: string;
  role: MaterialRole;
  version: string;
  materials: LinkedMaterial[];
  availableMaterials: MaterialWithSupplier[];
  linkedIdsInSection: Set<string>;
  onAdd: (mat: Material, version: string) => void;
  onRemove: (materialId: string, version: string, role: MaterialRole) => void;
  onUpdateConsumption: (materialId: string, amount: number, version: string, role: MaterialRole) => void;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  t: (key: string) => string;
  inputClass: string;
  canDelete?: boolean;
  hideHeaderButton?: boolean;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const filtered = availableMaterials.filter(
    (m) =>
      !linkedIdsInSection.has(m.id) &&
      (search === '' ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.composition ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setPickerOpen]);

  return (
    <div>
      {!hideHeaderButton && (
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center gap-2 text-sm font-medium text-nokturo-700 dark:text-nokturo-300 hover:text-nokturo-900 dark:hover:text-nokturo-100 mb-2 px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {title}
        </button>
      )}
      <div className="space-y-2 mb-2">
        {materials.map((lm) => (
          <div
            key={`${lm.material_id}-${lm.variant ?? ''}`}
            className="flex items-center gap-2 bg-nokturo-50 dark:bg-nokturo-700/50 rounded-lg p-2"
          >
            <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 dark:bg-nokturo-600">
              {lm.material.image_url ? (
                <img
                  src={lm.material.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : lm.material.color ? (
                <span
                  className="block w-full h-full"
                  style={{ backgroundColor: lm.material.color }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-nokturo-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-nokturo-900 dark:text-nokturo-100 truncate">{lm.material.name}</p>
              {lm.material.composition && (
                <p className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate">{lm.material.composition}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                step="0.01"
                min="0"
                value={lm.consumption_amount}
                onChange={(e) =>
                  onUpdateConsumption(lm.material_id, parseFloat(e.target.value) || 0, version, role)
                }
                className="w-16 h-11 bg-nokturo-200/60 rounded-[6px] px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-nokturo-500"
              />
              <span className="text-xs text-nokturo-500 w-6">{lm.material.unit}</span>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={() => onRemove(lm.material_id, version, role)}
                className="p-1 text-nokturo-500 hover:text-red-500 shrink-0"
                title={t('products.materials.remove')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div ref={pickerRef} className="relative">
        {pickerOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-nokturo-800 rounded-lg border border-nokturo-200 dark:border-nokturo-600 z-20 max-h-80 overflow-hidden flex flex-col">
            <div className="p-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nokturo-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('products.materials.searchMaterials')}
                  className="w-full h-11 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] pl-8 pr-3 py-1.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-60">
              {filtered.length === 0 ? (
                <p className="text-sm text-nokturo-500 dark:text-nokturo-400 p-2 text-center">{t('common.noData')}</p>
              ) : (
                filtered.map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => {
                      onAdd(mat, version);
                      setPickerOpen(false);
                      setSearch('');
                    }}
                    className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-nokturo-50 dark:hover:bg-nokturo-700"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-nokturo-100">
                      {mat.image_url ? (
                        <img
                          src={mat.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-nokturo-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 truncate">{mat.name}</p>
                      <p className="text-xs text-nokturo-500 dark:text-nokturo-400 mt-0.5">
                        {mat.price_per_unit} {mat.currency}/{mat.unit}
                        {mat.currency !== 'CZK' && ['EUR', 'USD'].includes(mat.currency) && (
                          <span className="text-nokturo-400">
                            {' '}≈ {convertToCzk(mat.price_per_unit, mat.currency).toFixed(2)} CZK
                          </span>
                        )}
                      </p>
                      {mat.supplier?.name && (
                        <p className="text-xs text-nokturo-400 mt-0.5 truncate">
                          {t('materials.supplier')}: {mat.supplier.name}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────
export function ProductSlideOver({
  open,
  product,
  onClose,
  onSaved,
  canDelete = true,
}: ProductSlideOverProps) {
  const { t } = useTranslation();
  useExchangeRates();
  const pickerRefs = useRef<{ main: HTMLDivElement | null; lining: HTMLDivElement | null; pocket: HTMLDivElement | null }>({ main: null, lining: null, pocket: null });

  const [form, setForm] = useState<FormData>(emptyForm);
  const [descriptionBlocks, setDescriptionBlocks] = useState<RichTextBlock[]>([]);
  const [linkedMaterials, setLinkedMaterials] = useState<LinkedMaterial[]>([]);
  const [linkedLabels, setLinkedLabels] = useState<LinkedLabel[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [labelTypes, setLabelTypes] = useState<{ id: string; name: string }[]>([]);
  const [placementOptions, setPlacementOptions] = useState<NotionSelectOption[]>([]);
  const [labelPickerType, setLabelPickerType] = useState<string | null>(null);
  const [labelSearch, setLabelSearch] = useState('');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [designGallery, setDesignGallery] = useState<GalleryImage[]>([]);
  const [moodboardGallery, setMoodboardGallery] = useState<GalleryImage[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<MaterialWithSupplier[]>([]);
  const [materialSearch, setMaterialSearch] = useState<Record<string, string>>({});
  const [showPicker, setShowPicker] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [galleryDragFrom, setGalleryDragFrom] = useState<{ gallery: 'design' | 'moodboard'; index: number } | null>(
    null
  );
  const [galleryDragOver, setGalleryDragOver] = useState<{ gallery: 'design' | 'moodboard'; index: number } | null>(
    null
  );
  const fileInputDesignRef = useRef<HTMLInputElement>(null);
  const fileInputMoodboardRef = useRef<HTMLInputElement>(null);
  const fileInputPreviewPhotoRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ gallery: 'design' | 'moodboard'; index: number } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showMoodboardPicker, setShowMoodboardPicker] = useState(false);
  const [moodboardPickerItems, setMoodboardPickerItems] = useState<
    { id: string; title: string | null; image_url: string; sub_images: { image_url: string }[] }[]
  >([]);
  const [moodboardPickerLoading, setMoodboardPickerLoading] = useState(false);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, { ...toast, id: toast.id || crypto.randomUUID() }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const contentType =
      file.type ||
      (ext.toLowerCase() === 'svg' ? 'image/svg+xml' : 'image/png');
    const { error } = await supabase.storage.from('uploads').upload(fileName, arrayBuffer, { contentType, cacheControl: '3600' });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
    return data.publicUrl;
  }, []);

  // ── Populate form when panel opens (or restore draft) ────────
  // Only sync when opening or switching product — NOT when parent refetches after auto-save
  const lastSyncedProductIdRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      lastSyncedProductIdRef.current = null;
      return;
    }
    const productId = product?.id ?? null;
    const justOpened = !wasOpenRef.current;
    const switchedProduct = lastSyncedProductIdRef.current !== productId;
    wasOpenRef.current = true;
    lastSyncedProductIdRef.current = productId;

    if (!justOpened && !switchedProduct) return;

    if (product) {
      const tp = (product.tech_pack || {}) as ProductTechPack;
      setForm({
        name: product.name,
        sku: product.sku || '',
        category: product.category || 'coats',
        status: product.status,
        ready_for_sampling: product.ready_for_sampling ?? false,
        priority: product.priority ?? false,
        short_description: (product as Product).short_description ?? '',
        labor_cost: (product.labor_cost ?? 0).toString(),
        overhead_cost: (product.overhead_cost ?? 0).toString(),
        markup_multiplier: (product.markup_multiplier ?? 2.5).toString(),
        threads: tp.threads ?? '',
        interlining: tp.interlining ?? '',
        waistband: tp.waistband ?? '',
        seam_allowance: tp.seam_allowance ?? '',
      });
      setDescriptionBlocks(
        parseDescriptionBlocks(
          product.description,
          (product as Product & { description_blocks?: RichTextBlock[] }).description_blocks
        )
      );
      const pm = product.product_materials || [];
      const all: LinkedMaterial[] = pm.map((p) => ({
        material_id: p.material_id,
        material: p.material,
        consumption_amount: p.consumption_amount,
        role: (p.role || 'main') as MaterialRole,
        variant: p.variant ?? '1',
      }));
      setLinkedMaterials(all);
      const pl = product.product_labels || [];
      setLinkedLabels(
        pl.map((p) => ({
          label_id: p.label_id,
          label: p.label,
          placement: p.placement || [],
        }))
      );
      setPreviewPhotoUrl(tp.preview_photo_url ?? null);
      setDesignGallery(tp.design_gallery || []);
      setMoodboardGallery(
        (tp.moodboard_gallery || []).map((img) => ({
          url: img.url,
          caption: img.caption,
          notes: img.notes,
        }))
      );
    } else {
      const draft = loadDraftFromStorage();
      if (draft) {
        setForm({ ...emptyForm, ...draft.form });
        setDescriptionBlocks(draft.descriptionBlocks || []);
        const draftMats = (draft.linkedMaterials || []).map((lm) => ({
          ...lm,
          variant: lm.variant ?? '1',
        }));
        setLinkedMaterials(draftMats);
        setLinkedLabels((draft as ProductDraft & { linkedLabels?: LinkedLabel[] }).linkedLabels ?? []);
        setPreviewPhotoUrl(draft.previewPhotoUrl ?? null);
        setDesignGallery(draft.designGallery || []);
        setMoodboardGallery(draft.moodboardGallery || []);
        addToast({ type: 'success', message: t('products.draftRestored') });
      } else {
        setForm(emptyForm);
        setDescriptionBlocks([]);
        setForm(emptyForm);
        setDescriptionBlocks([]);
        setLinkedMaterials([]);
        setLinkedLabels([]);
        setPreviewPhotoUrl(null);
        setDesignGallery([]);
        setMoodboardGallery([]);
      }
    }
    setMaterialSearch({});
    setShowPicker({});
    setLabelPickerType(null);
    setLabelSearch('');
    setExtraVersions(new Set());
    setReplaceTarget(null);
    setError('');
    setLastSavedAt(null);
  }, [product, open]);

  useEffect(() => {
    if (open) {
      supabase
        .from('materials')
        .select('*, supplier:suppliers(name)')
        .order('name')
        .then(({ data }) => data && setAvailableMaterials(data as MaterialWithSupplier[]));
      supabase
        .from('labels')
        .select('*, material:materials(*)')
        .order('name')
        .then(({ data }) => data && setAvailableLabels(data as Label[]));
      supabase
        .from('label_types')
        .select('id, name')
        .order('sort_order')
        .then(({ data }) => data && setLabelTypes(data as { id: string; name: string }[]));
      supabase
        .from('label_placement_options')
        .select('*')
        .order('sort_order')
        .then(({ data }) => {
          if (data) {
            setPlacementOptions(
              data.map((r: { id: string; name: string; color: string; sort_order: number }) => ({
                id: r.id,
                name: r.name,
                color: r.color || 'gray',
                sort_order: r.sort_order,
              }))
            );
          }
        });
    }
  }, [open]);

  useEffect(() => {
    if (!open) setShowMoodboardPicker(false);
  }, [open]);

  // ── Fetch moodboard items when picker opens ───────────────────
  useEffect(() => {
    if (!showMoodboardPicker || !open) return;
    setMoodboardPickerLoading(true);
    const fetchMoodboard = async () => {
      let { data, error } = await supabase
        .from('moodboard_items')
        .select('id, title, image_url, moodboard_item_images(image_url, sort_order)')
        .order('created_at', { ascending: false });
      if (error) {
        const fallback = await supabase.from('moodboard_items').select('id, title, image_url').order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      setMoodboardPickerLoading(false);
      if (error) {
        addToast({ id: crypto.randomUUID(), type: 'error', message: error.message });
        return;
      }
      const items = (data || []).map((row: { id: string; title: string | null; image_url: string; moodboard_item_images?: { image_url: string; sort_order: number }[] }) => ({
        id: row.id,
        title: row.title,
        image_url: row.image_url,
        sub_images: Array.isArray(row.moodboard_item_images)
          ? [...row.moodboard_item_images].sort((a, b) => a.sort_order - b.sort_order).map((si) => ({ image_url: si.image_url }))
          : [],
      }));
      setMoodboardPickerItems(items);
    };
    fetchMoodboard();
  }, [showMoodboardPicker, open, addToast]);

  const handleChange = (field: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const derivedVersions = (() => {
    const vs = new Set(linkedMaterials.map((lm) => lm.variant ?? '1').filter(Boolean));
    if (vs.size === 0) return ['1'];
    return Array.from(vs).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
  })();

  const [extraVersions, setExtraVersions] = useState<Set<string>>(new Set());
  const versions = (() => {
    const combined = new Set([...derivedVersions, ...extraVersions]);
    return Array.from(combined).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
  })();

  const materialsByVersionAndRole = (version: string, role: MaterialRole) =>
    linkedMaterials.filter((lm) => (lm.variant ?? '1') === version && lm.role === role);

  const addMaterial = (mat: Material, role: MaterialRole, version: string) => {
    setLinkedMaterials((prev) => [
      ...prev,
      { material_id: mat.id, material: mat, consumption_amount: 0, role, variant: version },
    ]);
  };

  const removeMaterial = (materialId: string, version: string, role: MaterialRole) => {
    setLinkedMaterials((prev) =>
      prev.filter(
        (lm) =>
          !(
            lm.material_id === materialId &&
            (lm.variant ?? '1') === version &&
            lm.role === role
          )
      )
    );
  };

  const updateConsumption = (
    materialId: string,
    amount: number,
    version: string,
    role: MaterialRole
  ) => {
    setLinkedMaterials((prev) =>
      prev.map((lm) =>
        lm.material_id === materialId &&
        (lm.variant ?? '1') === version &&
        lm.role === role
          ? { ...lm, consumption_amount: amount }
          : lm
      )
    );
  };

  const addVersion = () => {
    const next = String(
      Math.max(1, ...versions.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n)), 0) + 1
    );
    setExtraVersions((prev) => new Set(prev).add(next));
  };

  const removeVersion = (version: string) => {
    if (version === '1') return;
    setExtraVersions((prev) => {
      const next = new Set(prev);
      next.delete(version);
      return next;
    });
    setLinkedMaterials((prev) => prev.filter((lm) => (lm.variant ?? '1') !== version));
  };

  const addLabel = (lbl: Label) => {
    if (linkedLabels.some((ll) => ll.label_id === lbl.id)) return;
    setLinkedLabels((prev) => [...prev, { label_id: lbl.id, label: lbl, placement: [] }]);
    setLabelPickerType(null);
    setLabelSearch('');
  };

  const removeLabel = (labelId: string) => {
    setLinkedLabels((prev) => prev.filter((ll) => ll.label_id !== labelId));
  };

  const updateLabelPlacement = (labelId: string, placement: string[]) => {
    setLinkedLabels((prev) =>
      prev.map((ll) => (ll.label_id === labelId ? { ...ll, placement } : ll))
    );
  };

  const addGalleryImage = async (
    gallery: 'design' | 'moodboard',
    file: File
  ) => {
    try {
      const url = await handleUploadImage(file);
      if (gallery === 'design') {
        setDesignGallery((prev) => [...prev, { url, caption: '' }]);
      } else {
        setMoodboardGallery((prev) => [...prev, { url, caption: '' }]);
      }
    } catch (err) {
      addToast({ id: crypto.randomUUID(), type: 'error', message: (err as Error).message });
    }
  };

  const addMoodboardImageFromUrl = (url: string, caption?: string) => {
    setMoodboardGallery((prev) => [...prev, { url, caption: caption ?? '' }]);
  };

  const setPreviewPhoto = useCallback(async (file: File) => {
    try {
      const url = await handleUploadImage(file);
      setPreviewPhotoUrl(url);
    } catch (err) {
      addToast({ id: crypto.randomUUID(), type: 'error', message: (err as Error).message });
    }
  }, [handleUploadImage, addToast]);

  // Document-level paste for preview photo when slideover is open (Ctrl+V / printscreen)
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setPreviewPhoto(file);
            break;
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open, setPreviewPhoto]);

  const updateGalleryCaption = (
    gallery: 'design' | 'moodboard',
    index: number,
    caption: string
  ) => {
    if (gallery === 'design') {
      setDesignGallery((prev) =>
        prev.map((img, i) => (i === index ? { ...img, caption } : img))
      );
    } else {
      setMoodboardGallery((prev) =>
        prev.map((img, i) => (i === index ? { ...img, caption } : img))
      );
    }
  };
  const updateMoodboardNotes = (index: number, notes: string) => {
    setMoodboardGallery((prev) =>
      prev.map((img, i) => (i === index ? { ...img, notes } : img))
    );
  };
  const removeGalleryImage = (gallery: 'design' | 'moodboard', index: number) => {
    if (gallery === 'design') {
      setDesignGallery((prev) => prev.filter((_, i) => i !== index));
    } else {
      setMoodboardGallery((prev) => prev.filter((_, i) => i !== index));
    }
  };
  const replaceGalleryImage = async (
    gallery: 'design' | 'moodboard',
    index: number,
    file: File
  ) => {
    try {
      const url = await handleUploadImage(file);
      if (gallery === 'design') {
        setDesignGallery((prev) =>
          prev.map((img, i) => (i === index ? { ...img, url } : img))
        );
      } else {
        setMoodboardGallery((prev) =>
          prev.map((img, i) => (i === index ? { ...img, url } : img))
        );
      }
      setReplaceTarget(null);
    } catch (err) {
      addToast({ id: crypto.randomUUID(), type: 'error', message: (err as Error).message });
      setReplaceTarget(null);
    }
  };
  const moveGalleryImage = (
    gallery: 'design' | 'moodboard',
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;
    if (gallery === 'design') {
      setDesignGallery((prev) => {
        const next = [...prev];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        return next;
      });
    } else {
      setMoodboardGallery((prev) => {
        const next = [...prev];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        return next;
      });
    }
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (
    e: React.FormEvent,
    options?: { autoSave?: boolean }
  ) => {
    e?.preventDefault?.();
    setError('');
    if (!options?.autoSave && !form.name.trim()) {
      setError(t('products.nameRequired') || 'Product name is required');
      return;
    }
    setSaving(true);

    const techPack: ProductTechPack = {
      ...((product?.tech_pack as ProductTechPack) || {}),
      preview_photo_url: previewPhotoUrl || undefined,
      design_gallery: designGallery,
      moodboard_gallery: moodboardGallery,
      threads: form.threads || undefined,
      interlining: form.interlining || undefined,
      waistband: form.category === 'trousers' ? (form.waistband || undefined) : undefined,
      seam_allowance: form.category === 'trousers' ? (form.seam_allowance || undefined) : undefined,
    };
    const descriptionValue =
      descriptionBlocks.length > 0 ? JSON.stringify(descriptionBlocks) : null;

    const record = {
      name: form.name,
      sku: form.sku || null,
      category: form.category,
      status: form.status,
      ready_for_sampling: form.ready_for_sampling,
      priority: form.priority,
      short_description: form.short_description.trim() || null,
      description: descriptionValue,
      labor_cost: parseFloat(form.labor_cost) || 0,
      overhead_cost: parseFloat(form.overhead_cost) || 0,
      markup_multiplier: parseFloat(form.markup_multiplier) || 2.5,
      tech_pack: techPack,
      created_by: product ? product.created_by : getUserIdForDb(),
    };

    const { data: savedProduct, error: saveError } = product
      ? await supabase.from('products').update(record).eq('id', product.id).select().single()
      : await supabase.from('products').insert(record).select().single();

    if (saveError || !savedProduct) {
      setError(saveError?.message || 'Failed to save product');
      setSaving(false);
      return;
    }

    const productId = (savedProduct as Product).id;

    await supabase.from('product_materials').delete().eq('product_id', productId);

    const inserts = linkedMaterials.map((lm) => ({
      product_id: productId,
      material_id: lm.material_id,
      consumption_amount: lm.consumption_amount,
      notes: null,
      role: lm.role,
      variant: lm.variant || null,
    }));

    if (inserts.length > 0) {
      const { error: linkError } = await supabase
        .from('product_materials')
        .insert(inserts);
      if (linkError) {
        setError(linkError.message);
        setSaving(false);
        return;
      }
    }

    await supabase.from('product_labels').delete().eq('product_id', productId);
    const labelInserts = linkedLabels.map((ll) => ({
      product_id: productId,
      label_id: ll.label_id,
      placement: ll.placement,
      notes: null,
    }));
    if (labelInserts.length > 0) {
      const { error: labelLinkError } = await supabase
        .from('product_labels')
        .insert(labelInserts);
      if (labelLinkError) {
        setError(labelLinkError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    clearDraftFromStorage();
    if (options?.autoSave) {
      setLastSavedAt(new Date());
      addToast({ type: 'success', message: t('common.saved') });
    }
    onSaved(productId, options);
  };

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // ── Debounced auto-save to DB (existing product only) ─────────
  // Only save 1.8s after user stops typing — never save mid-edit
  useEffect(() => {
    if (!open || !product || saving) return;
    const timer = setTimeout(() => {
      handleSubmitRef.current?.(
        { preventDefault: () => {} } as React.FormEvent,
        { autoSave: true }
      );
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    open,
    product,
    saving,
    form,
    descriptionBlocks,
    linkedMaterials,
    linkedLabels,
    previewPhotoUrl,
    designGallery,
    moodboardGallery,
  ]);

  // ── Auto-save draft to localStorage (new product only) ────────
  useEffect(() => {
    if (!open || product) return;
    const id = setInterval(() => {
      const hasContent =
        form.name.trim() ||
        form.short_description.trim() ||
        descriptionBlocks.length > 0 ||
        linkedMaterials.length > 0 ||
        linkedLabels.length > 0 ||
        previewPhotoUrl ||
        designGallery.length > 0 ||
        moodboardGallery.length > 0;
      if (hasContent) {
        saveDraftToStorage({
          form,
          descriptionBlocks,
          linkedMaterials,
          linkedLabels,
          previewPhotoUrl,
          designGallery,
          moodboardGallery,
          savedAt: new Date().toISOString(),
        });
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [open, product, form, descriptionBlocks, linkedMaterials, previewPhotoUrl, designGallery, moodboardGallery]);

  const handleClose = () => {
    if (!product) {
      const hasContent =
        form.name.trim() ||
        form.short_description.trim() ||
        descriptionBlocks.length > 0 ||
        linkedMaterials.length > 0 ||
        linkedLabels.length > 0 ||
        previewPhotoUrl ||
        designGallery.length > 0 ||
        moodboardGallery.length > 0;
      if (hasContent) {
        saveDraftToStorage({
          form,
          descriptionBlocks,
          linkedMaterials,
          linkedLabels,
          previewPhotoUrl,
          designGallery,
          moodboardGallery,
          savedAt: new Date().toISOString(),
        });
        addToast({
          type: 'success',
          message: t('products.draftSaved'),
        });
      }
    }
    onClose();
  };

  if (!open) return null;

  const inputClass = INPUT_CLASS;

  const slideOverContent = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="fixed inset-y-0 right-0 z-[9999] w-full max-w-2xl bg-nokturo-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className={MODAL_HEADING_CLASS}>
              {product ? t('products.editProduct') : t('products.addProduct')}
            </h3>
            {product && lastSavedAt && (
              <p className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate">
                {t('common.lastSaved')} {lastSavedAt.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5 bg-nokturo-900"
        >
          {/* 1. Name */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('products.name')} *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* 2. SKU */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('products.sku')}</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => handleChange('sku', e.target.value)}
              placeholder="e.g. WOC-001"
              className={inputClass}
            />
          </div>

          {/* 3. Category */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('products.category')}</label>
            <NotionSelect
              value={form.category}
              onChange={(v) => handleChange('category', v)}
              options={PRODUCT_CATEGORY_OPTIONS}
              optionsI18nKey="products.categories"
              dropdownZIndex={10000}
            />
          </div>

          {/* 4. Status */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">{t('products.status')}</label>
            <SelectField
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className={inputClass}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`products.statuses.${s}`)}
                </option>
              ))}
            </SelectField>
          </div>

          {/* Ready for sampling */}
          <div className="flex items-center justify-between">
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400">{t('products.readyForSampling')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.ready_for_sampling}
              onClick={() => {
                const next = !form.ready_for_sampling;
                setForm((prev) => ({ ...prev, ready_for_sampling: next, priority: next ? prev.priority : false }));
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-nokturo-400 focus:ring-offset-2 dark:focus:ring-offset-nokturo-900 ${
                form.ready_for_sampling ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-nokturo-400 dark:bg-nokturo-600'
              }`}
            >
              <span
                className={`pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 block h-5 w-5 shrink-0 rounded-full bg-white shadow transition-all duration-200 ease-out ${
                  form.ready_for_sampling ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Priority (only when ready for sampling) */}
          {form.ready_for_sampling && (
            <div className="flex items-center justify-between">
              <label className="block text-sm text-nokturo-700 dark:text-nokturo-400">{t('products.priority')}</label>
              <button
                type="button"
                role="switch"
                aria-checked={form.priority}
                onClick={() => handleChange('priority', !form.priority)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-nokturo-400 focus:ring-offset-2 dark:focus:ring-offset-nokturo-900 ${
                  form.priority ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-nokturo-400 dark:bg-nokturo-600'
                }`}
              >
                <span
                  className={`pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 block h-5 w-5 shrink-0 rounded-full bg-white shadow transition-all duration-200 ease-out ${
                    form.priority ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Náhledová fotka (Preview photo) – 4:5 format, used on product cards. Same style as Moodboard drop zone. */}
          <div>
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
              {t('products.previewPhoto')}
            </label>
            <input
              ref={fileInputPreviewPhotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPreviewPhoto(f);
                e.target.value = '';
              }}
            />
            {previewPhotoUrl ? (
              <div className="flex gap-3 items-start">
                <div className="w-24 shrink-0 aspect-[4/5] rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => fileInputPreviewPhotoRef.current?.click()}
                    className="w-full h-full block group"
                  >
                    <img
                      src={previewPhotoUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputPreviewPhotoRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t('products.replaceImage')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoUrl(null)}
                    className="flex items-center gap-2 text-sm bg-red-500 text-white hover:bg-red-600 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputPreviewPhotoRef.current?.click()}
                onClick={() => fileInputPreviewPhotoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = e.dataTransfer?.files;
                  const file = files?.[0];
                  if (file?.type.startsWith('image/')) setPreviewPhoto(file);
                }}
                className="flex items-center gap-2 h-20 px-3 py-2 rounded-[6px] text-nokturo-500 dark:text-nokturo-400 border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 bg-transparent hover:border-nokturo-400 dark:hover:border-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors text-sm w-full justify-center cursor-pointer"
              >
                <UploadImageIcon className="w-4 h-4" size={16} />
                {t('ideas.uploadImage')}
              </div>
            )}
          </div>

          {/* 7. Description (short paragraph, 20px, weight 500) */}
          <div className="pt-4">
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-2">{t('products.description')}</label>
            <textarea
              value={form.short_description}
              onChange={(e) => handleChange('short_description', e.target.value)}
              placeholder={t('products.shortDescriptionPlaceholder')}
              rows={3}
              className={`${inputClass} h-auto min-h-[80px] text-[20px] font-medium`}
            />
          </div>

          {/* 8. Ostatní (rich text) */}
          <div className="pt-4">
            <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-2">Ostatní</label>
            <div className="bg-nokturo-50/50 dark:bg-nokturo-700/50 rounded-lg p-4">
              <RichTextBlockEditor
                value={descriptionBlocks}
                onChange={setDescriptionBlocks}
                onUploadImage={handleUploadImage}
                onToast={addToast}
                headingFont="body"
              />
            </div>
          </div>

          {/* 9. Materials: Primary version materials + Add version */}
          <div className="pt-4 space-y-4">
            {versions.map((version) => {
              const mainMats = materialsByVersionAndRole(version, 'main');
              const liningMats = materialsByVersionAndRole(version, 'lining');
              const pocketMats = materialsByVersionAndRole(version, 'pocket');
              const pickerKey = (role: MaterialRole) => `${version}_${role}`;
              const versionLabel =
                version === '1'
                  ? t('products.materials.primaryVersionMaterials')
                  : version === '2'
                    ? t('products.materials.secondaryVersion')
                    : version === '3'
                      ? t('products.materials.tertiaryVersion')
                      : `${t('products.materials.version')} ${version}`;
              return (
                <div key={version} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">
                      {version === '1' ? t('products.materials.primaryVersion') : versionLabel}
                    </h4>
                    {version !== '1' && canDelete && (
                      <button
                        type="button"
                        onClick={() => removeVersion(version)}
                        className="text-xs font-medium px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={() =>
                          setShowPicker((p) => ({ ...p, [pickerKey('main')]: !p[pickerKey('main')] }))
                        }
                        className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-nokturo-700 dark:text-nokturo-300 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {t('products.materials.primaryMaterial')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowPicker((p) => ({ ...p, [pickerKey('lining')]: !p[pickerKey('lining')] }))
                        }
                        className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-nokturo-700 dark:text-nokturo-300 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {t('products.materials.liningMaterial')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowPicker((p) => ({ ...p, [pickerKey('pocket')]: !p[pickerKey('pocket')] }))
                        }
                        className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-nokturo-700 dark:text-nokturo-300 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {t('products.materials.pocket')}
                      </button>
                    </div>
                  <MaterialSection
                    title={t('products.materials.primaryMaterial')}
                    role="main"
                    version={version}
                    materials={mainMats}
                    availableMaterials={availableMaterials}
                    linkedIdsInSection={new Set(mainMats.map((m) => m.material_id))}
                    onAdd={(mat, v) => addMaterial(mat, 'main', v)}
                    onRemove={(id, v, r) => removeMaterial(id, v, r)}
                    onUpdateConsumption={updateConsumption}
                    pickerOpen={showPicker[pickerKey('main')] ?? false}
                    setPickerOpen={(v) =>
                      setShowPicker((p) => ({ ...p, [pickerKey('main')]: v }))
                    }
                    search={materialSearch[pickerKey('main')] ?? ''}
                    setSearch={(v) =>
                      setMaterialSearch((s) => ({ ...s, [pickerKey('main')]: v }))
                    }
                    t={t}
                    inputClass={inputClass}
                    canDelete={canDelete}
                    hideHeaderButton
                  />
                  <MaterialSection
                    title={t('products.materials.liningMaterial')}
                    role="lining"
                    version={version}
                    materials={liningMats}
                    availableMaterials={availableMaterials}
                    linkedIdsInSection={new Set(liningMats.map((m) => m.material_id))}
                    onAdd={(mat, v) => addMaterial(mat, 'lining', v)}
                    onRemove={(id, v, r) => removeMaterial(id, v, r)}
                    onUpdateConsumption={updateConsumption}
                    pickerOpen={showPicker[pickerKey('lining')] ?? false}
                    setPickerOpen={(v) =>
                      setShowPicker((p) => ({ ...p, [pickerKey('lining')]: v }))
                    }
                    search={materialSearch[pickerKey('lining')] ?? ''}
                    setSearch={(v) =>
                      setMaterialSearch((s) => ({ ...s, [pickerKey('lining')]: v }))
                    }
                    t={t}
                    inputClass={inputClass}
                    canDelete={canDelete}
                    hideHeaderButton
                  />
                  <MaterialSection
                    title={t('products.materials.pocket')}
                    role="pocket"
                    version={version}
                    materials={pocketMats}
                    availableMaterials={availableMaterials}
                    linkedIdsInSection={new Set(pocketMats.map((m) => m.material_id))}
                    onAdd={(mat, v) => addMaterial(mat, 'pocket', v)}
                    onRemove={(id, v, r) => removeMaterial(id, v, r)}
                    onUpdateConsumption={updateConsumption}
                    pickerOpen={showPicker[pickerKey('pocket')] ?? false}
                    setPickerOpen={(v) =>
                      setShowPicker((p) => ({ ...p, [pickerKey('pocket')]: v }))
                    }
                    search={materialSearch[pickerKey('pocket')] ?? ''}
                    setSearch={(v) =>
                      setMaterialSearch((s) => ({ ...s, [pickerKey('pocket')]: v }))
                    }
                    t={t}
                    inputClass={inputClass}
                    canDelete={canDelete}
                    hideHeaderButton
                  />
                </div>
              );
            })}
            <button
              type="button"
              onClick={addVersion}
              className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200"
            >
              <Plus className="w-4 h-4" />
              {t('products.materials.addVersion')}
            </button>
          </div>

          {/* 9b. Labels (with placement when connected) – same layout as materials */}
          <div className="pt-4 space-y-4">
            <label className="block text-sm font-semibold text-nokturo-900 dark:text-nokturo-100 mb-2">
              {t('products.labels.title')}
            </label>
            <div className="flex gap-2 w-full flex-wrap">
              {labelTypes.length > 0 ? (
                labelTypes.map((lt) => (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() =>
                      setLabelPickerType((p) => (p === lt.name ? null : lt.name))
                    }
                    className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                      labelPickerType === lt.name
                        ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100'
                        : 'text-nokturo-700 dark:text-nokturo-300 hover:text-nokturo-900 dark:hover:text-nokturo-100 bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {t(`labels.types.${lt.name}`) !== `labels.types.${lt.name}` ? t(`labels.types.${lt.name}`) : lt.name}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setLabelPickerType((p) => (p ? null : 'all'))}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-nokturo-700 dark:text-nokturo-300 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-3 py-2 rounded-lg bg-nokturo-100 dark:bg-nokturo-700 hover:bg-nokturo-200/80 dark:hover:bg-nokturo-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('products.labels.addLabel')}
                </button>
              )}
            </div>
            {labelPickerType && (
              <div className="relative bg-white dark:bg-nokturo-700/50 rounded-lg border border-nokturo-200 dark:border-nokturo-600 p-2 max-h-60 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nokturo-500" />
                    <input
                      type="text"
                      value={labelSearch}
                      onChange={(e) => setLabelSearch(e.target.value)}
                      placeholder={t('products.labels.searchLabels')}
                      className="w-full h-11 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] pl-8 pr-3 py-1.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLabelPickerType(null)}
                    className="p-1.5 text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-600"
                    title={t('common.cancel')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {availableLabels
                    .filter(
                      (l) =>
                        !linkedLabels.some((ll) => ll.label_id === l.id) &&
                        (labelPickerType === 'all' || (l.typ ?? '') === labelPickerType) &&
                        (labelSearch === '' ||
                          l.name.toLowerCase().includes(labelSearch.toLowerCase()) ||
                          (l.typ ?? '').toLowerCase().includes(labelSearch.toLowerCase()))
                    )
                    .map((lbl) => (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => addLabel(lbl)}
                        className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-nokturo-50 dark:hover:bg-nokturo-700 rounded"
                      >
                        <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-nokturo-100">
                          {lbl.design_url ? (
                            <img
                              src={lbl.design_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-nokturo-400">
                              <Tag className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 truncate">{lbl.name}</p>
                          <p className="text-xs text-nokturo-500 truncate">{lbl.typ}</p>
                        </div>
                      </button>
                    ))}
                  {availableLabels.filter(
                    (l) =>
                      !linkedLabels.some((ll) => ll.label_id === l.id) &&
                      (labelPickerType === 'all' || (l.typ ?? '') === labelPickerType) &&
                      (labelSearch === '' ||
                        l.name.toLowerCase().includes(labelSearch.toLowerCase()) ||
                        (l.typ ?? '').toLowerCase().includes(labelSearch.toLowerCase()))
                  ).length === 0 && (
                    <p className="text-sm text-nokturo-500 dark:text-nokturo-400 p-2 text-center">{t('common.noData')}</p>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {linkedLabels.map((ll) => (
                <div
                  key={ll.label_id}
                  className="flex flex-col gap-2 bg-nokturo-50 dark:bg-nokturo-700/50 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-nokturo-100">
                      {ll.label.design_url ? (
                        <img
                          src={ll.label.design_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-nokturo-400">
                          <Tag className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 truncate">{ll.label.name}</p>
                      <p className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate">{ll.label.typ}</p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => removeLabel(ll.label_id)}
                        className="p-1 text-nokturo-500 hover:text-red-500 shrink-0"
                        title={t('products.materials.remove')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-nokturo-600 dark:text-nokturo-400 mb-1">
                      {t('products.labels.placement')}
                    </label>
                    <NotionSelect
                      value={ll.placement}
                      onChange={(v) =>
                        updateLabelPlacement(ll.label_id, Array.isArray(v) ? v : [])
                      }
                      options={placementOptions}
                      dropdownZIndex={99999}
                      onOptionsChange={async (opts) => {
                        const prevById = new Map(placementOptions.map((o) => [o.id, o]));
                        setPlacementOptions(opts);
                        try {
                          for (const opt of opts) {
                            if (!prevById.has(opt.id)) {
                              await supabase.from('label_placement_options').insert({
                                id: opt.id,
                                name: opt.name,
                                color: opt.color,
                                sort_order: opt.sort_order,
                              });
                            } else {
                              const prev = prevById.get(opt.id);
                              if (prev && (prev.name !== opt.name || prev.color !== opt.color || prev.sort_order !== opt.sort_order)) {
                                await supabase
                                  .from('label_placement_options')
                                  .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                                  .eq('id', opt.id);
                              }
                            }
                          }
                          for (const o of placementOptions) {
                            if (!opts.some((n) => n.id === o.id)) {
                              await supabase.from('label_placement_options').delete().eq('id', o.id);
                            }
                          }
                        } catch {
                          setPlacementOptions(placementOptions);
                        }
                      }}
                      multiple
                      placeholder={t('products.labels.selectPlacement')}
                      optionsI18nKey="labels.placements"
                      canDelete={canDelete}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 10. Design gallery */}
          <div className="pt-4">
            <label className="block text-sm font-semibold text-nokturo-900 dark:text-nokturo-100 mb-2">
              {t('products.designGallery')}
            </label>
            <input
              ref={fileInputDesignRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addGalleryImage('design', f);
                e.target.value = '';
              }}
            />
            <input
              ref={replaceFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && replaceTarget) {
                  replaceGalleryImage(replaceTarget.gallery, replaceTarget.index, f);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputDesignRef.current?.click()}
              className="w-full h-[60px] mb-3 rounded-[6px] flex items-center justify-center gap-2 text-nokturo-500 dark:text-nokturo-400 border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 bg-transparent hover:border-nokturo-400 dark:hover:border-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors"
            >
              <UploadImageIcon className="w-4 h-4" size={16} />
              <span className="text-sm">{t('products.uploadImages')}</span>
            </button>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {designGallery.map((img, i) => {
                const isDragging =
                  galleryDragFrom?.gallery === 'design' && galleryDragFrom?.index === i;
                const isDragOver =
                  galleryDragOver?.gallery === 'design' && galleryDragOver?.index === i;
                return (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setGalleryDragFrom({ gallery: 'design', index: i })}
                    onDragEnd={() => {
                      setGalleryDragFrom(null);
                      setGalleryDragOver(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setGalleryDragOver({ gallery: 'design', index: i });
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setGalleryDragOver((prev) =>
                          prev?.gallery === 'design' && prev?.index === i ? null : prev
                        );
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setGalleryDragOver(null);
                      if (galleryDragFrom?.gallery === 'design') {
                        moveGalleryImage('design', galleryDragFrom.index, i);
                        setGalleryDragFrom(null);
                      }
                    }}
                    className={`relative group cursor-grab active:cursor-grabbing transition-opacity ${
                      isDragging ? 'opacity-50' : ''
                    } ${isDragOver ? 'ring-2 ring-nokturo-400 ring-offset-2 rounded-lg' : ''}`}
                  >
                    <div className="absolute top-0 left-0 p-1 bg-nokturo-900 z-10" style={{ borderBottomRightRadius: '8px', paddingBottom: '6px', paddingRight: '6px' }}>
                      <GripVertical className="w-3.5 h-3.5 text-nokturo-500" />
                    </div>
                    <img
                      src={img.url}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg pointer-events-none bg-nokturo-50"
                    />
                    <input
                      type="text"
                      value={img.caption ?? ''}
                      onChange={(e) => updateGalleryCaption('design', i, e.target.value)}
                      placeholder={t('products.designGalleryCaption')}
                      className="mt-1 w-full h-[40px] text-xs bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] px-4 py-1 text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500"
                    />
                    <div className="absolute top-1 right-1 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceTarget({ gallery: 'design', index: i });
                          replaceFileInputRef.current?.click();
                        }}
                        className="p-1 bg-white/90 dark:bg-nokturo-800/90 text-nokturo-600 dark:text-nokturo-400 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
                        title={t('products.replaceImage')}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGalleryImage('design', i)}
                        className="p-1 bg-red-500/80 text-white rounded hover:bg-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 11. Moodboard gallery */}
          <div className="pt-4">
            <label className="block text-sm font-semibold text-nokturo-900 dark:text-nokturo-100 mb-2">
              {t('products.moodboardGallery')}
            </label>
            <input
              ref={fileInputMoodboardRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addGalleryImage('moodboard', f);
                e.target.value = '';
              }}
            />
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                onClick={() => fileInputMoodboardRef.current?.click()}
                className="flex-1 h-[60px] rounded-[6px] flex items-center justify-center gap-2 text-nokturo-500 dark:text-nokturo-400 border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 bg-transparent hover:border-nokturo-400 dark:hover:border-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors"
              >
                <UploadImageIcon className="w-4 h-4" size={16} />
                <span className="text-sm">{t('products.uploadImages')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMoodboardPicker(true)}
                className="flex-1 h-[60px] rounded-[6px] flex items-center justify-center gap-2 text-nokturo-500 dark:text-nokturo-400 border-2 border-dashed border-nokturo-300 dark:border-nokturo-600 bg-transparent hover:border-nokturo-400 dark:hover:border-nokturo-500 hover:text-nokturo-600 dark:hover:text-nokturo-300 transition-colors"
              >
                <MoodboardIcon className="w-4 h-4 shrink-0" size={16} />
                <span className="text-sm">{t('products.pickFromMoodboard')}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {moodboardGallery.map((img, i) => {
                const isDragging =
                  galleryDragFrom?.gallery === 'moodboard' && galleryDragFrom?.index === i;
                const isDragOver =
                  galleryDragOver?.gallery === 'moodboard' && galleryDragOver?.index === i;
                return (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setGalleryDragFrom({ gallery: 'moodboard', index: i })}
                    onDragEnd={() => {
                      setGalleryDragFrom(null);
                      setGalleryDragOver(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setGalleryDragOver({ gallery: 'moodboard', index: i });
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setGalleryDragOver((prev) =>
                          prev?.gallery === 'moodboard' && prev?.index === i ? null : prev
                        );
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setGalleryDragOver(null);
                      if (galleryDragFrom?.gallery === 'moodboard') {
                        moveGalleryImage('moodboard', galleryDragFrom.index, i);
                        setGalleryDragFrom(null);
                      }
                    }}
                    className={`relative group cursor-grab active:cursor-grabbing transition-opacity ${
                      isDragging ? 'opacity-50' : ''
                    } ${isDragOver ? 'ring-2 ring-nokturo-400 ring-offset-2 rounded-lg' : ''}`}
                  >
                    <div className="absolute top-0 left-0 p-1 bg-nokturo-900 z-10" style={{ borderBottomRightRadius: '8px', paddingBottom: '6px', paddingRight: '6px' }}>
                      <GripVertical className="w-3.5 h-3.5 text-nokturo-500" />
                    </div>
                    <img
                      src={img.url}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg pointer-events-none bg-nokturo-50"
                    />
                    <input
                      type="text"
                      value={img.caption ?? ''}
                      onChange={(e) => updateGalleryCaption('moodboard', i, e.target.value)}
                      placeholder={t('products.designGalleryCaption')}
                      className="mt-1 w-full h-[40px] text-xs bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] px-4 py-1 text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500"
                    />
                    <textarea
                      value={img.notes ?? ''}
                      onChange={(e) => updateMoodboardNotes(i, e.target.value)}
                      placeholder={t('products.moodboardNotesPlaceholder')}
                      rows={2}
                      className="mt-1 w-full h-11 text-xs bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-[6px] px-2 py-1 text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 dark:placeholder-nokturo-500"
                    />
                    <div className="absolute top-1 right-1 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceTarget({ gallery: 'moodboard', index: i });
                          replaceFileInputRef.current?.click();
                        }}
                        className="p-1 bg-white/90 dark:bg-nokturo-800/90 text-nokturo-600 dark:text-nokturo-400 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
                        title={t('products.replaceImage')}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGalleryImage('moodboard', i)}
                        className="p-1 bg-red-500/80 text-white rounded hover:bg-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Costing (hidden, kept for compatibility) */}
          <div className="hidden pt-4">
            <h4 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3">
              {t('products.costing.title')}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                  {t('products.costing.laborCost')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.labor_cost}
                  onChange={(e) => handleChange('labor_cost', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                  {t('products.costing.overheadCost')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.overhead_cost}
                  onChange={(e) => handleChange('overhead_cost', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">
                  {t('products.costing.markupMultiplier')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.markup_multiplier}
                  onChange={(e) => handleChange('markup_multiplier', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-nokturo-200 dark:border-nokturo-600 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="px-5 py-2 text-sm bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white font-medium rounded-lg hover:bg-nokturo-900/90 dark:hover:bg-nokturo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>

      {/* Moodboard picker modal */}
      {showMoodboardPicker && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowMoodboardPicker(false)}
        >
          <div
            className="bg-white dark:bg-nokturo-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-nokturo-200 dark:border-nokturo-600 shrink-0">
              <h4 className="text-heading-5 font-medium text-nokturo-900 dark:text-nokturo-100">
                {t('products.pickFromMoodboard')}
              </h4>
              <button
                type="button"
                onClick={() => setShowMoodboardPicker(false)}
                className="p-2 text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {moodboardPickerLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-nokturo-500" />
                </div>
              ) : moodboardPickerItems.length === 0 ? (
                <p className="text-center text-nokturo-500 dark:text-nokturo-400 py-8">
                  {t('products.noMoodboardItems')}
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {moodboardPickerItems.flatMap((item) => {
                    const images = [item.image_url, ...item.sub_images.map((si) => si.image_url)];
                    return images.map((url, idx) => (
                      <button
                        key={`${item.id}-${idx}`}
                        type="button"
                        onClick={() => {
                          addMoodboardImageFromUrl(url, item.title ?? undefined);
                        }}
                        className="aspect-square rounded-lg overflow-hidden bg-nokturo-100 dark:bg-nokturo-700 hover:ring-2 hover:ring-nokturo-500 focus:outline-none focus:ring-2 focus:ring-nokturo-500"
                      >
                        <img
                          src={url}
                          alt={item.title ?? ''}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ));
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );

  return createPortal(slideOverContent, document.body);
}
