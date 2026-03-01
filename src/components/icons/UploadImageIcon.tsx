interface UploadImageIconProps {
  className?: string;
  size?: number;
}

export function UploadImageIcon({ className, size = 24 }: UploadImageIconProps) {
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
        d="M2 20V4h8l2 2h10v14zm9-3h2v-4.2l1.6 1.6L16 13l-4-4l-4 4l1.4 1.4l1.6-1.6z"
      />
    </svg>
  );
}
