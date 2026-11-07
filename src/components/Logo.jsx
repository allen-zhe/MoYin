export function Logo({ size = 58, className = '' }) {
  return (
    <div className={`brand-logo ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none">
        <defs>
          <linearGradient id="lg-a" x1="9" y1="5" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffc15e" />
            <stop offset=".48" stopColor="#f28b2b" />
            <stop offset="1" stopColor="#c85a14" />
          </linearGradient>
          <linearGradient id="lg-b" x1="18" y1="14" x2="46" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#fff1dc" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#lg-a)" />
        <circle cx="52" cy="13" r="14" fill="#ffffff" opacity=".12" />
        <path d="M19.5 15.5h18.8l7.2 7.3v26.7c0 1.4-1.1 2.5-2.5 2.5H19.5c-1.4 0-2.5-1.1-2.5-2.5v-31c0-1.4 1.1-3 2.5-3Z" fill="url(#lg-b)" />
        <path d="M38.3 15.5v5.8c0 .9.7 1.6 1.6 1.6h5.6l-7.2-7.4Z" fill="#ffd9a6" />
        <path d="M23.5 30.5h17M23.5 36h17M23.5 41.5h11" stroke="#df7621" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
        <circle cx="45.5" cy="47" r="4.2" fill="#8f3f10" opacity=".55" />
      </svg>
    </div>
  );
}

export function MiniLogo({ size = 22 }) {
  return (
    <span className="mini-logo" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <rect width="24" height="24" rx="7" fill="#e97c25" />
        <path d="M7 5.5h7l3 3v10H7v-13Z" fill="#fff" />
        <path d="M14 5.5v3h3" fill="#ffd9a6" />
        <path d="M9 11h6M9 14h6M9 17h4" stroke="#e97c25" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
