import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { CommentableRichTextViewer } from '../../components/CommentableRichTextViewer';
import { MaterialDetailSlideOver } from '../../components/MaterialDetailSlideOver';
import type { Material } from '../../components/MaterialSlideOver';
import { TableOfContents } from '../../components/TableOfContents';
import type { TocItem } from '../../components/TableOfContents';
import type { ProductWithMaterials, ProductTechPack as TechPackType } from '../../components/ProductSlideOver';
import type { RichTextBlock } from '../../components/RichTextBlockEditor';
import { ArrowLeft, ArrowRight, Loader2, Package, Scissors, Tag, X } from 'lucide-react';
import { ProductGalleryComments } from '../../components/ProductGalleryComments';

/** Syncs TOC items when description is empty but sections (materials, labels, etc.) exist */
function TocItemsSync({ items, onItems }: { items: TocItem[]; onItems: (items: TocItem[]) => void }) {
  const prevKeyRef = useRef<string>();
  const itemsKey = JSON.stringify(items.map((i) => [i.id, i.text, i.level]));
  useEffect(() => {
    if (prevKeyRef.current !== itemsKey) {
      prevKeyRef.current = itemsKey;
      onItems(items);
    }
    return () => {
      prevKeyRef.current = undefined;
      onItems([]);
    };
  }, [itemsKey, items, onItems]);
  return null;
}

const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-blue-100 text-blue-700',
  pattern: 'bg-purple-100 text-purple-700',
  prototype: 'bg-amber-100 text-amber-700',
  production: 'bg-green-100 text-green-700',
  archived: 'bg-nokturo-200 text-nokturo-700',
};

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

export default function SamplingDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [product, setProduct] = useState<ProductWithMaterials | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    setLoupe(null);
  }, [lightbox?.index]);

  const fetchProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select(
        `*,
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
          label:labels (*)
        )`
      )
      .eq('id', productId)
      .eq('ready_for_sampling', true)
      .single();
    setLoading(false);
    if (!error && data) setProduct(data as unknown as ProductWithMaterials);
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // ── Real-time: update produktu na stránce Produkty se projeví i tady ──
  useEffect(() => {
    if (!productId) return;
    const productsChannel = supabase
      .channel(`sampling-detail-products-${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          if ((payload.new as { id?: string })?.id === productId) fetchProduct();
        },
      )
      .subscribe();

    const pmChannel = supabase
      .channel(`sampling-detail-pm-${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_materials' },
        (payload) => {
          const pid = (payload.new as { product_id?: string })?.product_id ??
            (payload.old as { product_id?: string })?.product_id;
          if (pid === productId) fetchProduct();
        },
      )
      .subscribe();

    const plChannel = supabase
      .channel(`sampling-detail-pl-${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_labels' },
        (payload) => {
          const pid = (payload.new as { product_id?: string })?.product_id ??
            (payload.old as { product_id?: string })?.product_id;
          if (pid === productId) fetchProduct();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(pmChannel);
      supabase.removeChannel(plChannel);
    };
  }, [productId, fetchProduct]);

  const descriptionBlocks = product
    ? parseDescriptionBlocks(
        product.description,
        (product as ProductWithMaterials & { description_blocks?: RichTextBlock[] }).description_blocks
      )
    : [];
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  useEffect(() => {
    if (descriptionBlocks.length === 0) setTocItems([]);
  }, [descriptionBlocks.length]);

  if (loading) {
    return (
      <PageShell
        titleKey="pages.readyForSampling.title"
        descriptionKey="pages.readyForSampling.description"
      >
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-nokturo-500" />
        </div>
      </PageShell>
    );
  }

  if (!product) {
    return (
      <PageShell
        titleKey="pages.readyForSampling.title"
        descriptionKey="pages.readyForSampling.description"
      >
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Package className="w-16 h-16 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">{t('products.noProducts')}</p>
          <button
            onClick={() => navigate('/production/sampling')}
            className="mt-4 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
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
  const materials = product.product_materials ?? [];
  const labels = product.product_labels ?? [];

  return (
    <PageShell
      titleKey="pages.readyForSampling.title"
      descriptionKey="pages.readyForSampling.description"
    >
      <div className="max-w-5xl mx-auto flex gap-12">
        <div className="min-w-0 flex-1">
          {/* Back */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/production/sampling')}
              className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </button>
          </div>

          {/* Hero header – matches ProductDetailPage */}
          <header className="mb-12">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="font-headline text-[48px] leading-[1.2] font-extralight text-nokturo-900 dark:text-nokturo-100">{product.name}</h1>
                {product.sku && (
                  <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">SKU: {product.sku}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {product.priority && (
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-600 text-white">
                      {t('products.priority')}
                    </span>
                  )}
                  {product.ready_for_sampling && (
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-600 text-white">
                      {t('products.readyForSampling')}
                    </span>
                  )}
                </div>
                <div className="flex items-stretch gap-6 mt-10 w-fit">
                  <div>
                    <p className="text-[11px] text-nokturo-500 dark:text-nokturo-400 uppercase tracking-wider">{t('products.category')}</p>
                    <p className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 mt-0.5">
                      {product.category ? t(`products.categories.${product.category}`) : '—'}
                    </p>
                  </div>
                  <div className="w-px bg-nokturo-400 dark:bg-nokturo-600 self-stretch shrink-0" aria-hidden />
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

        {/* Extra sections (materials, galleries) – rendered inside content column when description has TOC */}
        {(() => {
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
          const materialsSection = materials.length > 0 && (
            <section id="section-materials" className="mb-12 scroll-mt-6">
              <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
              <h2 className="font-body text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4">
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
                              <button
                                key={pm.id ?? idx}
                                type="button"
                                onClick={() => mat && setViewingMaterial(mat as Material)}
                                className="w-full flex items-start gap-4 p-4 bg-white/80 dark:bg-nokturo-700/50 rounded-lg min-w-0 text-left hover:bg-white dark:hover:bg-nokturo-600 transition-colors cursor-pointer"
                              >
                                <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 dark:bg-nokturo-600 flex items-center justify-center">
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
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          );
          const labelsWithDesign = labels.filter((pl) => pl.label?.design_url);
          const labelsGallery = labelsWithDesign.map((pl) => ({
            url: pl.label!.design_url!,
            caption: pl.label?.name,
          }));
          const labelsSection = labels.length > 0 && (
            <section id="section-labels" className="mb-12 scroll-mt-6">
              <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
              <h2 className="font-body text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4">
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
                          ? 'w-full flex items-start gap-4 p-4 bg-white/80 dark:bg-nokturo-700/50 rounded-lg min-w-0 text-left hover:bg-white dark:hover:bg-nokturo-600 transition-colors cursor-zoom-in'
                          : 'flex items-start gap-4 p-4 bg-white/80 dark:bg-nokturo-700/50 rounded-lg min-w-0'
                      }
                    >
                      {hasDesign ? (
                        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 dark:bg-nokturo-600 flex items-center justify-center">
                          <img src={pl.label!.design_url!} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 dark:bg-nokturo-600 flex items-center justify-center">
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
                    </div>
                  );
                })}
              </div>
            </section>
          );
          const designGallerySection = designGallery.length > 0 && (
            <section id="section-design-gallery" className="mb-12 scroll-mt-6">
              <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
              <h2 className="font-body text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4">
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
                          className={`w-full aspect-square rounded-lg transition-colors bg-white ${
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
          );
          const moodboardGallerySection = moodboardGallery.length > 0 && (
            <section id="section-moodboard-gallery" className="mb-12 scroll-mt-6">
              <div className="mt-10 border-t border-nokturo-300 dark:border-nokturo-600 mb-6" aria-hidden />
              <h2 className="font-body text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-4">
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
                        className="w-full aspect-square object-cover rounded-lg transition-colors"
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
          );
          const extraSections = (
            <>
              {materialsSection}
              {labelsSection}
              {designGallerySection}
              {moodboardGallerySection}
            </>
          );
          const sectionTocItems: TocItem[] = [
            ...(materials.length > 0 ? [{ id: 'section-materials', text: t('products.materials.title'), level: 1 as const }] : []),
            ...(labels.length > 0 ? [{ id: 'section-labels', text: t('products.labels.title'), level: 1 as const }] : []),
            ...(designGallery.length > 0 ? [{ id: 'section-design-gallery', text: t('products.designGallery'), level: 1 as const }] : []),
            ...(moodboardGallery.length > 0 ? [{ id: 'section-moodboard-gallery', text: t('products.moodboardGallery'), level: 1 as const }] : []),
          ];
          const hasCommentableContent = descriptionBlocks.length > 0 || !!product.short_description;
          return hasCommentableContent ? (
            <section id="section-description" className="mb-12 scroll-mt-6">
              <CommentableRichTextViewer
                blocks={descriptionBlocks}
                productId={product.id}
                shortDescription={product.short_description ?? undefined}
                tocTitle={t('pages.readyForSampling.title')}
                sections={extraSections}
                sectionTocItems={sectionTocItems}
                renderTocExternally
                onTocItems={setTocItems}
              />
            </section>
          ) : (
            <>
              {extraSections}
              <TocItemsSync items={sectionTocItems} onItems={setTocItems} />
            </>
          );
        })()}

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
                      className="max-w-full max-h-[50vh] lg:max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                    />
                  );
                })()}
                {loupe && (() => {
                  const url = lightbox.gallery[lightbox.index]?.url ?? '';
                  const isSvg = /\.svg(\?|$)/i.test(url);
                  const zoom = isSvg ? 10 : 8;
                  const size = 250;
                  const bgSize = size * zoom;
                  const center = size / 2;
                  return (
                    <div
                      className="fixed w-[250px] h-[250px] pointer-events-none z-[10000] rounded-full border-2 border-white/80 overflow-hidden"
                      style={{
                        left: loupe.x - size / 2,
                        top: loupe.y - size / 2,
                        backgroundImage: `url(${url})`,
                        backgroundSize: `${bgSize}px ${bgSize}px`,
                        backgroundPosition: `${center - loupe.relX * bgSize}px ${center - loupe.relY * bgSize}px`,
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
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
          labels.length === 0 &&
          designGallery.length === 0 &&
          moodboardGallery.length === 0 && (
            <div className="text-center py-16 text-nokturo-500 dark:text-nokturo-400">
              <p className="text-sm">{t('richText.noContent')}</p>
            </div>
          )}
        </div>

        {/* TOC – pinned to top, aligned with header */}
        {tocItems.length > 0 && (
          <TableOfContents items={tocItems} title={t('pages.readyForSampling.title')} alignWithHeader />
        )}
      </div>

      <MaterialDetailSlideOver
        open={!!viewingMaterial}
        material={viewingMaterial}
        onClose={() => setViewingMaterial(null)}
        onEdit={() => {
          setViewingMaterial(null);
          navigate('/production/materials');
        }}
      />
    </PageShell>
  );
}
