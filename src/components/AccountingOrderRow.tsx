import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { convertToCzk } from '../lib/currency';
import type { AccountingOrder } from './AccountingSlideOver';

const TAG_BADGE_CLASSES: Record<string, string> = {
  gray: 'bg-nokturo-500 text-white',
  orange: 'bg-amber-600 text-white',
  green: 'bg-emerald-600 text-white',
  red: 'bg-red-600 text-white',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  ordered: 'gray',
  canceled: 'orange',
  delivered: 'green',
  returned: 'red',
};

function formatValueInCzk(v: number | null, currency: string = 'EUR'): string {
  if (v == null) return '';
  const czk = convertToCzk(v, currency || 'EUR');
  return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(czk) + ' Kč';
}

interface AccountingOrderRowProps {
  order: AccountingOrder;
  index: number;
  onClick: () => void;
}

export function AccountingOrderRow({ order, index, onClick }: AccountingOrderRowProps) {
  const { t } = useTranslation();

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={`cursor-pointer hover:bg-nokturo-100/60 dark:hover:bg-nokturo-800/60 transition-colors ${index % 2 === 0 ? 'bg-white/5' : ''}`}
    >
      <td className="py-2.5 pl-6 pr-6 align-middle">
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-[4px] font-medium whitespace-nowrap ${
            TAG_BADGE_CLASSES[ORDER_STATUS_COLORS[order.order_status] ?? 'gray'] ?? TAG_BADGE_CLASSES.gray
          }`}
        >
          {t(`accounting.orderStatuses.${order.order_status}`)}
        </span>
      </td>
      <td className="py-2.5 pr-6 align-middle truncate text-sm text-nokturo-900 dark:text-nokturo-100" title={order.supplier?.name ?? ''}>
        {order.supplier?.name ?? ''}
      </td>
      <td className="py-2.5 pr-6 align-middle">
        {order.eshop_link ? (
          <a
            href={order.eshop_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] font-medium text-nokturo-600 dark:text-white hover:text-nokturo-900 dark:hover:text-white bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 transition-colors truncate max-w-full"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{order.eshop_link.replace(/^https?:\/\//, '').slice(0, 14)}…</span>
          </a>
        ) : (
          ''
        )}
      </td>
      <td className="py-2.5 pr-6 align-middle max-w-[200px]">
        <span className="block truncate text-left text-xs text-nokturo-600 dark:text-nokturo-400" title={order.note ?? ''}>
          {order.note?.trim() ? order.note : ''}
        </span>
      </td>
      <td className="py-2.5 pl-6 pr-6 align-middle text-right whitespace-nowrap text-sm text-nokturo-900 dark:text-nokturo-100">
        {formatValueInCzk(order.order_value, order.order_currency || 'EUR')}
      </td>
    </tr>
  );
}
