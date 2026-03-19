/**
 * Google Material Symbols Sharp (fill).
 * Icon names: https://fonts.google.com/icons
 */
interface MaterialIconProps {
  name: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function MaterialIcon({ name, className = '', size = 24, style }: MaterialIconProps) {
  if (name === 'progress_activity') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={style}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <span
      className={`material-symbols-sharp ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
