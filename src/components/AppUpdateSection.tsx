import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from './icons/MaterialIcon';
import { isElectron } from '../utils/platform';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error' | 'dev';

interface AppUpdateSectionProps {
  /** Use compact styling (e.g. on login page) */
  compact?: boolean;
}

export function AppUpdateSection({ compact = false }: AppUpdateSectionProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?');

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((v) => {
        if (v) setAppVersion(v);
      });
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    const cleanup = window.electronAPI.onUpdateStatus((s, info) => {
      switch (s) {
        case 'checking':
          setStatus('checking');
          break;
        case 'available':
          setStatus('available');
          setNewVersion((info as { version?: string })?.version ?? null);
          break;
        case 'up-to-date':
          setStatus('up-to-date');
          break;
        case 'downloading':
          setStatus('downloading');
          setDownloadPercent((info as { percent?: number })?.percent ?? 0);
          break;
        case 'downloaded':
          setStatus('downloaded');
          setNewVersion((info as { version?: string })?.version ?? null);
          break;
        case 'error':
          setStatus('error');
          setErrorMsg((info as { message?: string })?.message ?? null);
          break;
      }
    });
    return cleanup;
  }, []);

  const handleCheck = useCallback(async () => {
    setStatus('checking');
    setErrorMsg(null);
    if (!window.electronAPI?.checkForUpdate) {
      setStatus('dev');
      return;
    }
    const result = await window.electronAPI.checkForUpdate();
    if (result.status === 'dev') {
      setStatus('dev');
    } else if (result.status === 'error') {
      setStatus('error');
      setErrorMsg(result.message ?? null);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!window.electronAPI?.downloadUpdate) return;
    setStatus('downloading');
    setDownloadPercent(0);
    await window.electronAPI.downloadUpdate();
  }, []);

  const handleInstall = useCallback(() => {
    if (!window.electronAPI?.installUpdate) return;
    window.electronAPI.installUpdate();
  }, []);

  const containerClass = compact
    ? 'pt-4 mt-4 border-t border-nokturo-200 dark:border-nokturo-700 space-y-2'
    : 'pt-6 border-t border-nokturo-200 dark:border-nokturo-700 space-y-3';

  if (!isElectron()) return null;

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-nokturo-500 dark:text-nokturo-400">
          Nokturo <span className="font-medium text-nokturo-700 dark:text-nokturo-300">{appVersion}</span>
        </p>

        {status === 'idle' && (
          <button
            type="button"
            onClick={handleCheck}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-white dark:bg-nokturo-700 text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 transition-colors"
          >
            <MaterialIcon name="refresh" size={14} className="shrink-0" />
            {t('settings.account.checkUpdate', 'Zkontrolovat update')}
          </button>
        )}

        {status === 'checking' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-nokturo-500 dark:text-nokturo-400">
            <MaterialIcon name="progress_activity" size={14} className="animate-spin shrink-0" />
            {t('settings.account.checkingUpdate', 'Kontroluji...')}
          </span>
        )}

        {status === 'available' && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-nokturo-700 dark:bg-nokturo-600 text-sm text-white hover:bg-nokturo-600 dark:hover:bg-nokturo-500 transition-colors"
          >
            <MaterialIcon name="download" size={14} className="shrink-0" />
            {t('settings.account.downloadUpdate', 'Stáhnout')} v{newVersion}
          </button>
        )}

        {status === 'downloading' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-nokturo-500 dark:text-nokturo-400">
            <MaterialIcon name="progress_activity" size={14} className="animate-spin shrink-0" />
            {t('settings.account.downloadingUpdate', 'Stahuji...')} {downloadPercent}%
          </span>
        )}

        {status === 'downloaded' && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-green text-sm text-green-fg hover:bg-green/90 transition-colors"
          >
            <MaterialIcon name="check_circle" size={14} className="shrink-0" />
            {t('settings.account.installUpdate', 'Nainstalovat a restartovat')}
          </button>
        )}

        {status === 'up-to-date' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green dark:text-green-fg">
            <MaterialIcon name="check_circle" size={14} className="shrink-0" />
            {t('settings.account.upToDate', 'Máš nejnovější verzi')}
          </span>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={handleCheck}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none text-red text-sm hover:bg-red hover:text-red-fg transition-colors"
          >
            <MaterialIcon name="warning" size={14} className="shrink-0" />
            {t('settings.account.retryUpdate', 'Zkusit znovu')}
          </button>
        )}

        {status === 'dev' && (
          <span className="text-xs text-nokturo-400 dark:text-nokturo-500">Dev mode — update jen v buildu</span>
        )}
      </div>

      {status === 'error' && errorMsg && <p className="text-xs text-red-fg">{errorMsg}</p>}
    </div>
  );
}
