import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MODAL_HEADING_CLASS } from '../../lib/inputStyles';
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
import {
  SubscriptionSlideOver,
  type Subscription,
} from '../../components/SubscriptionSlideOver';
import type { NotionSelectOption } from '../../components/NotionSelect';
import { FilterGroup } from '../../components/FilterGroup';
import { Plus, Receipt, Loader2, ArrowUpDown, RefreshCw } from 'lucide-react';
import { SimpleDropdown } from '../../components/SimpleDropdown';

type PageTab = 'orders' | 'subscriptions';

export default function AccountingPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canDelete = canDeleteAnything(user?.role ?? 'client');
  useExchangeRates();

  const [pageTab, setPageTab] = useState<PageTab>('orders');

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

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subEditOpen, setSubEditOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [subDeleteTarget, setSubDeleteTarget] = useState<string | null>(null);

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

  // ── Subscriptions ────────────────────────────────────────
  const fetchSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, supplier:suppliers(name)')
      .order('created_at', { ascending: false });
    if (!error && data) setSubscriptions(data as Subscription[]);
    setSubsLoading(false);
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleSubSaved = () => {
    setSubEditOpen(false);
    setEditingSub(null);
    fetchSubscriptions();
    addToast(t('subscriptions.saved'), 'success');
  };

  const handleSubDelete = async (id: string) => {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (!error) setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    setSubDeleteTarget(null);
  };

  const formatNextBilling = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(user?.language === 'cs' ? 'cs-CZ' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-600 text-white';
      case 'paused': return 'bg-amber-600 text-white';
      case 'cancelled': return 'bg-red-600 text-white';
      default: return 'bg-nokturo-500 text-white';
    }
  };

  // Overview stats (from filtered orders)
  const ordersComing = orders.filter((o) => o.order_status === 'ordered').length;
  const spentCzk = orders
    .filter((o) => (o.order_status === 'delivered' || o.order_status === 'ordered') && o.order_value != null)
    .reduce((sum, o) => sum + convertToCzk(o.order_value!, o.order_currency || 'EUR'), 0);
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const spentThisMonthCzk = orders
    .filter((o) => {
      if ((o.order_status !== 'delivered' && o.order_status !== 'ordered') || o.order_value == null) return false;
      const d = new Date(o.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((sum, o) => sum + convertToCzk(o.order_value!, o.order_currency || 'EUR'), 0);

  // Subscription overview stats (active only)
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const subMonthlyPayCzk = activeSubs
    .filter((s) => s.billing_cycle === 'monthly' && s.amount != null)
    .reduce((sum, s) => sum + convertToCzk(s.amount!, s.currency || 'EUR'), 0);
  const subYearlyPayCzk = activeSubs
    .filter((s) => s.billing_cycle === 'yearly' && s.amount != null)
    .reduce((sum, s) => sum + convertToCzk(s.amount!, s.currency || 'EUR'), 0);
  const subTotalYearlyCzk = subMonthlyPayCzk * 12 + subYearlyPayCzk;
  const subAvgYearlyCzk = activeSubs.length > 0 ? subTotalYearlyCzk / activeSubs.length : 0;
  const nextPaymentSub = activeSubs
    .filter((s) => s.next_billing_date)
    .sort((a, b) => new Date(a.next_billing_date!).getTime() - new Date(b.next_billing_date!).getTime())[0];

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <PageShell
      titleKey="pages.accounting.title"
      descriptionKey="pages.accounting.description"
      compactContent
      noHorizontalPadding
      noContentPadding
      contentOverflow="hidden"
      actionsSlot={
        pageTab === 'orders' ? (
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            <div className="flex items-center gap-2 shrink-0">
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
              {(categoryFilter.length > 0 || statusFilter.length > 0) && (
                <button
                  type="button"
                  onClick={() => { setCategoryFilter([]); setStatusFilter([]); }}
                  className="h-9 px-3 text-sm font-medium bg-red-500 text-white rounded-[6px] hover:bg-red-600 transition-colors shrink-0 inline-flex items-center"
                >
                  {t('common.clearFilters')}
                </button>
              )}
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
              <button
                type="button"
                onClick={() => setSortAsc((a) => !a)}
                title={sortAsc ? t('accounting.sortDesc') : t('accounting.sortAsc')}
                className="flex items-center justify-center size-9 shrink-0 rounded-[6px] bg-white/10 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors"
              >
                <ArrowUpDown className={`w-4 h-4 transition-transform ${sortAsc ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openAdd}
                className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-[6px] px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                {t('accounting.addOrder')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingSub(null); setSubEditOpen(true); }}
              className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-[6px] px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t('subscriptions.add')}
            </button>
          </div>
        )
      }
    >
      <ToastContainer toasts={toasts} onClose={closeToast} />

      <div className="flex flex-col min-h-0 flex-1">
      {/* Page-level tabs: Orders | Subscriptions */}
      <div className="shrink-0 flex gap-1 mb-6 border-b border-nokturo-200 dark:border-nokturo-700 pt-3 pl-6 pr-6">
        {(['orders', 'subscriptions'] as PageTab[]).map((key) => (
          <button
            key={key}
            onClick={() => setPageTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              pageTab === key
                ? 'text-nokturo-900 dark:text-nokturo-100'
                : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300'
            }`}
          >
            {key === 'orders' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="shrink-0 opacity-60" fill="currentColor">
                <path d="M2 24v-4h20v4zm2-6v-4.25L15.2 2.575q.275-.275.638-.425T16.6 2t.775.15t.675.45L19.425 4q.3.275.438.65t.137.775q0 .375-.137.738t-.438.662L8.25 18zM16.6 6.8L18 5.4L16.6 4l-1.4 1.4z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="shrink-0 opacity-60" fill="currentColor">
                <path d="M13.05 22v-2.05q.85-.125 1.663-.45t1.537-.85l1.4 1.45q-1.05.8-2.2 1.287t-2.4.613m-2 0q-3.45-.45-5.725-2.988T3.05 13.05q0-1.875.713-3.512t1.925-2.85t2.85-1.925t3.512-.713h.15L10.65 2.5l1.4-1.45l4 4l-4 4l-1.4-1.4l1.6-1.6h-.2q-2.925 0-4.962 2.038T5.05 13.05q0 2.6 1.7 4.563t4.3 2.337zm8.05-3.35l-1.45-1.4q.525-.725.85-1.537t.45-1.663H21q-.125 1.25-.612 2.4t-1.288 2.2m1.9-6.6h-2.05q-.125-.85-.45-1.662t-.85-1.538l1.45-1.4q.8.975 1.275 2.15T21 12.05"/>
              </svg>
            )}
            {t(`accounting.tabs.${key}`)}
            {pageTab === key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-nokturo-900 dark:bg-nokturo-100 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {pageTab === 'orders' && (<>
      {/* Overview stats */}
      <div className="sticky top-0 z-10 shrink-0 pl-6 pr-6 py-2 bg-transparent">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.ordersComing')}
          </p>
          <p className="text-xl font-medium text-white">{ordersComing}</p>
        </div>
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.spent')}
          </p>
          <p className="text-xl font-medium text-emerald-400">
            {spentCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('accounting.overview.spentThisMonth')}
          </p>
          <p className="text-xl font-medium text-white">
            {spentThisMonthCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
      </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-20 pl-6 pr-6">
          <Loader2 className="w-6 h-6 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center pl-6 pr-6">
          <Receipt className="w-12 h-12 text-nokturo-400 dark:text-nokturo-500 mb-4" />
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">{t('accounting.noOrders')}</p>
          <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mt-1">{t('accounting.addFirst')}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px] table-fixed">
              <colgroup>
                <col style={{ width: '90px' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '36%' }} />
                <col style={{ width: '100px' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#0D0D0D' }}>
                  <th className="py-2 pl-6 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.colStatus')}</th>
                  <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.supplier')}</th>
                  <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.eshopLink')}</th>
                  <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('accounting.note')}</th>
                  <th className="sticky top-0 z-10 py-2 pl-6 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-right bg-[#0d0d0d]">{t('accounting.colValue')}</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px] table-fixed">
              <colgroup>
                <col style={{ width: '90px' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '36%' }} />
                <col style={{ width: '100px' }} />
              </colgroup>
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
          </div>
        </div>
      )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-nokturo-900 p-6 max-w-sm w-full mx-4 rounded-xl shadow-2xl">
            <h3 className={`${MODAL_HEADING_CLASS} mb-2`}>{t('common.confirm')}</h3>
            <p className="text-nokturo-400 text-sm mb-4">{t('accounting.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-nokturo-400 hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-white text-nokturo-900 rounded-lg hover:bg-nokturo-100 transition-colors"
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
      </>)}

      {/* ── Subscriptions Tab ────────────────────────────── */}
      {pageTab === 'subscriptions' && (<>
      {/* Subscription overview stats */}
      <div className="sticky top-0 z-10 shrink-0 pl-6 pr-6 py-2 bg-transparent">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('subscriptions.overview.monthlyPay')}
          </p>
          <p className="text-xl font-medium text-white">
            {subMonthlyPayCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('subscriptions.overview.yearlyPay')}
          </p>
          <p className="text-xl font-medium text-white">
            {subYearlyPayCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('subscriptions.overview.totalYearly')}
          </p>
          <p className="text-xl font-medium text-emerald-400">
            {subTotalYearlyCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
          <p className="text-xs text-nokturo-400 mt-0.5">
            {t('subscriptions.overview.avgYearly')}: {subAvgYearlyCzk.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
          </p>
        </div>
        <div className="bg-black rounded-[6px] p-4">
          <p className="text-nokturo-400 text-xs uppercase tracking-wider mb-1">
            {t('subscriptions.overview.nextPayment')}
          </p>
          {nextPaymentSub ? (
            <>
              <p className="text-xl font-medium text-white">
                {formatNextBilling(nextPaymentSub.next_billing_date)}
              </p>
              <p className="text-sm text-nokturo-400 truncate" title={nextPaymentSub.name}>
                {nextPaymentSub.name} — {convertToCzk(nextPaymentSub.amount ?? 0, nextPaymentSub.currency || 'EUR').toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
              </p>
            </>
          ) : (
            <p className="text-nokturo-400">—</p>
          )}
        </div>
      </div>
      </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {subsLoading ? (
          <div className="flex items-center justify-center py-20 pl-6 pr-6">
            <Loader2 className="w-6 h-6 text-nokturo-500 dark:text-nokturo-400 animate-spin" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center pl-6 pr-6">
            <RefreshCw className="w-12 h-12 text-nokturo-400 dark:text-nokturo-500 mb-4" />
            <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">{t('subscriptions.noSubscriptions')}</p>
            <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">{t('subscriptions.addFirst')}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px] table-fixed">
                <colgroup>
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#0D0D0D' }}>
                    <th className="py-2 pl-6 pr-4 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('subscriptions.status')}</th>
                    <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('subscriptions.name')}</th>
                    <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('subscriptions.billingCycle')}</th>
                    <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-right">{t('subscriptions.amount')}</th>
                    <th className="py-2 pr-6 text-[11px] font-medium text-nokturo-500 dark:text-nokturo-400 uppercase tracking-widest text-left">{t('subscriptions.nextBillingDate')}</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px] table-fixed">
                <colgroup>
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <tbody>
                {subscriptions.map((sub, idx) => (
                  <tr
                    key={sub.id}
                    onClick={() => { setEditingSub(sub); setSubEditOpen(true); }}
                    className={`cursor-pointer transition-colors hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 ${
                      idx % 2 === 0 ? 'bg-white/5' : ''
                    }`}
                  >
                    <td className="py-3 pl-6 pr-4 align-middle">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-[4px] font-medium whitespace-nowrap ${statusColor(sub.status)}`}>
                        {t(`subscriptions.statuses.${sub.status}`)}
                      </span>
                    </td>
                    <td className="py-3 pr-6 align-middle">
                      <div className="text-sm font-medium text-nokturo-900 dark:text-nokturo-100 truncate max-w-[200px]">{sub.name}</div>
                      {sub.supplier?.name && (
                        <div className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate">{sub.supplier.name}</div>
                      )}
                    </td>
                    <td className="py-3 pr-6 text-sm text-nokturo-700 dark:text-nokturo-300 align-middle">
                      {t(`subscriptions.${sub.billing_cycle}`)}
                    </td>
                    <td className="py-3 pr-6 text-sm font-medium text-nokturo-900 dark:text-nokturo-100 text-right whitespace-nowrap align-middle">
                      {convertToCzk(sub.amount ?? 0, sub.currency || 'EUR').toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
                    </td>
                    <td className="py-3 pr-6 text-sm text-nokturo-700 dark:text-nokturo-300 whitespace-nowrap align-middle">
                      {formatNextBilling(sub.next_billing_date)}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>

        {subDeleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-nokturo-900 p-6 max-w-sm w-full mx-4 rounded-xl shadow-2xl">
              <h3 className={`${MODAL_HEADING_CLASS} mb-2`}>{t('common.confirm')}</h3>
              <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">{t('subscriptions.deleteConfirm')}</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setSubDeleteTarget(null)} className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={() => handleSubDelete(subDeleteTarget)} className="px-4 py-2 text-sm bg-nokturo-900 text-white rounded-lg hover:bg-nokturo-800 transition-colors">
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        <SubscriptionSlideOver
          open={subEditOpen}
          subscription={editingSub}
          onClose={() => { setSubEditOpen(false); setEditingSub(null); }}
          onSaved={handleSubSaved}
          onDelete={canDelete ? (id) => {
            setSubEditOpen(false);
            setEditingSub(null);
            setSubDeleteTarget(id);
          } : undefined}
        />
      </>)}
      </div>
    </PageShell>
  );
}
