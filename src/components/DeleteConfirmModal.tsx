import { useTranslation } from 'react-i18next';

interface DeleteConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="flex flex-col items-center text-center max-w-sm w-full mx-4 bg-elevated rounded-xl p-8 shadow-2xl">
        <h3 className="font-body text-[32px] sm:text-[40px] leading-tight font-medium text-white mb-6 tracking-[-0.02em]">
          {t('common.areYouSure')}
        </h3>
        <div className="flex flex-row gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-nokturo-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-[6px] transition-colors"
          >
            {t('common.takeMeBack')}
          </button>
          <button
            onClick={onConfirm}
            className="dropdown-menu-item-destructive flex-1 px-4 py-3 text-sm font-medium text-nokturo-700 dark:text-nokturo-200 hover:bg-red hover:text-red-fg rounded-[6px] transition-colors"
          >
            {t('common.yesDelete')}
          </button>
        </div>
      </div>
    </div>
  );
}
