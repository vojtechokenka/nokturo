interface AboutNokturoIconProps {
  className?: string;
  size?: number;
}

export function AboutNokturoIcon({ className, size = 20 }: AboutNokturoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_about_nokturo)">
        <path
          d="M4.8002 3.86182C4.8002 7.83919 8.02282 11.0618 12.0002 11.0618C15.9761 11.0618 19.2002 7.83908 19.2002 3.86182H20.8002V19.8618H19.2002C19.2002 15.886 15.976 12.6618 12.0002 12.6618C8.02293 12.6618 4.8002 15.8859 4.8002 19.8618H3.2002V3.86182H4.8002Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_about_nokturo">
          <rect width="16" height="16" fill="white" transform="translate(4 4)" />
        </clipPath>
      </defs>
    </svg>
  );
}
