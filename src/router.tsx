import { createHashRouter, createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AppGuard } from './components/AppGuard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { isElectron } from './utils/platform';

// Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallback from './pages/auth/AuthCallback';

// Settings
import AccountPage from './pages/settings/AccountPage';
import SecurityPage from './pages/settings/SecurityPage';
import UsersPage from './pages/settings/UsersPage';

// Brand
import StrategyPage from './pages/brand/StrategyPage';
import IdentityPage from './pages/brand/IdentityPage';

// Prototyping
import MoodboardPage from './pages/prototyping/MoodboardPage';
import IdeasPage from './pages/prototyping/IdeasPage';
import MagazinePage from './pages/prototyping/MagazinePage';
import MagazineArticlePage from './pages/prototyping/MagazineArticlePage';
import MagazineEditorPage from './pages/prototyping/MagazineEditorPage';

// Production
import MaterialsPage from './pages/production/MaterialsPage';
import ComponentsPage from './pages/production/ComponentsPage';
import LabelsPage from './pages/production/LabelsPage';
import ProductsPage from './pages/production/ProductsPage';
import ProductDetailPage from './pages/production/ProductDetailPage';
import SamplingPage from './pages/production/SamplingPage';
import SamplingDetailPage from './pages/production/SamplingDetailPage';

// Business
import CostingPage from './pages/business/CostingPage';
import SuppliersPage from './pages/business/SuppliersPage';
import AccountingPage from './pages/business/AccountingPage';

// Communication
import ChatPage from './pages/communication/ChatPage';
import CommentsPage from './pages/communication/CommentsPage';

const routes = [
  {
    path: '/',
    element: <AppGuard />,
    children: [
      // Public routes
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'auth/callback', element: <AuthCallback /> },

      // Protected routes (auth guard lives inside AppLayout)
      {
        path: '/',
        element: <AppLayout />,
        children: [
          // Default redirect
          { index: true, element: <Navigate to="/brand/strategy" replace /> },

          // Brand
          { path: 'brand/strategy', element: <StrategyPage /> },
          { path: 'brand/identity', element: <IdentityPage /> },

          // Prototyping
          { path: 'prototyping/moodboard', element: <MoodboardPage /> },
          { path: 'prototyping/ideas', element: <IdeasPage /> },
          { path: 'prototyping/magazine', element: <MagazinePage /> },
          { path: 'prototyping/magazine/new', element: <MagazineEditorPage /> },
          { path: 'prototyping/magazine/:id', element: <MagazineArticlePage /> },
          { path: 'prototyping/magazine/:id/edit', element: <MagazineEditorPage /> },

          // Production
          { path: 'production/materials', element: <MaterialsPage /> },
          { path: 'production/components', element: <ComponentsPage /> },
          { path: 'production/labels', element: <LabelsPage /> },
          { path: 'production/products', element: <ProductsPage /> },
          { path: 'production/products/:id', element: <ProductDetailPage /> },
          { path: 'production/sampling', element: <SamplingPage /> },
          { path: 'production/sampling/:productId', element: <SamplingDetailPage /> },

          // Business
          { path: 'business/costing', element: <CostingPage /> },
          { path: 'business/suppliers', element: <SuppliersPage /> },
          { path: 'business/accounting', element: <AccountingPage /> },

          // Communication
          { path: 'communication/chat', element: <ChatPage /> },
          { path: 'communication/comments', element: <CommentsPage /> },

          // Settings
          { path: 'settings/account', element: <AccountPage /> },
          { path: 'settings/security', element: <SecurityPage /> },
          { path: 'settings/users', element: <ProtectedRoute allowedRoles={['founder']}><UsersPage /></ProtectedRoute> },
        ],
      },
    ],
  },
];

const routerOpts = { future: { v7_startTransition: true } };

/**
 * Electron → HashRouter  (file:// protocol, URLs like /#/brand/strategy)
 * Web      → BrowserRouter with /app basename (URLs like /app/brand/strategy)
 */
export const router = isElectron()
  ? createHashRouter(routes, routerOpts)
  : createBrowserRouter(routes, { ...routerOpts, basename: '/app' });
