import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Catches React Router errors (404, load errors) and shows a friendly fallback.
 * Use as errorElement on routes.
 */
export function RouterErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-nokturo-50 dark:bg-nokturo-900 px-6 py-20 text-center">
      <p className="text-nokturo-600 dark:text-nokturo-400 font-medium mb-4">
        {is404
          ? t('errors.pageNotFound', 'Page not found')
          : t('errors.pageNotLoaded', 'Page could not be loaded.')}
      </p>
      {import.meta.env.DEV && error && (
        <pre className="text-xs text-nokturo-500 mb-4 max-w-md overflow-auto text-left">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      )}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="px-4 py-2 bg-nokturo-700 text-white rounded-lg hover:bg-nokturo-600 dark:bg-nokturo-600 dark:hover:bg-nokturo-500 transition-colors"
      >
        {t('errors.backToHome', 'Back to home')}
      </button>
    </div>
  );
}
