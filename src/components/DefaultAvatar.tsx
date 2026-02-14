interface DefaultAvatarProps {
  className?: string;
  size?: number;
}

/** Default profile avatar – abstract person silhouette on light gray background */
export function DefaultAvatar({ className = '', size = 100 }: DefaultAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" fill="#E0E0E0" />
      <path
        d="M66.2267 30C66.2267 40.1728 57.8551 48.4339 47.5108 48.4621C42.3458 48.4621 37.6614 46.388 34.2683 43.0511C30.8752 39.7143 28.7733 35.1005 28.7733 30C28.7733 35.1005 26.6643 40.0952 23.2712 43.8272C19.878 47.552 15.1865 50 10 50C20.3659 50 28.7733 59.7989 28.7733 70C28.7733 59.8201 37.1449 51.5661 47.4892 51.5379C52.6542 51.5379 57.3386 53.612 60.7317 56.9418C64.1248 60.2787 66.2267 64.8924 66.2267 70C66.2267 64.8924 68.3286 59.9048 71.7217 56.1728C75.122 52.448 79.8135 50 85 50C74.627 50 66.2267 40.194 66.2267 30Z"
        fill="black"
        fillOpacity="0.5"
      />
    </svg>
  );
}
