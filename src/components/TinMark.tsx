// The Kencleng mark: a brass tip tin with a coin going into the slot.
// Drawn by hand on a 64-unit grid; the same shapes are in public/favicon.svg.
export function TinMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <clipPath id="tin-slot-clip">
          <rect x="0" y="0" width="64" height="21" />
        </clipPath>
      </defs>
      {/* body */}
      <path d="M13 22 h38 v28 a8 8 0 0 1 -8 8 h-22 a8 8 0 0 1 -8 -8 z" fill="#C9A227" />
      {/* side shading */}
      <path d="M43 22 h8 v28 a8 8 0 0 1 -8 8 z" fill="#B8892B" />
      {/* rims */}
      <rect x="13" y="31" width="38" height="3.5" fill="#8A6418" />
      <rect x="13" y="45" width="38" height="3.5" fill="#8A6418" />
      {/* lid */}
      <ellipse cx="32" cy="22" rx="19" ry="6" fill="#E3B341" stroke="#8A6418" strokeWidth="2.5" />
      {/* slot */}
      <rect x="23" y="19.5" width="18" height="4" rx="2" fill="#0B1018" />
      {/* coin, half inside the slot */}
      <g clipPath="url(#tin-slot-clip)">
        <circle cx="32" cy="13" r="8.5" fill="#0AC18E" />
        <circle cx="32" cy="13" r="5.5" fill="none" stroke="#06231A" strokeWidth="1.6" opacity="0.55" />
      </g>
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <TinMark size={size} />
      <span className="logo-word">kencleng</span>
    </span>
  );
}
