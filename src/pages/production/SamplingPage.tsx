import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { ProductCard } from '../../components/ProductCard';
import type { ProductWithMaterials } from '../../components/ProductSlideOver';
import { Package, Loader2 } from 'lucide-react';

export default function SamplingPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<ProductWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
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
        )`
      )
      .eq('ready_for_sampling', true)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setProducts(data as unknown as ProductWithMaterials[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Real-time: produkt updatovaný na stránce Produkty se projeví i tady ──
  useEffect(() => {
    const productsChannel = supabase
      .channel('sampling-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => fetchProducts(),
      )
      .subscribe();

    const pmChannel = supabase
      .channel('sampling-product-materials')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_materials' },
        () => fetchProducts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(pmChannel);
    };
  }, [fetchProducts]);

  return (
    <PageShell
      titleKey="pages.readyForSampling.title"
      descriptionKey="pages.readyForSampling.description"
    >
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-nokturo-500 dark:text-nokturo-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">
            {t('products.sampling.noProducts')}
          </p>
          <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">
            {t('products.sampling.addFromProducts')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              to={`/production/sampling/${product.id}`}
              showReadyBadge
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
