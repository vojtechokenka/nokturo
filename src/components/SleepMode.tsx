import { useState } from 'react';
import { Moon, Zap } from 'lucide-react';

interface SleepModeProps {
  onWakeUp: () => Promise<void>;
  reason?: string;
}

export function SleepMode({ onWakeUp, reason }: SleepModeProps) {
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleWakeUp = async () => {
    setIsWakingUp(true);
    try {
      await onWakeUp();
      setIsFadingOut(true);
    } catch (error) {
      console.error('Failed to wake up:', error);
      setTimeout(() => setIsWakingUp(false), 2000);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-nokturo-950 via-nokturo-900 to-nokturo-950 transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Slow rotating gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-spin bg-gradient-to-r from-nokturo-500/10 via-transparent to-nokturo-500/10"
          style={{ animationDuration: '30s' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center space-y-8 px-6 text-center">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-nokturo-400/20" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-nokturo-600 to-nokturo-700 shadow-2xl">
            <Moon className="h-12 w-12 text-nokturo-100" />
          </div>
        </div>

        {/* Title & reason */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Sleep Mode</h1>
          <p className="text-lg text-nokturo-400">
            {reason || 'Your session needs to be refreshed'}
          </p>
        </div>

        {/* Wake-up button */}
        <button
          onClick={handleWakeUp}
          disabled={isWakingUp}
          className="group relative overflow-hidden rounded-full bg-white px-8 py-4 text-lg font-semibold text-nokturo-900 shadow-2xl transition-all hover:scale-105 hover:shadow-nokturo-400/30 disabled:opacity-50 disabled:hover:scale-100"
        >
          <span className="relative z-10 flex items-center space-x-3">
            {isWakingUp ? (
              <>
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Waking up…</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                <span>Back to App</span>
              </>
            )}
          </span>

          {/* Hover tint */}
          <div className="absolute inset-0 -z-0 bg-nokturo-200 opacity-0 transition-opacity group-hover:opacity-20" />
        </button>

        {/* Helper text */}
        <p className="max-w-md text-sm text-nokturo-500">
          Don't worry, your work is safe. Click the button to refresh your
          session and continue where you left off.
        </p>
      </div>
    </div>
  );
}
