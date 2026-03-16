import { useState } from 'react';
import { MaterialIcon } from './icons/MaterialIcon';
import { PRIMARY_BUTTON_CLASS } from '../lib/inputStyles';

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
          className={PRIMARY_BUTTON_CLASS}
        >
          {isWakingUp ? (
            <>
              <MaterialIcon name="progress_activity" size={16} className="animate-spin shrink-0" />
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
