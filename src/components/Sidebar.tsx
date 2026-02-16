import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { canAccessSection, canAccessModule } from '../lib/rbac';
import type { Module } from '../lib/rbac';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../hooks/useNotifications';
import {
  Briefcase,
  Palette,
  Image,
  Lightbulb,
  Scissors,
  LayoutGrid,
  Tag,
  Package,
  Calculator,
  Users,
  Coins,
  Settings,
  LogOut,
  Bell,
  Layers,
} from 'lucide-react';

/** Sharp icon props – miter/square instead of round for a more angular look */
const iconProps = { size: 18, strokeLinejoin: 'miter' as const, strokeLinecap: 'square' as const };
import { DefaultAvatar } from './DefaultAvatar';

interface NavItem {
  key: string;
  path: string;
  icon: React.ReactNode;
  labelKey: string;
  rbacModule: Module;
  hidden?: boolean;
}

interface NavSection {
  key: string;
  labelKey: string;
  rbacSection: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'brand',
    labelKey: 'nav.brand',
    rbacSection: 'brand',
    items: [
      { key: 'strategy', path: '/brand/strategy', icon: <Briefcase {...iconProps} />, labelKey: 'nav.strategy', rbacModule: 'brand.strategy' },
      { key: 'identity', path: '/brand/identity', icon: <Palette {...iconProps} />, labelKey: 'nav.identity', rbacModule: 'brand.identity' },
    ],
  },
  {
    key: 'prototyping',
    labelKey: 'nav.prototyping',
    rbacSection: 'prototyping',
    items: [
      { key: 'moodboard', path: '/prototyping/moodboard', icon: <Image {...iconProps} />, labelKey: 'nav.moodboard', rbacModule: 'prototyping.moodboard' },
      { key: 'ideas', path: '/prototyping/ideas', icon: <Lightbulb {...iconProps} />, labelKey: 'nav.ideas', rbacModule: 'prototyping.ideas' },
    ],
  },
  {
    key: 'production',
    labelKey: 'nav.production',
    rbacSection: 'production',
    items: [
      { key: 'materials', path: '/production/materials', icon: <Scissors {...iconProps} />, labelKey: 'nav.materialLibrary', rbacModule: 'production.materials' },
      { key: 'components', path: '/production/components', icon: <LayoutGrid {...iconProps} />, labelKey: 'nav.componentsLibrary', rbacModule: 'production.components' },
      { key: 'labels', path: '/production/labels', icon: <Tag {...iconProps} />, labelKey: 'nav.labelsLibrary', rbacModule: 'production.labels' },
      { key: 'products', path: '/production/products', icon: <Package {...iconProps} />, labelKey: 'nav.products', rbacModule: 'production.products' },
      { key: 'sampling', path: '/production/sampling', icon: <Layers {...iconProps} />, labelKey: 'nav.readyForSampling', rbacModule: 'production.sampling' },
    ],
  },
  {
    key: 'business',
    labelKey: 'nav.business',
    rbacSection: 'business',
    items: [
      { key: 'costing', path: '/business/costing', icon: <Calculator {...iconProps} />, labelKey: 'nav.costingCalculator', rbacModule: 'business.costing', hidden: true },
      { key: 'suppliers', path: '/business/suppliers', icon: <Users {...iconProps} />, labelKey: 'nav.supplierDirectory', rbacModule: 'business.suppliers' },
      { key: 'accounting', path: '/business/accounting', icon: <Coins {...iconProps} />, labelKey: 'nav.accounting', rbacModule: 'business.accounting' },
    ],
  },
];

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'host';

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications(user?.id);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleNotificationClick = (n: Notification) => {
    // Mark as read (not delete) so it stays in history but loses unread styling
    if (!n.read) {
      markAsRead(n.id);
    }
    setShowNotifications(false);

    if (n.link) {
      const currentHash = window.location.hash?.replace(/^#/, '') || '';
      const currentPath = currentHash.split('?')[0] || window.location.pathname.replace(/^\/app/, '');
      const targetPath = n.link.split('?')[0];
      const isSamePage = currentPath === targetPath || currentPath.endsWith(targetPath);

      if (isSamePage) {
        const url = new URL(n.link, window.location.origin);
        const itemId = url.searchParams.get('item');
        if (itemId) {
          window.dispatchEvent(new CustomEvent('open-moodboard-item', { detail: { itemId } }));
        } else {
          const targetLink = n.link;
          navigate(targetLink, { replace: true });
          setTimeout(() => navigate(targetLink), 50);
        }
      } else {
        navigate(n.link);
      }
    }
  };

  const handleLogout = async () => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
      useAuthStore.getState().logout();
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <aside className="w-60 h-screen bg-nokturo-100 dark:bg-nokturo-800 flex flex-col">
      {/* Brand header */}
      <div className="px-5 py-5">
        <svg className="h-[40px] w-[40px]" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="4" fill="black"/>
          <path d="M21.9925 9.57141C21.9925 12.8413 19.3136 15.4966 16.0034 15.5057C14.3506 15.5057 12.8517 14.839 11.7659 13.7664C10.6801 12.6939 10.0075 11.2109 10.0075 9.57141C10.0075 11.2109 9.33257 12.8163 8.24677 14.0159C7.16098 15.2131 5.65968 16 4 16C7.31707 16 10.0075 19.1496 10.0075 22.4286C10.0075 19.1564 12.6864 16.5034 15.9966 16.4943C17.6494 16.4943 19.1484 17.161 20.2341 18.2313C21.3199 19.3038 21.9925 20.7868 21.9925 22.4286C21.9925 20.7868 22.6651 19.1837 23.7509 17.9841C24.839 16.7868 26.3403 16 28 16C24.6806 16 21.9925 12.8481 21.9925 9.57141Z" fill="white"/>
        </svg>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
        {NAV_SECTIONS.flatMap((section) => {
          if (!canAccessSection(role, section.rbacSection)) return [];

          return section.items
            .filter((item) => !item.hidden && canAccessModule(role, item.rbacModule))
            .map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-nokturo-200 dark:bg-nokturo-700 text-nokturo-700 dark:text-nokturo-100'
                    : 'text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200'
                }`
              }
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ));
        })}
      </nav>

      {/* Footer – user info (name, title), settings, logout */}
      <div className="px-4 py-4 flex items-center gap-2 relative bg-nokturo-200 dark:bg-nokturo-700" ref={notifRef}>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowNotifications((v) => !v)}
            className="relative w-9 h-9 rounded-full overflow-hidden bg-nokturo-200 dark:bg-nokturo-600 flex items-center justify-center hover:ring-2 hover:ring-nokturo-400 dark:hover:ring-nokturo-500 transition-all focus:outline-none"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <DefaultAvatar size={36} />
            )}
          </button>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-nokturo-200 dark:ring-nokturo-700 pointer-events-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {showNotifications && (
          <div className="absolute bottom-full left-3 mb-2 w-[360px] rounded-xl max-h-80 overflow-hidden flex flex-col z-50 bg-white border border-nokturo-200 shadow-2xl shadow-nokturo-900/10 dark:bg-nokturo-900 dark:border-nokturo-600 dark:shadow-black/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-nokturo-100 dark:border-nokturo-700 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-nokturo-700 dark:text-nokturo-300" />
                <span className="text-sm font-semibold text-nokturo-900 dark:text-nokturo-100">{t('notifications.title')}</span>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                    {unreadCount}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-nokturo-500 dark:text-nokturo-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {t('notifications.clearAll')}
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-nokturo-300 dark:text-nokturo-600 mx-auto mb-2" />
                  <p className="text-sm text-nokturo-500 dark:text-nokturo-400">{t('notifications.noNotifications')}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 border-b last:border-b-0 ${
                      !n.read
                        ? 'bg-blue-50/60 hover:bg-blue-50 border-blue-100/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 dark:border-nokturo-700/50'
                        : 'hover:bg-nokturo-50 border-nokturo-100/50 dark:hover:bg-nokturo-800/50 dark:border-nokturo-700/50'
                    }`}
                  >
                    <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${!n.read ? 'bg-red-500' : 'bg-nokturo-300 dark:bg-nokturo-600'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${!n.read ? 'text-nokturo-900 dark:text-nokturo-100 font-semibold' : 'text-nokturo-700 dark:text-nokturo-300 font-medium'}`}>{n.title}</p>
                      {n.message && <p className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate mt-0.5">{n.message}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm text-nokturo-900 dark:text-nokturo-100 truncate font-medium leading-tight">
            {user?.firstName || user?.name}
          </div>
          <div className="text-xs text-nokturo-500 dark:text-nokturo-400 truncate leading-tight">
            {user?.role && t(`roles.${user.role}`)}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <NavLink
            to="/settings/account"
            className={({ isActive }) =>
              `flex items-center justify-center w-8 h-8 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-nokturo-200 dark:bg-nokturo-600 text-nokturo-700 dark:text-nokturo-100'
                  : 'text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200'
              }`
            }
            title={t('common.settings')}
          >
            <Settings className="w-4 h-4" strokeLinejoin="miter" strokeLinecap="square" />
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-sm text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
            title={t('common.logout')}
          >
            <LogOut className="w-4 h-4" strokeLinejoin="miter" strokeLinecap="square" />
          </button>
        </div>
      </div>
    </aside>
  );
}
