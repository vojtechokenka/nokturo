import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRates, convertToCzk } from '../../lib/currency';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import { ToastContainer, type ToastData } from '../../components/Toast';
import {
  AccountingSlideOver,
  type AccountingOrder,
} from '../../components/AccountingSlideOver';
import { AccountingDetailSlideOver } from '../../components/AccountingDetailSlideOver';
import { AccountingOrderRow } from '../../components/AccountingOrderRow';
import type { NotionSelectOption } from '../../components/NotionSelect';
import { FilterGroup } from '../../components/FilterGroup';
import { Plus, Receipt, Loader2, ArrowUpDown } from 'lucide-react';
import { SimpleDropdown } from '../../components/SimpleDropdown';

export default function AccountingPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  useExchangeRates();

  const [orders, setOrders] = useState<AccountingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<AccountingOrder | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<AccountingOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [categories, setCategories] = useState<NotionSelectOption[]>([]);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }]);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    const dateAsc = sortBy === 'date' ? sortAsc : false;
    let query = supabase
      .from('accounting_orders')
      .select('*, supplier:suppliers(name)')
      .order('created_at', { ascending: dateAsc });

    if (categoryFilter.length > 0) {
      query = query.in('category', categoryFilter);
    }
    if (statusFilter.length > 0) {
      query = query.in('order_status', statusFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      let list = data as AccountingOrder[];
      if (sortBy === 'value') {
        const mult = sortAsc ? -1 : 1;
        list = [...list].sort((a, b) => {
          const aCzk = (a.order_value ?? 0) ? convertToCzk(a.order_value!, a.order_currency || 'EUR') : 0;
          const bCzk = (b.order_value ?? 0) ? convertToCzk(b.order_value!, b.order_currency || 'EUR') : 0;
          return mult * (bCzk - aCzk);
        });
      }
      setOrders(list);
    }
    setLoading(false);
  }, [categoryFilter, statusFilter, sortBy, sortAsc]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('accounting_categories')
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
            const { error: insErr } = await supabase.from('accounting_categories').insert({
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
                .from('accounting_categories')
                .update({ name: opt.name, color: opt.color, sort_order: opt.sort_order })
                .eq('id', opt.id);
              if (updErr) throw updErr;
            }
          }
        }
        for (const o of prevCategories) {
          if (!newOptions.some((n) => n.id === o.id)) {
            const { error: delErr } = await supabase.from('accounting_categories').delete().eq('id', o.id);
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

  const openAdd = () => {
    setEditingOrder(null);
    setEditOpen(true);
  };

  const openDetail = (o: AccountingOrder) => {
    setViewingOrder(o);
    setDetailOpen(true);
  };

  const openEdit = (o: AccountingOrder) => {
    setDetailOpen(false);
    setViewingOrder(null);
    setEditingOrder(o);
    setEditOpen(true);
  };

  const handleDuplicate = (o: AccountingOrder) => {
    setDetailOpen(false);
    setViewingOrder(null);
    const suffix = ' (' + t('common.duplicateSuffix') + ')';
    const duplicate: AccountingOrder = {
      ...o,
      id: '',
      order_number: (o.order_number || '') + suffix,
      created_at: '',
      updated_at: '',
    };
    setEditingOrder(duplicate);
    setEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('accounting_orders').delete().eq('id', id);
    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleSaved = () => {
    setEditOpen(false);
    setEditingOrder(null);
    fetchOrders();
    addToast(t('accounting.saved'), 'success');
  };

  // Overview stats (from filtered orders)
  const ordersComing = orders.filter((o) => o.order_status === 'ordered').length;
  const spentCzk = orders
    .filter((o) => (o.order_status === 'delivered' || o.order_status === 'ordered') && o.order_value != null)
    .reduce((sum, o) => sum + convertToCzk(o.order_value!, o.order_currency || 'EUR'), 0);
  const monthlyPayCzk = orders
    .filter((o) => o.monthly_payment && o.monthly_value != null)
    .reduce((sum, o) => sum + convertToCzk(o.monthly_value!, o.order_currency || 'EUR'), 0);
  const yearlyPayCzk = orders
    .filter((o) => o.yearly_payment && o.yearly_value != null)
    .reduce((sum, o) => sum + convertToCzk(o.yearly_value!, o.order_currency || 'EUR'), 0);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <PageShell
      titleKey="pages.accounting.title"
      descriptionKey="pages.accounting.description"
    >
      <ToastContainer toasts={toasts} onClose={closeToast} />

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-nokturo-800 rounded-lg p-4">
          <p className="text-nokturo-500 dark:text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.ordersComing')}
          </p>
          <p className="text-xl font-medium text-nokturo-900 dark:text-nokturo-100">{ordersComing}</p>
        </div>
        <div className="bg-white dark:bg-nokturo-800 rounded-lg p-4">
          <p className="text-nokturo-500 dark:text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.spent')}
          </p>
          <p className="text-xl font-medium text-emerald-600">
            {spentCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-white dark:bg-nokturo-800 rounded-lg p-4">
          <p className="text-nokturo-500 dark:text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.monthlyPay')}
          </p>
          <p className="text-xl font-medium text-nokturo-900 dark:text-nokturo-100">
            {monthlyPayCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-white dark:bg-nokturo-800 rounded-lg p-4">
          <p className="text-nokturo-500 dark:text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.yearlyPay')}
          </p>
          <p className="text-xl font-medium text-nokturo-900 dark:text-nokturo-100">
            {yearlyPayCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-end">
        {(categoryFilter.length > 0 || statusFilter.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setCategoryFilter([]);
              setStatusFilter([]);
            }}
            className="text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-2 py-1 rounded hover:bg-nokturo-100 dark:hover:bg-nokturo-800 transition-colors shrink-0"
          >
            {t('common.clearFilters')}
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSortAsc((a) => !a)}
            title={sortAsc ? t('accounting.sortDesc') : t('accounting.sortAsc')}
            className="p-1.5 rounded-lg text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors"
          >
            <ArrowUpDown className={`w-4 h-4 transition-transform ${sortAsc ? 'rotate-180' : ''}`} />
          </button>
          <SimpleDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'date', label: t('accounting.sortByDateAdded') },
              { value: 'value', label: t('accounting.sortByValue') },
            ]}
            compact
            className="min-w-[140px]"
          />
        </div>

        <FilterGroup
          titleKey="accounting.filterTitle"
          sections={[
            {
              labelKey: 'accounting.filterByCategory',
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [
                { value: 'all', label: t('accounting.allCategories') },
                ...categories.map((cat) => ({
                  value: cat.name,
                  label: t(`accounting.categories.${cat.name}`) !== `accounting.categories.${cat.name}` ? t(`accounting.categories.${cat.name}`) : cat.name,
                })),
              ],
            },
            {
              labelKey: 'accounting.filterByStatus',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'all', label: t('accounting.allStatuses') },
                { value: 'ordered', label: t('accounting.orderStatuses.ordered') },
                { value: 'delivered', label: t('accounting.orderStatuses.delivered') },
                { value: 'returned', label: t('accounting.orderStatuses.returned') },
                { value: 'canceled', label: t('accounting.orderStatuses.canceled') },
              ],
            },
          ]}
        />

        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('accounting.addOrder')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-nokturo-400 dark:text-nokturo-500 mb-4" />
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">{t('accounting.noOrders')}</p>
          <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">{t('accounting.addFirst')}</p>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="py-2 pl-4 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.colStatus')}</th>
              <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.supplier')}</th>
              <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.eshopLink')}</th>
              <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.note')}</th>
              <th className="py-2 pl-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-right">{t('accounting.colValue')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, idx) => (
              <AccountingOrderRow
                key={order.id}
                order={order}
                index={idx}
                onClick={() => openDetail(order)}
              />
            ))}
          </tbody>
        </table>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nokturo-900/30">
          <div className="bg-white dark:bg-nokturo-800 p-6 max-w-sm w-full mx-4 rounded-xl border border-nokturo-200 dark:border-nokturo-600">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">{t('common.confirm')}</h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">{t('accounting.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AccountingDetailSlideOver
        open={detailOpen}
        order={viewingOrder}
        categories={categories}
        onClose={() => {
          setDetailOpen(false);
          setViewingOrder(null);
        }}
        onEdit={openEdit}
        onDuplicate={handleDuplicate}
        onDelete={canDelete ? (id) => {
          setDetailOpen(false);
          setViewingOrder(null);
          setDeleteTarget(id);
        } : undefined}
      />

      <AccountingSlideOver
        open={editOpen}
        order={editingOrder}
        categories={categories}
        onCategoriesChange={handleCategoriesChange}
        onClose={() => {
          setEditOpen(false);
          setEditingOrder(null);
        }}
        onSaved={handleSaved}
        onDelete={canDelete ? (id) => {
          setEditOpen(false);
          setEditingOrder(null);
          setDeleteTarget(id);
        } : undefined}
        canDelete={canDelete}
      />
    </PageShell>
  );
}
