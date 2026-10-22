import type { CSSProperties } from 'react';

const paths = {
  'arrow-right': 'M4 12h16m-6-6 6 6-6 6',
  'arrow-left': 'M20 12H4m6-6-6 6 6 6',
  'arrow-up-right': 'M6 18 18 6M6 6h12v12',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 5 7 7-7 7',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  car: 'm5 7 2-4h10l2 4M3 8h18v11h-3v-3H6v3H3V8Zm1 4h3m10 0h3M8 8V4m8 4V4',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  check: 'm5 12 4 4L19 6',
  'check-circle': 'm8 12 3 3 5-6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  calendar: 'M8 2v4m8-4v4M3 10h18M4 4h16v18H4V4Zm4 10h2m4 0h2m-8 4h2',
  gauge: 'M3 18a10 10 0 1 1 18 0M12 14l5-5M5 14H3m18 0h-2M12 4v2m-7 1 2 2m10-2-2 2M8 19h8',
  fuel: 'M3 21h11M5 21V3h8v18M5 7h8m0 4h2l2 3v4a2 2 0 0 0 4 0V8l-4-4m2 2v4h2',
  mail: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
  lock: 'M6 10V6a6 6 0 0 1 12 0v4M4 10h16v12H4V10Zm8 4v4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  'eye-off': 'm3 3 18 18M10 5a12 12 0 0 1 2 0c6 0 10 7 10 7a23 23 0 0 1-3 4M6 6a23 23 0 0 0-4 6s4 7 10 7a13 13 0 0 0 6-2M10 10a3 3 0 0 0 4 4',
  package: 'm3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7 4l10 6',
  alert: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v.1',
  refresh: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-4l2 3M4 17l2 3a8 8 0 0 0 13-4',
  logout: 'M9 4H3v16h6m7-4 4-4-4-4M8 12h12',
  road: 'm7 2-4 20M17 2l4 20M12 2v4m0 4v4m0 4v4',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  filter: 'M4 6h16M7 12h10m-7 6h4',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  info: 'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  sun: 'M12 2v2m0 16v2m10-10h-2M4 12H2m17.07 7.07-1.42-1.42M6.35 6.35 4.93 4.93m14.14 0-1.42 1.42M6.35 17.65l-1.42 1.42M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  moon: 'M20.8 14.4A9 9 0 0 1 9.6 3.2 9 9 0 1 0 20.8 14.4Z',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className={className} style={style}><path d={paths[name]} /></svg>;
}
