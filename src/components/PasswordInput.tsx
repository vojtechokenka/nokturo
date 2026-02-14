import { useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { INPUT_CLASS } from '../lib/inputStyles';

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Ikona vlevo (např. Lock) */
  leftIcon?: React.ReactNode;
  inputClassName?: string;
}

/**
 * Password input s ikonou oka – heslo se zobrazí jen při držení (hold) ikony.
 */
export function PasswordInput({
  leftIcon,
  className,
  inputClassName,
  ...inputProps
}: PasswordInputProps) {
  const [reveal, setReveal] = useState(false);

  const showPassword = useCallback(() => setReveal(true), []);
  const hidePassword = useCallback(() => setReveal(false), []);

  const baseClass = inputClassName ?? INPUT_CLASS;
  const paddingClass = leftIcon ? 'pl-10 pr-10' : '';

  return (
    <div className={`relative ${className ?? ''}`}>
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-nokturo-500 dark:text-nokturo-400">
          {leftIcon}
        </div>
      )}
      <input
        type={reveal ? 'text' : 'password'}
        {...inputProps}
        className={`${baseClass} ${paddingClass}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={reveal ? 'Skrýt heslo' : 'Zobrazit heslo'}
        onMouseDown={showPassword}
        onMouseUp={hidePassword}
        onMouseLeave={hidePassword}
        onTouchStart={showPassword}
        onTouchEnd={hidePassword}
        onTouchCancel={hidePassword}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-600 dark:hover:text-nokturo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-nokturo-500 select-none"
      >
        {reveal ? (
          <Eye className="w-4 h-4" />
        ) : (
          <EyeOff className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
