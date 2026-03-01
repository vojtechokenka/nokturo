interface IdeasIconProps {
  className?: string;
  size?: number;
}

export function IdeasIcon({ className, size = 18 }: IdeasIconProps) {
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
        d="M19 14h-5v5zM3 21V3h18v12l-6 6zm4-7h5v-2H7zm0-4h10V8H7z"
      />
    </svg>
  );
}
