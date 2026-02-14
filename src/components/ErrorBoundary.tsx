import { Component, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches React render errors so the app doesn't go blank.
 * Shows minimal recovery UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Nokturo] Page error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error }: { error?: Error }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <p className="text-nokturo-600 dark:text-nokturo-400 font-medium mb-4">
        {t('errors.pageNotLoaded', 'Page could not be loaded.')}
      </p>
      {import.meta.env.DEV && error && (
        <pre className="text-xs text-nokturo-500 mb-4 max-w-md overflow-auto text-left">
          {error.message}
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
