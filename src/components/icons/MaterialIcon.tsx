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
  return (
    <span
      className={`material-symbols-sharp ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
