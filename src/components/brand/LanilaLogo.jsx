/**
 * LANILA official mark — L + leaf/flow
 * Brand colors: #3B82F6 → #8B5CF6 → #7C4DFF
 */
export default function LanilaLogo({
  size = 40,
  showWordmark = true,
  productName = null,
  mono = false,
  className = '',
}) {
  const gid = `lanilaGrad-${size}-${mono ? 'm' : 'c'}`

  const Mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={showWordmark ? true : undefined}
      role={showWordmark ? undefined : 'img'}
      aria-label={showWordmark ? undefined : 'Lanila'}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {!mono && (
        <defs>
          <linearGradient id={gid} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="0.45" stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C4DFF" />
          </linearGradient>
        </defs>
      )}
      {/* Vertical stem of L */}
      <path
        d="M16 10c0-2.2 1.8-4 4-4h10c2.2 0 4 1.8 4 4v28c0 .8.3 1.5.9 2.1l11 11c1.6 1.6.5 4.4-1.8 4.4H20c-2.2 0-4-1.8-4-4V10z"
        fill={mono ? 'currentColor' : `url(#${gid})`}
      />
      {/* Leaf / flow curve */}
      <path
        d="M36 38c7.5-1.8 15.5.5 20.5 6.2 1.5 1.7-.4 4.2-2.5 3.8-7-.8-13.5-4-17.5-8.8-.8-.9-.3-1.8-.5-1.2z"
        fill={mono ? 'currentColor' : `url(#${gid})`}
        opacity={0.95}
      />
    </svg>
  )

  if (!showWordmark) {
    return <span className={className} style={{ display: 'inline-flex' }}>{Mark}</span>
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
      }}
    >
      {Mark}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: Math.max(14, size * 0.42),
            letterSpacing: '-0.03em',
            color: 'var(--ink, #EDEAE0)',
            lineHeight: 1.15,
          }}
        >
          Lanila
        </span>
        {productName ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--ink-dim, #A9B0A8)',
            }}
          >
            {productName}
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              color: 'var(--ink-dim, #A9B0A8)',
              letterSpacing: '0.02em',
            }}
          >
            Better Tools · Brighter Days
          </span>
        )}
      </div>
    </div>
  )
}
