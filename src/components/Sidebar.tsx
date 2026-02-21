import { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { canAccessSection, canAccessModule } from '../lib/rbac';
import type { Module } from '../lib/rbac';
import { supabase } from '../lib/supabase';
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
  const collapsed = useSidebarStore((s) => s.collapsed);

  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname]);

  const handleLogout = async () => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
      useAuthStore.getState().logout();
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <aside
      className={`h-screen bg-nokturo-100 dark:bg-nokturo-800 flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[60px]' : 'w-60'
      }`}
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {NAV_SECTIONS.flatMap((section) => {
          if (!canAccessSection(role, section.rbacSection)) return [];

          return section.items
            .filter((item) => !item.hidden && canAccessModule(role, item.rbacModule))
            .map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              title={collapsed ? t(item.labelKey) : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded text-sm transition-colors whitespace-nowrap overflow-hidden ${
                  collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
                } ${
                  isActive
                    ? 'bg-nokturo-200 dark:bg-nokturo-700 text-nokturo-700 dark:text-nokturo-100'
                    : 'text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200'
                }`
              }
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ));
        })}
      </nav>

      {/* Footer – user info */}
      <div className="px-2.5 py-3 flex items-center gap-2 bg-nokturo-200 dark:bg-nokturo-700 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/settings/account')}
          className="relative shrink-0 w-9 h-9 rounded-full overflow-hidden bg-nokturo-200 dark:bg-nokturo-600 flex items-center justify-center hover:ring-2 hover:ring-nokturo-400 dark:hover:ring-nokturo-500 transition-all focus:outline-none"
          title={t('common.settings')}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <DefaultAvatar size={36} />
          )}
        </button>
        {!collapsed && (
          <>
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
                      ? 'bg-nokturo-300/50 dark:bg-nokturo-600 text-nokturo-700 dark:text-nokturo-100'
                      : 'text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-300/50 dark:hover:bg-nokturo-600 hover:text-nokturo-800 dark:hover:text-nokturo-200'
                  }`
                }
                title={t('common.settings')}
              >
                <Settings className="w-4 h-4" strokeLinejoin="miter" strokeLinecap="square" />
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-sm text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-300/50 dark:hover:bg-nokturo-600 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
                title={t('common.logout')}
              >
                <LogOut className="w-4 h-4" strokeLinejoin="miter" strokeLinecap="square" />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
