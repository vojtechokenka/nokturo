interface ComplianceIconProps {
  className?: string;
  size?: number;
}

export function ComplianceIcon({ className, size = 18 }: ComplianceIconProps) {
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
        d="M12 22q-.25 0-.488-.038t-.462-.137q-2.8-1.025-4.925-3.575T4 12.8V6q0-.825.588-1.412T6 4h12q.825 0 1.413.588T20 6v6.8q0 2.9-2.125 5.45T12.95 21.825q-.225.1-.462.138T12 22m-1.1-4.5l6.3-6.3q.275-.275.275-.7t-.275-.7t-.7-.275t-.7.275L10.2 15.4l-2-2q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7z"
      />
    </svg>
  );
}
