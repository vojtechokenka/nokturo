import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { canAccessSection, canAccessModule } from '../lib/rbac';
import type { Module } from '../lib/rbac';
import { supabase } from '../lib/supabase';
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

interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

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
  const role = user?.role ?? 'client';

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id || user.id === 'dev-user') return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data || []) as Notification[]);
    const unread = (data || []).filter((n: Notification) => !n.read_at).length;
    setUnreadCount(unread);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => fetchNotifications())
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user?.id || user.id === 'dev-user') return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    fetchNotifications();
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    setShowNotifications(false);
    if (n.link) navigate(n.link);
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
        <button
          type="button"
          onClick={() => setShowNotifications((v) => !v)}
          className="relative w-9 h-9 rounded-full overflow-hidden bg-nokturo-200 dark:bg-nokturo-600 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-nokturo-400 dark:hover:ring-nokturo-500 transition-all focus:outline-none"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <DefaultAvatar size={36} />
          )}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-nokturo-100/80" />
          )}
        </button>
        {showNotifications && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-nokturo-800 rounded-lg max-h-64 overflow-hidden flex flex-col z-50 shadow-lg dark:shadow-nokturo-900/50">
            <div className="flex items-center justify-between px-3 py-2 shrink-0">
              <span className="text-sm font-semibold text-nokturo-900 dark:text-nokturo-100">{t('notifications.title')}</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {notifications.length === 0 ? (
                <p className="px-3 py-4 text-sm text-nokturo-500 dark:text-nokturo-400 text-center">{t('notifications.noNotifications')}</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-nokturo-50 dark:hover:bg-nokturo-700/50 transition-colors ${
                      !n.read_at ? 'bg-nokturo-50/50 dark:bg-nokturo-700/30' : ''
                    }`}
                  >
                    <p className="text-sm text-nokturo-900 dark:text-nokturo-100 font-medium truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-nokturo-600 dark:text-nokturo-400 truncate mt-0.5">{n.body}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm text-nokturo-900 dark:text-nokturo-100 truncate font-medium leading-tight">
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name}
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
