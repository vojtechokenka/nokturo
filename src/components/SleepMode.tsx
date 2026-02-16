import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SleepModeProps {
  onWakeUp: () => Promise<void>;
  reason?: string;
}

export function SleepMode({ onWakeUp }: SleepModeProps) {
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
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-nokturo-950 transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <h1 className="font-headline text-4xl text-white">Sleep mode</h1>

        <button
          onClick={handleWakeUp}
          disabled={isWakingUp}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors disabled:opacity-50"
        >
          {isWakingUp ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Back to App
            </>
          ) : (
            'Back to App'
          )}
        </button>
      </div>
    </div>
  );
}
