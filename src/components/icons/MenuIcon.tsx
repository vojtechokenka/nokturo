interface MenuIconProps {
  className?: string;
  size?: number;
}

export function MenuIcon({ className, size = 24 }: MenuIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        fill="currentColor"
        d="M3 18v-2h18v2zm0-5v-2h18v2zm0-5V6h18v2z"
      />
    </svg>
  );
}
