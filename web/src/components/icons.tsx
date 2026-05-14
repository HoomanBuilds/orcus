interface IconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function OrcusLogo({ className, size = 48 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-label="Orcus">
      <circle cx="18" cy="24" r="13" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.9" />
      <circle cx="30" cy="24" r="13" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="24" cy="24" r="5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
    </svg>
  );
}

export function VaultIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="4" width="16" height="13" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.25" />
      <line x1="10" y1="7.5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="13" y1="10.5" x2="15" y2="10.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="7" y1="10.5" x2="5" y2="10.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="4" y1="4" x2="4" y2="2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="16" y1="4" x2="16" y2="2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M10 2L3 5v5c0 4.4 3 8.1 7 9 4-0.9 7-4.6 7-9V5L10 2z"
        stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"
      />
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SwapIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M3 7h14M14 4l3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 13H3M6 10l-3 3 3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReceiptIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M5 2h10a1 1 0 011 1v14l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5V3a1 1 0 011-1z"
        stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"
      />
      <line x1="7" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="7" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRight({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
