import { APP_NAME } from "../brand";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span class="flex items-center gap-2">
      <svg
        class="h-8 w-8 shrink-0 drop-shadow-sm"
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${APP_NAME} logo`}
      >
        <defs>
          <linearGradient id="kenzo-logo-surface" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop stop-color="#111827" />
            <stop offset="0.55" stop-color="#0f172a" />
            <stop offset="1" stop-color="#020617" />
          </linearGradient>
          <linearGradient id="kenzo-logo-highlight" x1="18" y1="14" x2="42" y2="50" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffffff" />
            <stop offset="1" stop-color="#dbeafe" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#kenzo-logo-surface)" />
        <path
          d="M18 16h8v18l17-18h10L36 34l18 14H42L26 35v13h-8V16z"
          fill="url(#kenzo-logo-highlight)"
        />
      </svg>
      {!compact && <span class="text-xl font-bold">{APP_NAME}</span>}
    </span>
  );
}
