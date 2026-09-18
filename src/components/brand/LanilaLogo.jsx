/**
 * LANILA mark — L + leaf/flow (brand kit)
 * Variants: full | mark | mono
 */
export default function LanilaLogo({
  size = 40,
  variant = 'full', // full | mark | mono
  showWordmark = true,
  productName = null,
  className = '',
}) {
  const gradId = `lanila-g-${size}-${variant}`
  const fill = variant === 'mono' ? 'currentColor' : `url(#${gradId})`

  const Mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={showWordmark ? true : undefined}
      role={showWordmark ? undefined : 'img'}
      aria-label={showWordmark ? undefined : 'Lanila'}
    >
      {variant !== 'mono' && (
        <defs>
          <linearGradient id={gradId} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="0.55" stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C4DFF" />
          </linearGradient>
        </defs>
      )}
      {/* Geometric L + organic leaf curve */}
      <path
        d="M12 6c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v22c0 .4.2.8.5 1.1l8.2 8.2c.9.9.3 2.4-1 2.4H14c-1.1 0-2-.9-2-2V6z"
        fill={fill}
      />
      <path
        d="M27 29c5-1.2 10.5.2 14 4.2.9 1-.2 2.5-1.4 2.2-4.5-.8-8.8-2.8-11.8-5.8-.6-.6-.3-1.4-.2-1.4.1 0 .1 0 .4-.2z"
        fill={fill}
        opacity={variant === 'mono' ? 0.85 : 0.95}
      />
    </svg>
  )

  if (!showWordmark) {
    return <span className={className}>{Mark}</span>
  }

  return (
    <div className={`lanila-lockup ${className}`}>
      {Mark}
      <div className="lanila-lockup-text">
        <span className="lanila-wordmark">Lanila</span>
        {productName ? (
          <span className="lanila-product-name">{productName}</span>
        ) : (
          <span className="lanila-tagline">Better Tools · Brighter Days</span>
        )}
      </div>
    </div>
  )
}
