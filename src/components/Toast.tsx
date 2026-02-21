import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────
export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

// ── Single toast item ────────────────────────────────────────────
function ToastItem({ toast, onClose }: { toast: ToastData; onClose: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  }, [onClose, toast.id]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(dismiss, 3500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [dismiss]);

  const styles = {
    success: {
      bg: 'bg-green-100 dark:bg-green-900',
      text: 'text-green-800 dark:text-green-100',
      icon: 'text-green-700 dark:text-green-200',
    },
    error: {
      bg: 'bg-red-100 dark:bg-red-900',
      text: 'text-red-800 dark:text-red-100',
      icon: 'text-red-700 dark:text-red-200',
    },
    info: {
      bg: 'bg-blue-100 dark:bg-blue-900',
      text: 'text-blue-800 dark:text-blue-100',
      icon: 'text-blue-700 dark:text-blue-200',
    },
  }[toast.type];

  const icon = {
    success: <CheckCircle className={`w-4 h-4 ${styles.icon} shrink-0`} />,
    error: <AlertCircle className={`w-4 h-4 ${styles.icon} shrink-0`} />,
    info: <Info className={`w-4 h-4 ${styles.icon} shrink-0`} />,
  }[toast.type];

  return (
    <div
      className={`flex items-center gap-3 ${styles.bg} rounded-lg px-4 py-3 shadow-lg transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {icon}
      <span className={`text-sm ${styles.text}`}>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          onClick={() => {
            toast.onAction!();
            dismiss();
          }}
          className={`ml-1 text-sm font-medium ${styles.text} underline underline-offset-2 hover:opacity-80 transition-opacity`}
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        onClick={dismiss}
        className={`ml-2 ${styles.text} opacity-70 hover:opacity-100 transition-all`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Toast container (renders bottom-left or bottom-right) ─────────
export function ToastContainer({
  toasts,
  onClose,
  position = 'right',
}: {
  toasts: ToastData[];
  onClose: (id: string) => void;
  position?: 'left' | 'right';
}) {
  if (toasts.length === 0) return null;

  return (
    <div className={`fixed bottom-6 z-[100] flex flex-col gap-2 pointer-events-auto ${position === 'left' ? 'left-6' : 'right-6'}`}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
