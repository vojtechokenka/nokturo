interface LabelsIconProps {
  className?: string;
  size?: number;
}

export function LabelsIcon({ className, size = 18 }: LabelsIconProps) {
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
        d="M2 20V4h20v16zm2-5h16V6H4z"
      />
    </svg>
  );
}
