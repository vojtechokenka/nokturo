interface PageShellProps {
  titleKey?: string;
  descriptionKey?: string;
  children?: React.ReactNode;
}

/**
 * Reusable page wrapper for module views.
 */
export function PageShell({ children }: PageShellProps) {
  return (
    <div className="p-6">
      {children ? (
        children
      ) : (
        <div className="p-8 text-center text-nokturo-500 dark:text-nokturo-400">
          <span>Module content will be implemented here.</span>
        </div>
      )}
    </div>
  );
}
