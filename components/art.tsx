/**
 * Illustrations.
 *
 * Inline SVG rather than image files: they inherit --accent, so a property's
 * colour reaches the artwork without shipping a set per property, and they cost
 * no extra requests on a phone in a parking lot.
 *
 * House style, matched to the mockups: soft flat shapes, one accent, one muted
 * body, generous corner radii, no outlines thinner than 1.5.
 */

type P = { className?: string; size?: number }

const wrap = (size: number | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 120 96" width={size ?? 96} height={(size ?? 96) * 0.8}
       fill="none" aria-hidden focusable="false">
    {children}
  </svg>
)

const BODY = 'color-mix(in srgb, var(--text) 88%, transparent)'
const MUTE = 'var(--surface-2)'
const LINE = 'var(--line-2)'

export function CarArt({ size }: P) {
  return wrap(size, (
    <>
      <ellipse cx="60" cy="74" rx="42" ry="6" fill={MUTE} />
      <path d="M22 62c0-4 2-7 5-9l6-14c2-5 7-8 12-8h30c5 0 10 3 12 8l6 14c3 2 5 5 5 9v8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-2H34v2a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"
            fill={BODY} />
      <path d="M39 43l4-10c1-2 3-4 6-4h22c3 0 5 2 6 4l4 10z" fill="var(--accent-hi)" opacity="0.55" />
      <circle cx="36" cy="62" r="5" fill="var(--bg)" />
      <circle cx="84" cy="62" r="5" fill="var(--bg)" />
      <rect x="26" y="52" width="10" height="5" rx="2.5" fill="var(--warn)" opacity="0.9" />
      <rect x="84" y="52" width="10" height="5" rx="2.5" fill="var(--stop)" opacity="0.75" />
    </>
  ))
}

export function FobArt({ size }: P) {
  return wrap(size, (
    <>
      <ellipse cx="60" cy="82" rx="26" ry="5" fill={MUTE} />
      <rect x="42" y="14" width="36" height="62" rx="12" fill={BODY} />
      <rect x="47" y="19" width="26" height="52" rx="9" fill="var(--surface-2)" opacity="0.6" />
      <rect x="52" y="28" width="16" height="12" rx="4" fill="var(--accent-hi)" />
      <rect x="52" y="46" width="16" height="12" rx="4" fill={LINE} />
      <circle cx="60" cy="10" r="5" fill="none" stroke={BODY} strokeWidth="3" />
    </>
  ))
}

export function KeyTagArt({ size }: P) {
  return wrap(size, (
    <>
      <ellipse cx="60" cy="82" rx="24" ry="5" fill={MUTE} />
      <path d="M40 30a10 10 0 0 1 10-10h24a10 10 0 0 1 10 10v34a10 10 0 0 1-10 10H50a10 10 0 0 1-10-10z"
            fill={BODY} />
      <circle cx="62" cy="32" r="5" fill="var(--bg)" />
      <rect x="50" y="46" width="24" height="4" rx="2" fill="var(--accent-hi)" />
      <rect x="50" y="55" width="16" height="4" rx="2" fill={LINE} />
      <path d="M62 20V10" stroke={BODY} strokeWidth="3" strokeLinecap="round" />
      <circle cx="62" cy="7" r="4" fill="none" stroke={BODY} strokeWidth="3" />
    </>
  ))
}

export function TvArt({ size }: P) {
  return wrap(size, (
    <>
      <rect x="16" y="16" width="88" height="56" rx="8" fill={BODY} />
      <rect x="22" y="22" width="76" height="44" rx="5" fill="var(--accent)" opacity="0.35" />
      <circle cx="44" cy="40" r="7" fill="var(--warn)" opacity="0.9" />
      <circle cx="62" cy="46" r="5" fill="var(--ok)" opacity="0.9" />
      <path d="M76 50l10-10 8 8" stroke="var(--accent-hi)" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" />
      <rect x="52" y="72" width="16" height="8" rx="2" fill={BODY} />
      <rect x="38" y="80" width="44" height="5" rx="2.5" fill={BODY} />
    </>
  ))
}

export function SecurityArt({ size }: P) {
  return wrap(size, (
    <>
      <ellipse cx="60" cy="84" rx="34" ry="5" fill={MUTE} />
      <rect x="20" y="24" width="14" height="52" rx="4" fill={BODY} />
      <rect x="40" y="14" width="34" height="62" rx="5" fill="var(--warn)" opacity="0.55" />
      <rect x="46" y="42" width="6" height="6" rx="3" fill="var(--bg)" />
      <rect x="80" y="30" width="24" height="34" rx="6" fill={BODY} />
      <circle cx="92" cy="41" r="4" fill="var(--ok)" />
      <rect x="85" y="50" width="14" height="3" rx="1.5" fill={LINE} />
      <rect x="85" y="56" width="9" height="3" rx="1.5" fill={LINE} />
    </>
  ))
}

export function GiftArt({ size }: P) {
  return wrap(size, (
    <>
      <ellipse cx="60" cy="84" rx="32" ry="5" fill={MUTE} />
      <rect x="26" y="38" width="68" height="42" rx="6" fill={BODY} />
      <rect x="22" y="26" width="76" height="16" rx="5" fill="var(--surface-2)" />
      <rect x="54" y="26" width="12" height="54" fill="var(--accent)" opacity="0.75" />
      <path d="M60 26c-8 0-14-4-14-9s8-5 10 0 4 9 4 9zM60 26c8 0 14-4 14-9s-8-5-10 0-4 9-4 9z"
            fill="var(--accent-hi)" />
    </>
  ))
}

export function WalletArt({ size }: P) {
  return wrap(size, (
    <>
      <rect x="18" y="26" width="84" height="52" rx="10" fill={BODY} />
      <path d="M18 40h84v10H74a7 7 0 0 0 0 14h28v4a10 10 0 0 1-10 10H28a10 10 0 0 1-10-10z"
            fill="var(--surface-2)" opacity="0.55" />
      <rect x="30" y="16" width="52" height="16" rx="5" fill="var(--ok)" opacity="0.75" />
      <circle cx="80" cy="57" r="5" fill="var(--accent-hi)" />
    </>
  ))
}

export function CalendarArt({ size }: P) {
  return wrap(size, (
    <>
      <rect x="20" y="22" width="80" height="60" rx="9" fill={BODY} />
      <rect x="20" y="22" width="80" height="16" rx="9" fill="var(--stop)" opacity="0.75" />
      <rect x="36" y="14" width="7" height="16" rx="3.5" fill={BODY} />
      <rect x="77" y="14" width="7" height="16" rx="3.5" fill={BODY} />
      {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => (
        <rect key={`${r}-${c}`} x={31 + c * 16} y={46 + r * 12} width="10" height="7" rx="2"
              fill={r === 1 && c === 2 ? 'var(--accent-hi)' : LINE} />
      )))}
    </>
  ))
}

export function PhoneKeyArt({ size }: P) {
  return wrap(size, (
    <>
      <rect x="42" y="10" width="36" height="66" rx="9" fill={BODY} />
      <rect x="46" y="16" width="28" height="50" rx="5" fill="var(--accent)" opacity="0.3" />
      <path d="M54 40a6 6 0 1 1 12 0v4h2v10H52V44h2z" fill="var(--accent-hi)" />
      <path d="M84 30c5 5 5 15 0 20M92 24c9 9 9 27 0 36" stroke="var(--accent-hi)"
            strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </>
  ))
}

export function WifiArt({ size }: P) {
  return wrap(size, (
    <>
      <ellipse cx="60" cy="82" rx="30" ry="5" fill={MUTE} />
      <rect x="30" y="58" width="60" height="20" rx="7" fill={BODY} />
      <circle cx="42" cy="68" r="3.5" fill="var(--ok)" />
      <rect x="52" y="66" width="26" height="4" rx="2" fill={LINE} />
      <path d="M42 46c10-10 26-10 36 0" stroke="var(--accent)" strokeWidth="4"
            strokeLinecap="round" opacity="0.55" />
      <path d="M34 34c14-14 38-14 52 0" stroke="var(--accent)" strokeWidth="4"
            strokeLinecap="round" opacity="0.35" />
      <circle cx="60" cy="54" r="4" fill="var(--accent-hi)" />
    </>
  ))
}
