// Locked Slot, direction A: the same vessel and branching rule as the hero.
export function TinMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M19 24h58v49c0 10-58 10-58 0Z" fill="none" stroke="currentColor" strokeWidth="6" />
      <ellipse cx="48" cy="24" rx="29" ry="9" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M36 23h24M48 34v13m0 0L32 61m16-14 16 14" stroke="var(--money)" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <TinMark size={size} />
      <span className="logo-word">Allpaid</span>
    </span>
  );
}
