const PATHS = {
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM8 12.5l2.5 2.5L16 9.5',
  xCircle: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM15 9l-6 6M9 9l6 6',
  alert: 'M12 3 2 20h20L12 3ZM12 10v4M12 17.5v.01',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v5M12 7.5v.01',
  chevronDown: 'm6 9 6 6 6-6',
  close: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  printer: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  flat: 'M5 12h14',
  wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M3 21l11-11',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The engineering centre-of-gravity symbol: a circle with alternate quarters filled. */
export function CgSymbol({ size = 20, x = 0, y = 0 }: { size?: number; x?: number; y?: number }) {
  const r = size / 2;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r={r} fill="#fff" stroke="#111" stroke-width={size * 0.08} />
      <path d={`M0 0V${-r}A${r} ${r} 0 0 1 ${r} 0Z`} fill="#111" />
      <path d={`M0 0V${r}A${r} ${r} 0 0 1 ${-r} 0Z`} fill="#111" />
    </g>
  );
}
