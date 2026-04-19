// Minimal stroke icon set (1.5px, Lucide-style)
import type { SVGProps } from 'react';

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

function Icon({ d, size = 16, stroke = 'currentColor', strokeWidth = 1.5, fill = 'none', children, ...rest }: IconProps & { d?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export function IconSparkle({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></Icon>;
}
export function IconGrid({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>;
}
export function IconCanvas({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 6H15.5M7.8 7.8l8.4 8.4"/></Icon>;
}
export function IconBrand({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M12 2l2.39 6.95H21l-5.3 4.29L17.78 20 12 15.77 6.22 20l2.08-6.76L3 8.95h6.61z"/></Icon>;
}
export function IconSettings({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></Icon>;
}
export function IconPlus({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M12 5v14M5 12h14"/></Icon>;
}
export function IconSearch({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>;
}
export function IconPlay({ size = 16, ...p }: IconProps) {
  return <Icon size={size} fill="currentColor" stroke="none" {...p}><path d="M8 5v14l11-7z"/></Icon>;
}
export function IconPause({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></Icon>;
}
export function IconImage({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></Icon>;
}
export function IconVideo({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/></Icon>;
}
export function IconText({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M4 7V5h16v2M9 5v14M15 19H9"/></Icon>;
}
export function IconLayers({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M12 2l10 6-10 6L2 8z"/><path d="M2 16l10 6 10-6M2 12l10 6 10-6"/></Icon>;
}
export function IconWand({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></Icon>;
}
export function IconDownload({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></Icon>;
}
export function IconCopy({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></Icon>;
}
export function IconHeart({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></Icon>;
}
export function IconCheck({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M20 6L9 17l-5-5"/></Icon>;
}
export function IconArrowRight({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>;
}
export function IconClose({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M18 6L6 18M6 6l12 12"/></Icon>;
}
export function IconCommand({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z"/></Icon>;
}
export function IconMore({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/></Icon>;
}
export function IconZap({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9z"/></Icon>;
}
export function IconTarget({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Icon>;
}
export function IconUsers({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></Icon>;
}
export function IconUpload({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></Icon>;
}
export function IconChevronDown({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M6 9l6 6 6-6"/></Icon>;
}
export function IconChevronRight({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M9 18l6-6-6-6"/></Icon>;
}
export function IconDot({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><circle cx="12" cy="12" r="3" fill="currentColor"/></Icon>;
}
export function IconRefresh({ size = 16, ...p }: IconProps) {
  return <Icon size={size} {...p}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></Icon>;
}

export const IconHeart2 = IconHeart;
