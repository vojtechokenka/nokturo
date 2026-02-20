import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
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
  BookOpen,
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
      { key: 'magazine', path: '/prototyping/magazine', icon: <BookOpen {...iconProps} />, labelKey: 'nav.magazine', rbacModule: 'prototyping.magazine' },
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
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'host';
  const closeMobileSidebar = useSidebarStore((s) => s.close);

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications(user?.id);

  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname]);

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
        <svg className="h-[18px] w-auto" viewBox="0 0 225 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#sidebar-logo-clip)">
            <path d="M0 19.4872V23.5897C9.04615 23.5897 16.4103 30.9539 16.4103 40H20.5128C20.5128 28.6872 11.3128 19.4872 0 19.4872Z" className="fill-nokturo-900 dark:fill-white"/>
            <path d="M20.5128 40H22.5641C22.5641 30.3897 30.3897 22.5641 40 22.5641V20.5128C29.2513 20.5128 20.5128 29.2513 20.5128 40Z" className="fill-nokturo-900 dark:fill-white"/>
            <path d="M23.5897 0H19.4872C19.4872 11.3128 28.6872 20.5128 40 20.5128V16.4103C30.9539 16.4103 23.5897 9.04615 23.5897 0Z" className="fill-nokturo-900 dark:fill-white"/>
            <path d="M19.4872 0H17.4359C17.4359 9.61026 9.61026 17.4359 0 17.4359V19.4872C10.7487 19.4872 19.4872 10.7487 19.4872 0Z" className="fill-nokturo-900 dark:fill-white"/>
          </g>
          <path d="M212.459 40C205.103 40 200.066 34.7607 200.066 26.2972C200.066 17.9345 205.305 12.393 212.559 12.393C219.915 12.393 224.952 17.6323 224.952 26.0957C224.952 34.4584 219.713 40 212.459 40ZM212.559 38.6902C217.194 38.6902 219.31 33.6524 219.31 26.1965C219.31 19.0428 217.093 13.7028 212.459 13.7028C207.824 13.7028 205.708 18.7406 205.708 26.1965C205.708 33.3501 207.925 38.6902 212.559 38.6902Z" className="fill-nokturo-900 dark:fill-white"/>
          <path d="M198.234 12.393C198.838 12.393 199.544 12.4937 200.249 12.796L199.04 18.0353H198.536C197.327 17.0277 195.866 16.6247 194.859 16.6247C193.649 16.6247 192.541 17.1789 191.282 18.7909V33.8539C191.282 37.0781 191.433 38.7909 193.498 38.7909V39.3955H183.826V38.7909C185.891 38.7909 186.042 37.0781 186.042 33.8539V19.8489C186.042 16.6247 185.186 15.7179 183.473 15.1134V14.5088L190.879 12.4937H191.282V17.1285C193.398 14.2569 195.715 12.393 198.234 12.393Z" className="fill-nokturo-900 dark:fill-white"/>
          <path d="M179.692 12.4937V32.6448C179.692 35.869 180.548 37.2796 182.261 37.8841V38.4887L175.863 40H175.46L174.553 35.5667C171.934 38.0856 168.558 40 165.284 40C161.253 40 158.835 37.1788 158.835 32.1411V18.7406C158.835 15.5164 157.878 14.3073 156.165 13.7028V13.0982L163.672 12.4937H164.075V30.6297C164.075 34.1562 164.881 36.5743 168.457 36.5743C170.271 36.5743 172.538 35.6675 174.452 34.2569V18.7406C174.452 15.5164 173.495 14.3073 171.782 13.7028V13.0982L179.289 12.4937H179.692Z" className="fill-nokturo-900 dark:fill-white"/>
          <path d="M155.716 34.9622L156.472 35.7683C154.104 38.3879 150.981 40 148.16 40C144.28 40 142.064 37.9345 142.064 33.3501V15.2141H139.444V14.005L140.15 13.7028C143.071 12.4433 144.835 10.2267 146.699 6.04534H147.303V12.9975H156.119L155.364 15.2141H147.303V32.7456C147.303 35.5667 148.613 37.0277 151.081 37.0277C152.895 37.0277 154.507 35.9698 155.716 34.9622Z" className="fill-nokturo-900 dark:fill-white"/>
          <path d="M122.748 0V33.8539C122.748 37.0781 122.899 38.7909 124.965 38.7909V39.3955H115.292V38.7909C117.357 38.7909 117.509 37.0781 117.509 33.8539V6.95214C117.509 3.72796 116.652 2.82116 114.939 2.21663V1.61209L122.345 0H122.748ZM129.851 21.3098L128.541 22.6196C134.99 33.6524 138.415 38.3879 139.977 38.7909V39.3955C138.214 39.597 136.904 39.597 135.796 39.597C132.068 39.597 130.607 36.7758 124.058 25.2897L128.692 20.3526C130.758 18.1864 131.967 16.7758 131.967 15.3652C131.967 14.3577 131.211 13.7028 130.204 13.602V12.9975H139.373V13.602C137.66 13.9043 134.184 16.9773 129.851 21.3098Z" className="fill-nokturo-900 dark:fill-white"/>
          <path d="M100.781 40C93.426 40 88.3882 34.7607 88.3882 26.2972C88.3882 17.9345 93.6275 12.393 100.882 12.393C108.237 12.393 113.275 17.6323 113.275 26.0957C113.275 34.4584 108.036 40 100.781 40ZM100.882 38.6902C105.517 38.6902 107.633 33.6524 107.633 26.1965C107.633 19.0428 105.416 13.7028 100.781 13.7028C96.1464 13.7028 94.0305 18.7406 94.0305 26.1965C94.0305 33.3501 96.2471 38.6902 100.882 38.6902Z" className="fill-nokturo-900 dark:fill-white"/>
          <path d="M78.0655 3.32491V2.72038H87.5365V3.32491C84.6146 3.32491 84.1108 7.15362 84.1108 12.5944V40H83.1033L61.8438 7.85891V29.6221C61.8438 34.8614 62.8514 38.7909 65.9748 38.7909V39.3954H56V38.7909C58.9219 38.7909 60.131 34.8614 60.131 29.6221V8.86647C60.131 5.23927 58.2166 3.72793 56 3.32491V2.72038H65.068L82.398 29.2191V12.5944C82.398 7.15362 81.3904 3.32491 78.0655 3.32491Z" className="fill-nokturo-900 dark:fill-white"/>
          <defs>
            <clipPath id="sidebar-logo-clip">
              <rect width="40" height="40" className="fill-nokturo-900 dark:fill-white"/>
            </clipPath>
          </defs>
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
          <div className="absolute bottom-full left-3 mb-2 w-[calc(100vw-2rem)] max-w-[360px] rounded-xl max-h-80 overflow-hidden flex flex-col z-50 bg-white border border-nokturo-200 shadow-2xl shadow-nokturo-900/10 dark:bg-nokturo-900 dark:border-nokturo-600 dark:shadow-black/50">
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
