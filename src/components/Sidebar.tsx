import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { canAccessSection, canAccessModule } from '../lib/rbac';
import type { Module } from '../lib/rbac';
import { Calculator } from 'lucide-react';

const iconProps = { size: 18, strokeLinejoin: 'miter' as const, strokeLinecap: 'square' as const };

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
      { key: 'identity', path: '/brand/identity', icon: <IdentityIcon size={20} className="shrink-0" />, labelKey: 'nav.identity', rbacModule: 'brand.identity' },
    ],
  },
  {
    key: 'prototyping',
    labelKey: 'nav.prototyping',
    rbacSection: 'prototyping',
    items: [
      { key: 'moodboard', path: '/prototyping/moodboard', icon: <MoodboardIcon size={20} className="shrink-0" />, labelKey: 'nav.moodboard', rbacModule: 'prototyping.moodboard' },
      { key: 'ideas', path: '/prototyping/ideas', icon: <IdeasIcon size={20} className="shrink-0" />, labelKey: 'nav.ideas', rbacModule: 'prototyping.ideas' },
      { key: 'magazine', path: '/prototyping/magazine', icon: <MagazineIcon size={20} className="shrink-0" />, labelKey: 'nav.magazine', rbacModule: 'prototyping.magazine' },
    ],
  },
  {
    key: 'production',
    labelKey: 'nav.production',
    rbacSection: 'production',
    items: [
      { key: 'materials', path: '/production/materials', icon: <MaterialsIcon size={20} className="shrink-0" />, labelKey: 'nav.materialLibrary', rbacModule: 'production.materials' },
      { key: 'components', path: '/production/components', icon: <ComponentsIcon size={20} className="shrink-0" />, labelKey: 'nav.componentsLibrary', rbacModule: 'production.components' },
      { key: 'labels', path: '/production/labels', icon: <LabelsIcon size={20} className="shrink-0" />, labelKey: 'nav.labelsLibrary', rbacModule: 'production.labels' },
      { key: 'products', path: '/production/products', icon: <ProductsIcon size={20} className="shrink-0" />, labelKey: 'nav.products', rbacModule: 'production.products' },
      { key: 'sampling', path: '/production/sampling', icon: <SamplingIcon size={20} className="shrink-0" />, labelKey: 'nav.readyForSampling', rbacModule: 'production.sampling' },
    ],
  },
  {
    key: 'business',
    labelKey: 'nav.business',
    rbacSection: 'business',
    items: [
      { key: 'costing', path: '/business/costing', icon: <Calculator {...iconProps} />, labelKey: 'nav.costingCalculator', rbacModule: 'business.costing', hidden: true },
      { key: 'suppliers', path: '/business/suppliers', icon: <SuppliersIcon size={20} className="shrink-0" />, labelKey: 'nav.supplierDirectory', rbacModule: 'business.suppliers' },
      { key: 'accounting', path: '/business/accounting', icon: <AccountingIcon size={20} className="shrink-0" />, labelKey: 'nav.accounting', rbacModule: 'business.accounting' },
    ],
  },
];

import { NokturoLogo } from './NokturoLogo';
import { MoodboardIcon } from './icons/MoodboardIcon';
import { IdeasIcon } from './icons/IdeasIcon';
import { AccountingIcon } from './icons/AccountingIcon';
import { SuppliersIcon } from './icons/SuppliersIcon';
import { SamplingIcon } from './icons/SamplingIcon';
import { ProductsIcon } from './icons/ProductsIcon';
import { LabelsIcon } from './icons/LabelsIcon';
import { ComponentsIcon } from './icons/ComponentsIcon';
import { MaterialsIcon } from './icons/MaterialsIcon';
import { IdentityIcon } from './icons/IdentityIcon';
import { MagazineIcon } from './icons/MagazineIcon';
import { MenuIcon } from './icons/MenuIcon';

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'host';
  const closeMobileSidebar = useSidebarStore((s) => s.close);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);

  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname]);

  return (
    <aside
      className={`h-screen bg-nokturo-100 dark:bg-black flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[60px]' : 'w-60'
      }`}
    >
      {/* Header – hamburger + logo */}
      <div className={`shrink-0 flex items-center h-[60px] ${collapsed ? 'justify-center px-1.5' : 'px-3 gap-3'}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-nokturo-700 dark:text-white/60 hover:text-nokturo-900 dark:hover:text-white/80 transition-colors"
          title={t('common.toggleSidebar')}
        >
          <MenuIcon size={20} className="shrink-0" />
        </button>
        {!collapsed && (
          <Link to="/brand/strategy" className="flex items-center" title={t('nav.strategy')}>
            <NokturoLogo className="h-[16px] w-auto text-nokturo-900 dark:text-nokturo-100" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto flex flex-col">
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
                `flex items-center gap-2.5 w-full h-11 text-sm transition-colors whitespace-nowrap overflow-hidden ${
                  collapsed ? 'justify-center px-0' : 'px-5'
                } ${
                  isActive
                    ? 'text-nokturo-900 dark:text-white bg-[linear-gradient(to_right,currentColor_4px,transparent_4px)] dark:bg-[linear-gradient(to_right,white_4px,transparent_4px)]'
                    : 'text-nokturo-700 dark:text-white/60 hover:text-nokturo-900 dark:hover:text-white/80'
                }`
              }
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ));
        })}
      </nav>
    </aside>
  );
}
