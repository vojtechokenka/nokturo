import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MODAL_HEADING_CLASS } from '../../lib/inputStyles';
import { useExchangeRates } from '../../lib/currency';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import {
  ProductSlideOver,
  type ProductWithMaterials,
  type ProductTechPack as TechPackType,
} from '../../components/ProductSlideOver';
import { RichTextBlockViewer, extractTags } from '../../components/RichTextBlockViewer';
import { TableOfContents } from '../../components/TableOfContents';
import type { TocItem } from '../../components/TableOfContents';
import { ProductGalleryComments } from '../../components/ProductGalleryComments';
import { MaterialDetailSlideOver } from '../../components/MaterialDetailSlideOver';
import type { Material } from '../../components/MaterialSlideOver';
import type { RichTextBlock } from '../../components/RichTextBlockEditor';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Scissors,
  Tag,
  X,
  MoreVertical,
} from 'lucide-react';

// ── Parse description (legacy or rich blocks) ────────────────────
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

const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-blue-600 text-white',
  pattern: 'bg-violet-600 text-white',
  prototype: 'bg-amber-600 text-white',
  production: 'bg-emerald-600 text-white',
  archived: 'bg-nokturo-500 text-white',
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  useExchangeRates();
  const [product, setProduct] = useState<ProductWithMaterials | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [lightbox, setLightbox] = useState<{
    gallery: { url: string; caption?: string }[];
    index: number;
    productId: string;
    galleryType: 'design' | 'moodboard';
  } | null>(null);
  const lightboxImgRef = useRef<HTMLDivElement>(null);
  const lightboxImgElementRef = useRef<HTMLImageElement>(null);
  const [loupe, setLoupe] = useState<{
    x: number;
    y: number;
    relX: number;
    relY: number;
  } | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setLoupe(null);
    setImgDimensions(null);
  }, [lightbox?.index]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
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
      `
      )
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (!error && data) setProduct(data as unknown as ProductWithMaterials);
      });
  }, [id]);

  const handleSaved = (productId?: string, options?: { autoSave?: boolean }) => {
    if (options?.autoSave) {
      if (id) {
        supabase
          .from('products')
          .select(
            `*, product_materials (id, material_id, consumption_amount, notes, role, variant, material:materials (*)), product_labels (id, label_id, placement, notes, label:labels (*, material:materials (*)))`
          )
          .eq('id', id)
          .single()
          .then(({ data }) => data && setProduct(data as ProductWithMaterials));
      }
      return;
    }
    setEditOpen(false);
    if (id) {
      supabase
        .from('products')
        .select(
          `*, product_materials (id, material_id, consumption_amount, notes, role, variant, material:materials (*)), product_labels (id, label_id, placement, notes, label:labels (*))`
        )
        .eq('id', id)
        .single()
        .then(({ data }) => data && setProduct(data as unknown as ProductWithMaterials));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      navigate('/production/products');
    }
    setDeleteConfirm(false);
  };

  if (loading) {
    return (
      <PageShell titleKey="pages.products.title" descriptionKey="pages.products.description">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-nokturo-500" />
        </div>
      </PageShell>
    );
  }

  if (!product) {
    return (
      <PageShell titleKey="pages.products.title" descriptionKey="pages.products.description">
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-nokturo-600 font-medium">{t('products.noProducts')}</p>
          <button
            onClick={() => navigate('/production/products')}
            className="mt-4 text-sm text-nokturo-600 hover:text-nokturo-900"
          >
            {t('common.back')}
          </button>
        </div>
      </PageShell>
    );
  }

  const tp = (product.tech_pack || {}) as TechPackType;
  const designGallery = tp.design_gallery || [];
  const moodboardGallery = tp.moodboard_gallery || [];
  const descriptionBlocks = parseDescriptionBlocks(
    product.description,
    (product as ProductWithMaterials & { description_blocks?: RichTextBlock[] }).description_blocks
  );
  const materials = product.product_materials ?? [];
  const labels = product.product_labels ?? [];
  const sectionTocItems: TocItem[] = [
    ...extractTags(descriptionBlocks),
    ...(materials.length > 0 ? [{ id: 'section-materials', text: t('products.materials.title'), level: 1 as const }] : []),
    ...(labels.length > 0 ? [{ id: 'section-labels', text: t('products.labels.title'), level: 1 as const }] : []),
    ...(designGallery.length > 0 ? [{ id: 'section-design-gallery', text: t('products.designGallery'), level: 1 as const }] : []),
    ...(moodboardGallery.length > 0 ? [{ id: 'section-moodboard-gallery', text: t('products.moodboardGallery'), level: 1 as const }] : []),
  ];

  return (
    <PageShell titleKey="pages.products.title" descriptionKey="pages.products.description">
      <div className={`max-w-[860px] mx-auto relative ${sectionTocItems.length > 0 ? 'pr-[264px]' : ''}`}>
        {/* Back + Actions */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/production/products')}
            className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
          <div className="relative">
            <button
              onClick={() => setPageMenuOpen((p) => !p)}
              className="p-2 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {pageMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPageMenuOpen(false)} />
                <div className="dropdown-menu absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 shadow-lg py-1 min-w-[140px] z-20">
                  <button
                    onClick={() => { setEditOpen(true); setPageMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t('common.edit')}
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => { setDeleteConfirm(true); setPageMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hero header */}
        <header className="mb-12">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-headline text-[32px] sm:text-[48px] leading-[1.2] font-normal text-nokturo-900 dark:text-nokturo-100">{product.name}</h1>
              {product.sku && (
                <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">SKU: {product.sku}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {product.priority && (
                  <span className="text-xs px-2 py-0.5 rounded-[4px] font-medium bg-red-600 text-white">
                    {t('products.priority')}
                  </span>
                )}
                {product.ready_for_sampling && (
                  <span className="text-xs px-2 py-0.5 rounded-[4px] font-medium bg-emerald-600 text-white">
                    {t('products.readyForSampling')}
                  </span>
                )}
              </div>
              <div className="flex items-stretch gap-4 sm:gap-6 mt-6 sm:mt-10 w-fit">
                <div>
                  <p className="text-[11px] text-nokturo-500 dark:text-nokturo-400 uppercase tracking-wider">{t('products.category')}</p>
                  <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 mt-0.5">
                    {product.category ? t(`products.categories.${product.category}`) : '—'}
                  </p>
                </div>
                <div className="w-px bg-nokturo-400 self-stretch shrink-0" aria-hidden />
                <div>
                  <p className="text-[11px] text-nokturo-500 dark:text-nokturo-400 uppercase tracking-wider">{t('products.status')}</p>
                  <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 mt-0.5">
                    {t(`products.statuses.${product.status}`)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Short description (always at top, 20px, weight 500) */}
        {product.short_description && (
          <p className="text-[20px] font-medium text-nokturo-900 dark:text-nokturo-100 mb-12">
            {product.short_description}
          </p>
        )}

        {/* Description (Ostatní - rich text) */}
        {descriptionBlocks.length > 0 && (
          <section id="section-description" className="mb-12 scroll-mt-6">
            <RichTextBlockViewer blocks={descriptionBlocks} showToc={false} headingFont="body" />
          </section>
        )}

        {/* Materials (grouped by version) */}
        {materials.length > 0 && (
          <section id="section-materials" className="mb-12 scroll-mt-6">
            <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
            <h2 className="font-body text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100 mb-4">
              {t('products.materials.title')}
            </h2>
            {(() => {
              const byVersion = materials.reduce<Record<string, typeof materials>>((acc, pm) => {
                const ver = pm.variant ?? '1';
                if (!acc[ver]) acc[ver] = [];
                acc[ver].push(pm);
                return acc;
              }, {});
              const versions = Object.keys(byVersion).sort((a, b) => {
                const na = parseInt(a, 10);
                const nb = parseInt(b, 10);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.localeCompare(b);
              });
              const getComposition = (mat: (typeof materials)[0]['material']) => {
                if (!mat) return null;
                const rows = (mat as { parameters?: { composition_rows?: { pct: number; fiber: string }[] } }).parameters?.composition_rows;
                if (rows && rows.length > 0) return rows.map((r) => `${r.pct}% ${r.fiber}`).join(', ');
                return mat.composition;
              };
              const getRoleLabel = (role: string) => {
                if (role === 'main') return t('products.materials.mainMaterial');
                if (role === 'pocket') return t('products.materials.pocketFabrics');
                return t(`products.materials.${role}`);
              };
              return (
                <div className="space-y-8">
                  {versions.map((version) => (
                    <div key={version} className="space-y-3">
                      <h3 className="text-heading-5 font-medium text-nokturo-800 dark:text-nokturo-200">
                        {version === '1' ? t('products.materials.primaryVersion') : `${t('products.materials.version')} ${version}`}
                      </h3>
                      <div className="space-y-2">
                        {byVersion[version].map((pm, idx) => {
                          const mat = pm.material;
                          const roleLabel = pm.role ? getRoleLabel(pm.role) : null;
                          const comp = getComposition(mat);
                          const gsm = mat?.weight_gsm != null ? `${mat.weight_gsm} g/m²` : null;
                          return (
                            <div
                              key={pm.id ?? idx}
                              className="flex items-start gap-4 p-4 bg-nokturo-50 dark:bg-nokturo-800 min-w-0"
                              style={{ borderRadius: '8px' }}
                            >
                              <button
                                type="button"
                                onClick={() => mat && setViewingMaterial(mat as Material)}
                                className="flex items-start gap-4 min-w-0 flex-1 text-left hover:opacity-90 transition-opacity cursor-pointer"
                              >
                                <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 flex items-center justify-center">
                                  {mat?.image_url ? (
                                    <img src={mat.image_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Scissors className="w-6 h-6 text-nokturo-400" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-nokturo-900 dark:text-nokturo-100 truncate">{mat?.name ?? '—'}</p>
                                  <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mt-0.5">
                                    {[roleLabel, comp, gsm].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="shrink-0 p-2 flex items-center justify-center self-center text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg transition-colors"
                                title={t('products.materials.replaceMaterial')}
                                aria-label={t('products.materials.replaceMaterial')}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>
        )}

        {/* Labels */}
        {labels.length > 0 && (() => {
          const labelsWithDesign = labels.filter((pl) => pl.label?.design_url);
          const labelsGallery = labelsWithDesign.map((pl) => ({
            url: pl.label!.design_url!,
            caption: pl.label?.name,
          }));
          return (
            <section id="section-labels" className="mb-12 scroll-mt-6">
<div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
            <h2 className="font-body text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100 mb-4">
              {t('products.labels.title')}
              </h2>
              <div className="space-y-2">
                {labels.map((pl, idx) => {
                  const indexInGallery = pl.label?.design_url ? labelsWithDesign.findIndex((l) => l === pl) : -1;
                  const hasDesign = !!pl.label?.design_url;
                  return (
                    <div
                      key={pl.id ?? idx}
                      role={hasDesign ? 'button' : undefined}
                      tabIndex={hasDesign ? 0 : undefined}
                      onClick={
                        hasDesign
                          ? () =>
                              product &&
                              setLightbox({
                                gallery: labelsGallery,
                                index: indexInGallery,
                                productId: product.id,
                                galleryType: 'labels',
                              })
                          : undefined
                      }
                      onKeyDown={
                        hasDesign
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                product &&
                                  setLightbox({
                                    gallery: labelsGallery,
                                    index: indexInGallery,
                                    productId: product.id,
                                    galleryType: 'labels',
                                  });
                              }
                            }
                          : undefined
                      }
                      className={
                        hasDesign
                          ? 'w-full flex items-start gap-4 p-4 bg-nokturo-50 dark:bg-nokturo-800 min-w-0 text-left hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors cursor-zoom-in'
                          : 'flex items-start gap-4 p-4 bg-nokturo-50 dark:bg-nokturo-800 min-w-0'
                      }
                      style={{ borderRadius: '8px' }}
                    >
                      {hasDesign ? (
                        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 flex items-center justify-center">
                          <img src={pl.label!.design_url!} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 flex items-center justify-center">
                          <Tag className="w-6 h-6 text-nokturo-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-nokturo-900 dark:text-nokturo-100 truncate">{pl.label?.name ?? '—'}</p>
                        <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mt-0.5">
                          {[
                            pl.label?.typ,
                            pl.label?.height_mm != null && pl.label?.width_mm != null
                              ? `${pl.label.height_mm} × ${pl.label.width_mm} mm`
                              : null,
                            pl.placement?.length
                              ? pl.placement
                                  .map((p) => (t(`labels.placements.${p}`) !== `labels.placements.${p}` ? t(`labels.placements.${p}`) : p))
                                  .join(', ')
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditOpen(true);
                        }}
                        className="shrink-0 p-2 flex items-center justify-center self-center text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg transition-colors"
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Design gallery */}
        {designGallery.length > 0 && (
          <section id="section-design-gallery" className="mb-12 scroll-mt-6">
            <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
            <h2 className="font-body text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100 mb-4">
              {t('products.designGallery')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {designGallery.map((img, i) => {
                const isSvg = img.url?.toLowerCase().endsWith('.svg');
                return (
                  <figure key={i}>
                    <button
                      type="button"
                      onClick={() =>
                      product &&
                      setLightbox({
                        gallery: designGallery,
                        index: i,
                        productId: product.id,
                        galleryType: 'design',
                      })
                    }
                      className="w-full text-left block cursor-zoom-in"
                    >
                      <img
                        src={img.url}
                        alt={img.caption ?? ''}
                        className={`w-full aspect-square rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors bg-nokturo-50 dark:bg-nokturo-800 ${
                          isSvg ? 'object-contain p-2' : 'object-cover'
                        }`}
                        style={isSvg ? { imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] } : undefined}
                      />
                    </button>
                  </figure>
                );
              })}
            </div>
          </section>
        )}

        {/* Moodboard gallery */}
        {moodboardGallery.length > 0 && (
          <section id="section-moodboard-gallery" className="mb-12 scroll-mt-6">
            <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
            <h2 className="font-body text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100 mb-4">
              {t('products.moodboardGallery')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {moodboardGallery.map((img, i) => (
                <figure key={i}>
                  <button
                    type="button"
                    onClick={() =>
                      product &&
                      setLightbox({
                        gallery: moodboardGallery,
                        index: i,
                        productId: product.id,
                        galleryType: 'moodboard',
                      })
                    }
                    className="w-full text-left block cursor-zoom-in"
                  >
                    <img
                      src={img.url}
                      alt={img.caption ?? ''}
                      className="w-full aspect-square object-cover rounded-lg transition-colors bg-nokturo-50 dark:bg-nokturo-800"
                    />
                  </button>
                  {img.caption && (
                    <figcaption className="mt-2 text-sm text-nokturo-600 dark:text-nokturo-400 text-center">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Lightbox overlay: photo (left) | comment section (right) – rendered in portal */}
        {lightbox &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col lg:flex-row"
              onClick={() => setLightbox(null)}
            >
            {/* 1. Photo area (left) */}
            <div className="flex-1 relative flex items-center justify-center min-w-0 min-h-[200px] p-4 order-1">
              {lightbox.gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index:
                                prev.index > 0
                                  ? prev.index - 1
                                  : prev.gallery.length - 1,
                            }
                          : null
                      );
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
                    aria-label="Previous"
                  >
                    <ArrowLeft className="w-8 h-8" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index:
                                prev.index < prev.gallery.length - 1
                                  ? prev.index + 1
                                  : 0,
                            }
                          : null
                      );
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white/90 transition-colors z-10"
                    aria-label="Next"
                  >
                    <ArrowRight className="w-8 h-8" />
                  </button>
                </>
              )}

              <div
                ref={lightboxImgRef}
                className={`relative flex items-center justify-center min-w-[200px] min-h-[200px] ${loupe ? 'cursor-none' : 'cursor-zoom-in'}`}
                onMouseMove={(e) => {
                  const containerEl = lightboxImgRef.current;
                  if (!containerEl) return;
                  const rect = containerEl.getBoundingClientRect();
                  const relX = (e.clientX - rect.left) / rect.width;
                  const relY = (e.clientY - rect.top) / rect.height;
                  if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
                    setLoupe({ x: e.clientX, y: e.clientY, relX, relY });
                  } else {
                    setLoupe(null);
                  }
                }}
                onMouseLeave={() => setLoupe(null)}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const url = lightbox.gallery[lightbox.index]?.url ?? '';
                  const isSvg = /\.svg(\?|$)/i.test(url);
                  const imgClass = 'max-w-full max-h-[50vh] lg:max-h-[90vh] w-auto h-auto object-contain rounded-lg';
                  if (isSvg) {
                    return (
                      <div className="w-[min(80vh,65vw)] lg:w-[min(80vh,calc(100vw-26rem))] aspect-square shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-nokturo-50 dark:bg-nokturo-800">
                        <img
                          src={url}
                          alt={lightbox.gallery[lightbox.index]?.caption ?? ''}
                          className="w-full h-full object-contain p-2"
                          style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
                        />
                      </div>
                    );
                  }
                  return (
                    <img
                      ref={lightboxImgElementRef}
                      src={url}
                      alt={lightbox.gallery[lightbox.index]?.caption ?? ''}
                      className={imgClass}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth && img.naturalHeight) {
                          setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                        }
                      }}
                    />
                  );
                })()}
                {loupe && imgDimensions && (() => {
                  const url = lightbox.gallery[lightbox.index]?.url ?? '';
                  const isSvg = /\.svg(\?|$)/i.test(url);
                  const zoom = isSvg ? 10 : 8;
                  const size = 250;
                  const center = size / 2;
                  const imgW = imgDimensions.w * zoom;
                  const imgH = imgDimensions.h * zoom;
                  const imgLeft = center - loupe.relX * imgW;
                  const imgTop = center - loupe.relY * imgH;
                  return (
                    <div
                      className="fixed w-[250px] h-[250px] pointer-events-none z-[10000] rounded-full border-2 border-white/80 overflow-hidden"
                      style={{
                        left: loupe.x - size / 2,
                        top: loupe.y - size / 2,
                      }}
                    >
                      <img
                        src={url}
                        alt=""
                        className="absolute"
                        style={{
                          width: imgW,
                          height: imgH,
                          left: imgLeft,
                          top: imgTop,
                        }}
                      />
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute top-4 left-4 p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-10"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>

              {lightbox.gallery.length > 1 && (
                <div className="absolute bottom-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
                  <p className="text-white/60 text-xs">
                    {lightbox.index + 1} / {lightbox.gallery.length}
                  </p>
                </div>
              )}
            </div>

            {/* 2. Comment section (right) – caption as title, then comments */}
            <div
              className="w-full lg:w-80 xl:w-96 bg-white dark:bg-nokturo-800 flex flex-col overflow-hidden shrink-0 max-h-[40vh] lg:max-h-none order-2"
              onClick={(e) => e.stopPropagation()}
            >
              {(lightbox.gallery[lightbox.index]?.caption) && (
                <div className="px-4 pt-3 pb-2 shrink-0">
                  <p className="text-nokturo-900 dark:text-nokturo-100 font-medium text-sm leading-tight">
                    {lightbox.gallery[lightbox.index].caption}
                  </p>
                </div>
              )}
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col px-4 pb-4">
                <ProductGalleryComments
                  productId={lightbox.productId}
                  galleryType={lightbox.galleryType}
                  imageIndex={lightbox.index}
                  hasCaptionAbove={!!lightbox.gallery[lightbox.index]?.caption}
                />
              </div>
            </div>
          </div>,
            document.body
          )}

        {/* Empty state when no content */}
        {descriptionBlocks.length === 0 &&
          materials.length === 0 &&
          designGallery.length === 0 &&
          moodboardGallery.length === 0 && (
            <div className="text-center py-16 text-nokturo-500 dark:text-nokturo-400">
              <p className="text-sm">{t('products.addFirst')}</p>
              <button
                onClick={() => setEditOpen(true)}
                className="mt-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
              >
                {t('common.edit')} →
              </button>
            </div>
          )}
      </div>

      {/* TOC – at top, no header offset */}
      {sectionTocItems.length > 0 && (
        <TableOfContents items={sectionTocItems} title={t('pages.products.title')} />
      )}

      {/* Edit slide-over */}
      <ProductSlideOver
        open={editOpen}
        product={product}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
        canDelete={canDelete}
      />

      <MaterialDetailSlideOver
        open={!!viewingMaterial}
        material={viewingMaterial}
        onClose={() => setViewingMaterial(null)}
        onEdit={() => {
          setViewingMaterial(null);
          navigate('/production/materials');
        }}
      />

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-nokturo-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className={`${MODAL_HEADING_CLASS} mb-2`}>{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">{t('products.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
