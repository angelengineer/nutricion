import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
});
const mk = (d: React.ReactNode) => ({ size, ...p }: P) => <svg {...base(size)} {...p}>{d}</svg>;

export const IconPlus = mk(<path d="M12 5v14M5 12h14" />);
export const IconToday = mk(<><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 8 8h-8z" fill="currentColor" stroke="none" opacity=".9" /></>);
export const IconChart = mk(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const IconBook = mk(<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M19 19v2H6" /></>);
export const IconSettings = mk(<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>);
export const IconLeft = mk(<path d="m15 18-6-6 6-6" />);
export const IconRight = mk(<path d="m9 18 6-6-6-6" />);
export const IconClose = mk(<path d="M18 6 6 18M6 6l12 12" />);
export const IconBack = mk(<path d="M19 12H5m6-6-6 6 6 6" />);
export const IconCamera = mk(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IconBarcode = mk(<path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" strokeWidth={1.4} />);
export const IconEdit = mk(<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />);
export const IconSearch = mk(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p.size)} {...p}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill={filled ? 'currentColor' : 'none'} /></svg>
);
export const IconTrash = mk(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />);
export const IconCopy = mk(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>);
export const IconSync = mk(<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" />);
export const IconImage = mk(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>);
export const IconSparkle = mk(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />);
