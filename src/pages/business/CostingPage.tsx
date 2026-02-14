import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import type { ProductWithMaterials } from '../../components/ProductSlideOver';
import { useExchangeRates, convertToCzk, CURRENCIES } from '../../lib/currency';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

// ── Costing row derived from product + linked materials ──────
interface CostingRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  status: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCOGS: number;
  markupMultiplier: number;
  retailPrice: number;
  breakEvenPrice: number;
  profitPerUnit: number;
  currency: string;
  materialCostCzk: number;
  totalCOGSCzk: number;
  retailPriceCzk: number;
  profitPerUnitCzk: number;
}

type SortField = 'name' | 'materialCost' | 'totalCOGS' | 'retailPrice' | 'profitPerUnit';

export default function CostingPage() {
  const { t } = useTranslation();
  useExchangeRates();

  const [rows, setRows] = useState<CostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // ── Fetch products with linked materials ───────────────────
  const fetchCostingData = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        product_materials (
          id,
          material_id,
          consumption_amount,
          notes,
          material:materials (*)
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (!error && data) {
      const products = data as unknown as ProductWithMaterials[];

      const costingRows: CostingRow[] = products.map((p) => {
        // Sum material costs: consumption * price_per_unit for each linked material
        let materialCost = 0;
        let materialCostCzk = 0;
        let currency = 'EUR';

        if (p.product_materials && p.product_materials.length > 0) {
          for (const pm of p.product_materials) {
            if (pm.material) {
              const lineCost = pm.consumption_amount * (pm.material.price_per_unit || 0);
              const curr = pm.material.currency || currency;
              materialCost += lineCost;
              materialCostCzk += convertToCzk(lineCost, curr);
              currency = curr;
            }
          }
        }

        const laborCost = p.labor_cost ?? 0;
        const overheadCost = p.overhead_cost ?? 0;
        const totalCOGS = materialCost + laborCost + overheadCost;
        // Labor and overhead are typically in CZK (product-level costs)
        const totalCOGSCzk = materialCostCzk + laborCost + overheadCost;
        const markupMultiplier = p.markup_multiplier ?? 2.5;
        const retailPrice = totalCOGS * markupMultiplier;
        const retailPriceCzk = totalCOGSCzk * markupMultiplier;
        const breakEvenPrice = totalCOGS;
        const profitPerUnit = retailPrice - totalCOGS;
        const profitPerUnitCzk = retailPriceCzk - totalCOGSCzk;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          status: p.status,
          materialCost,
          laborCost,
          overheadCost,
          totalCOGS,
          markupMultiplier,
          retailPrice,
          breakEvenPrice,
          profitPerUnit,
          currency,
          materialCostCzk,
          totalCOGSCzk,
          retailPriceCzk,
          profitPerUnitCzk,
        };
      });

      setRows(costingRows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCostingData();
  }, [fetchCostingData]);

  // ── Real-time subscription for live updates ────────────────
  useEffect(() => {
    const productsChannel = supabase
      .channel('costing-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => fetchCostingData(),
      )
      .subscribe();

    const materialsChannel = supabase
      .channel('costing-materials')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'materials' },
        () => fetchCostingData(),
      )
      .subscribe();

    const pmChannel = supabase
      .channel('costing-product-materials')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_materials' },
        () => fetchCostingData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(materialsChannel);
      supabase.removeChannel(pmChannel);
    };
  }, [fetchCostingData]);

  // ── Sort handler ───────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortField === 'name') {
      return a.name.localeCompare(b.name) * dir;
    }
    return ((a[sortField] as number) - (b[sortField] as number)) * dir;
  });

  // ── Summary stats ──────────────────────────────────────────
  const totalProducts = rows.length;
  const avgCOGS =
    totalProducts > 0
      ? rows.reduce((sum, r) => sum + r.totalCOGS, 0) / totalProducts
      : 0;
  const avgProfit =
    totalProducts > 0
      ? rows.reduce((sum, r) => sum + r.profitPerUnit, 0) / totalProducts
      : 0;
  const avgMargin =
    totalProducts > 0
      ? rows.reduce((sum, r) => {
          const margin =
            r.retailPrice > 0 ? (r.profitPerUnit / r.retailPrice) * 100 : 0;
          return sum + margin;
        }, 0) / totalProducts
      : 0;

  // ── Helpers ────────────────────────────────────────────────
  const fmtCurrency = (val: number, currency: string = 'EUR') =>
    `${val.toFixed(2)} ${currency}`;
  const showCzk = (row: CostingRow) =>
    row.currency !== 'CZK' && CURRENCIES.includes(row.currency as (typeof CURRENCIES)[number]);

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`w-3 h-3 inline-block ml-1 ${
        sortField === field ? 'text-nokturo-900' : 'text-nokturo-400'
      }`}
    />
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <PageShell
      titleKey="pages.costingCalculator.title"
      descriptionKey="pages.costingCalculator.description"
    >
      {/* ── Summary cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4">
          <p className="text-nokturo-500 text-xs uppercase tracking-wider mb-1">
            {t('costing.totalProducts')}
          </p>
          <p className="text-2xl font-medium text-nokturo-900">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-nokturo-500 text-xs uppercase tracking-wider mb-1">
            {t('costing.avgCOGS')}
          </p>
          <p className="text-2xl font-medium text-nokturo-900">
            {fmtCurrency(avgCOGS)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-nokturo-500 text-xs uppercase tracking-wider mb-1">
            {t('costing.avgProfit')}
          </p>
          <p className="text-2xl font-medium text-emerald-600">
            {fmtCurrency(avgProfit)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-nokturo-500 text-xs uppercase tracking-wider mb-1">
            {t('costing.avgMargin')}
          </p>
          <p className="text-2xl font-medium text-nokturo-900">
            {avgMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* ── Refresh button ──────────────────────────────────── */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchCostingData}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-nokturo-600 hover:text-nokturo-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
          {t('costing.refresh')}
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="w-12 h-12 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 font-medium">
            {t('costing.noProducts')}
          </p>
          <p className="text-nokturo-500 text-sm mt-1">
            {t('costing.addProductsFirst')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-nokturo-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-nokturo-50 border-b border-nokturo-200">
                <th
                  className="text-left px-4 py-3 text-nokturo-600 font-medium cursor-pointer hover:text-nokturo-900 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  {t('costing.product')}
                  <SortIcon field="name" />
                </th>
                <th
                  className="text-right px-4 py-3 text-nokturo-600 font-medium cursor-pointer hover:text-nokturo-900 transition-colors"
                  onClick={() => handleSort('materialCost')}
                >
                  {t('costing.materialCost')}
                  <SortIcon field="materialCost" />
                </th>
                <th className="text-right px-4 py-3 text-nokturo-600 font-medium">
                  {t('costing.laborOverhead')}
                </th>
                <th
                  className="text-right px-4 py-3 text-nokturo-600 font-medium cursor-pointer hover:text-nokturo-900 transition-colors"
                  onClick={() => handleSort('totalCOGS')}
                >
                  {t('costing.totalCOGS')}
                  <SortIcon field="totalCOGS" />
                </th>
                <th className="text-right px-4 py-3 text-nokturo-600 font-medium">
                  {t('costing.breakEven')}
                </th>
                <th
                  className="text-right px-4 py-3 text-nokturo-600 font-medium cursor-pointer hover:text-nokturo-900 transition-colors"
                  onClick={() => handleSort('retailPrice')}
                >
                  {t('costing.retailPrice')}
                  <SortIcon field="retailPrice" />
                </th>
                <th
                  className="text-right px-4 py-3 text-nokturo-600 font-medium cursor-pointer hover:text-nokturo-900 transition-colors"
                  onClick={() => handleSort('profitPerUnit')}
                >
                  {t('costing.profitPerUnit')}
                  <SortIcon field="profitPerUnit" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const margin =
                  row.retailPrice > 0
                    ? (row.profitPerUnit / row.retailPrice) * 100
                    : 0;

                return (
                  <tr
                    key={row.id}
                    className="border-b border-nokturo-100 hover:bg-nokturo-50 transition-colors"
                  >
                    {/* Product name */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-nokturo-900 font-medium">{row.name}</p>
                        <p className="text-nokturo-500 text-xs">
                          {row.sku || '—'}
                          {row.category && (
                            <span className="ml-2 text-nokturo-500">
                              {t(`products.categories.${row.category}`)}
                            </span>
                          )}
                        </p>
                      </div>
                    </td>

                    {/* Material cost */}
                    <td className="text-right px-4 py-3 text-nokturo-700">
                      {fmtCurrency(row.materialCost, row.currency)}
                      {showCzk(row) && (
                        <span className="block text-xs text-nokturo-500">
                          ≈ {row.materialCostCzk.toFixed(2)} CZK
                        </span>
                      )}
                    </td>

                    {/* Labor + Overhead */}
                    <td className="text-right px-4 py-3 text-nokturo-700">
                      <span className="block">
                        {fmtCurrency(row.laborCost, 'CZK')}
                      </span>
                      <span className="block text-xs text-nokturo-500">
                        + {fmtCurrency(row.overheadCost, 'CZK')}
                      </span>
                    </td>

                    {/* Total COGS */}
                    <td className="text-right px-4 py-3 text-nokturo-900 font-medium">
                      {fmtCurrency(row.totalCOGS, row.currency)}
                      {showCzk(row) && (
                        <span className="block text-xs text-nokturo-500">
                          ≈ {row.totalCOGSCzk.toFixed(2)} CZK
                        </span>
                      )}
                    </td>

                    {/* Break-even */}
                    <td className="text-right px-4 py-3 text-nokturo-700">
                      {fmtCurrency(row.breakEvenPrice, row.currency)}
                      {showCzk(row) && (
                        <span className="block text-xs text-nokturo-500">
                          ≈ {row.totalCOGSCzk.toFixed(2)} CZK
                        </span>
                      )}
                    </td>

                    {/* Retail price */}
                    <td className="text-right px-4 py-3">
                      <span className="text-nokturo-900 font-medium">
                        {fmtCurrency(row.retailPrice, row.currency)}
                      </span>
                      {showCzk(row) && (
                        <span className="block text-xs text-nokturo-500">
                          ≈ {row.retailPriceCzk.toFixed(2)} CZK
                        </span>
                      )}
                      <span className="block text-xs text-nokturo-500">
                        x{row.markupMultiplier}
                      </span>
                    </td>

                    {/* Profit per unit */}
                    <td className="text-right px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.profitPerUnit >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <span
                          className={`font-medium ${
                            row.profitPerUnit >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {fmtCurrency(row.profitPerUnit, row.currency)}
                        </span>
                      </div>
                      {showCzk(row) && (
                        <span className="block text-xs text-nokturo-500">
                          ≈ {row.profitPerUnitCzk.toFixed(2)} CZK
                        </span>
                      )}
                      <span className="block text-xs text-nokturo-500">
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
