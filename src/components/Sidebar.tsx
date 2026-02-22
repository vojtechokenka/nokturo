import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { canAccessSection, canAccessModule } from '../lib/rbac';
import type { Module } from '../lib/rbac';
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
  Layers,
  Menu,
} from 'lucide-react';

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

function NoktureLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 199 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M156.459 40C149.103 40 144.066 34.7607 144.066 26.2972C144.066 17.9345 149.305 12.3929 156.559 12.3929C163.915 12.3929 168.952 17.6322 168.952 26.0957C168.952 34.4584 163.713 40 156.459 40ZM156.559 38.6902C161.194 38.6902 163.31 33.6524 163.31 26.1965C163.31 19.0428 161.093 13.7028 156.459 13.7028C151.824 13.7028 149.708 18.7405 149.708 26.1965C149.708 33.3501 151.925 38.6902 156.559 38.6902Z" fill="currentColor"/>
      <path d="M142.234 12.3929C142.838 12.3929 143.544 12.4937 144.249 12.796L143.04 18.0353H142.536C141.327 17.0277 139.866 16.6247 138.859 16.6247C137.649 16.6247 136.541 17.1788 135.282 18.7909V33.8539C135.282 37.0781 135.433 38.7909 137.498 38.7909V39.3955H127.826V38.7909C129.891 38.7909 130.042 37.0781 130.042 33.8539V19.8489C130.042 16.6247 129.186 15.7179 127.473 15.1133V14.5088L134.879 12.4937H135.282V17.1285C137.398 14.2569 139.715 12.3929 142.234 12.3929Z" fill="currentColor"/>
      <path d="M123.692 12.4937V32.6448C123.692 35.869 124.548 37.2796 126.261 37.8841V38.4887L119.863 40H119.46L118.553 35.5668C115.934 38.0856 112.558 40 109.284 40C105.253 40 102.835 37.1788 102.835 32.1411V18.7406C102.835 15.5164 101.878 14.3073 100.165 13.7028V13.0982L107.672 12.4937H108.075V30.6297C108.075 34.1562 108.881 36.5743 112.457 36.5743C114.271 36.5743 116.538 35.6675 118.452 34.2569V18.7406C118.452 15.5164 117.495 14.3073 115.782 13.7028V13.0982L123.289 12.4937H123.692Z" fill="currentColor"/>
      <path d="M99.7161 34.9622L100.472 35.7683C98.104 38.3879 94.9806 40 92.1595 40C88.2804 40 86.0637 37.9345 86.0637 33.3501V15.2141H83.4441V14.005L84.1494 13.7028C87.0713 12.4433 88.8345 10.2267 90.6985 6.04535H91.303V12.9975H100.119L99.3635 15.2141H91.303V32.7456C91.303 35.5667 92.6129 37.0277 95.0814 37.0277C96.895 37.0277 98.5071 35.9698 99.7161 34.9622Z" fill="currentColor"/>
      <path d="M66.7478 0V33.8539C66.7478 37.0781 66.8989 38.7909 68.9644 38.7909V39.3955H59.2919V38.7909C61.3573 38.7909 61.5085 37.0781 61.5085 33.8539V6.95214C61.5085 3.72796 60.6521 2.82116 58.9392 2.21663V1.61209L66.3448 0H66.7478ZM73.851 21.3098L72.5412 22.6196C78.9896 33.6524 82.4153 38.3879 83.977 38.7909V39.3955C82.2138 39.597 80.9039 39.597 79.7956 39.597C76.0677 39.597 74.6067 36.7758 68.0576 25.2897L72.6924 20.3526C74.7578 18.1864 75.9669 16.7758 75.9669 15.3652C75.9669 14.3577 75.2112 13.7028 74.2037 13.602V12.9975H83.3725V13.602C81.6596 13.9043 78.1835 16.9773 73.851 21.3098Z" fill="currentColor"/>
      <path d="M44.7811 40C37.426 40 32.3882 34.7607 32.3882 26.2972C32.3882 17.9345 37.6275 12.3929 44.8819 12.3929C52.237 12.3929 57.2748 17.6322 57.2748 26.0957C57.2748 34.4584 52.0355 40 44.7811 40ZM44.8819 38.6902C49.5166 38.6902 51.6325 33.6524 51.6325 26.1965C51.6325 19.0428 49.4159 13.7028 44.7811 13.7028C40.1464 13.7028 38.0305 18.7405 38.0305 26.1965C38.0305 33.3501 40.2471 38.6902 44.8819 38.6902Z" fill="currentColor"/>
      <path d="M22.0655 3.3249V2.72037H31.5365V3.3249C28.6146 3.3249 28.1108 7.15361 28.1108 12.5944V40H27.1033L5.84383 7.8589V29.6221C5.84383 34.8614 6.85138 38.7909 9.97481 38.7909V39.3954H0V38.7909C2.92191 38.7909 4.13098 34.8614 4.13098 29.6221V8.86646C4.13098 5.23926 2.21662 3.72793 0 3.3249V2.72037H9.06801L26.398 29.2191V12.5944C26.398 7.15361 25.3904 3.3249 22.0655 3.3249Z" fill="currentColor"/>
      <path d="M188.952 0C190.908 0 192.641 0.422764 194.149 1.26829C195.668 2.11382 196.848 3.29539 197.69 4.81301C198.531 6.33062 198.952 8.06504 198.952 10.0163C198.952 11.9675 198.531 13.7019 197.69 15.2195C196.848 16.7263 195.668 17.9024 194.149 18.748C192.641 19.5827 190.908 20 188.952 20C186.996 20 185.258 19.5827 183.739 18.748C182.231 17.9024 181.056 16.7263 180.214 15.2195C179.373 13.7019 178.952 11.9675 178.952 10.0163C178.952 8.06504 179.373 6.33062 180.214 4.81301C181.056 3.29539 182.231 2.11382 183.739 1.26829C185.258 0.422764 186.996 0 188.952 0ZM188.952 18.7154C190.679 18.7154 192.193 18.3577 193.493 17.6423C194.805 16.9268 195.816 15.9133 196.526 14.6016C197.247 13.2791 197.608 11.7507 197.608 10.0163C197.608 8.271 197.247 6.74255 196.526 5.43089C195.816 4.1084 194.805 3.08943 193.493 2.37398C192.193 1.6477 190.679 1.28455 188.952 1.28455C187.225 1.28455 185.706 1.6477 184.395 2.37398C183.083 3.08943 182.072 4.1084 181.362 5.43089C180.652 6.74255 180.296 8.271 180.296 10.0163C180.296 11.7615 180.652 13.29 181.362 14.6016C182.072 15.9133 183.083 16.9268 184.395 17.6423C185.706 18.3577 187.225 18.7154 188.952 18.7154ZM192.772 8.01626C192.772 9.46883 192.045 10.3957 190.591 10.7967L193.198 14.6016H191.706L189.214 11.0081C189.116 11.019 188.958 11.0244 188.739 11.0244H186.837L186.821 14.6016H185.51V4.97561H188.739C190.061 4.97561 191.061 5.24119 191.739 5.77236C192.428 6.29268 192.772 7.04065 192.772 8.01626ZM188.969 9.85366C189.832 9.85366 190.466 9.70732 190.87 9.41463C191.275 9.11111 191.477 8.64499 191.477 8.01626C191.477 6.76965 190.641 6.14634 188.969 6.14634H186.837V9.85366H188.969Z" fill="currentColor"/>
    </svg>
  );
}

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
      className={`h-screen bg-nokturo-100 dark:bg-nokturo-800 flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[60px]' : 'w-60'
      }`}
    >
      {/* Header – hamburger + logo */}
      <div className={`shrink-0 flex items-center h-[52px] ${collapsed ? 'justify-center px-1.5' : 'px-3 gap-3'}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 transition-colors"
          title={t('common.toggleSidebar')}
        >
          <Menu className="w-5 h-5" strokeLinejoin="miter" strokeLinecap="square" />
        </button>
        {!collapsed && (
          <NoktureLogo className="h-[16px] w-auto text-nokturo-900 dark:text-nokturo-100" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-2 pb-3 px-2 flex flex-col gap-0.5">
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
                    : 'text-nokturo-700 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200'
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
