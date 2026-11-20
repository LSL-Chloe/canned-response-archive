import type { ReactNode } from 'react';

export type IconName =
  | 'search' | 'library' | 'team' | 'panel' | 'sun' | 'moon' | 'chevron'
  | 'settings' | 'logout' | 'plus' | 'download' | 'upload' | 'copy'
  | 'arrow' | 'check' | 'shield' | 'mail' | 'key' | 'sparkle' | 'close'
  | 'refresh' | 'lock' | 'command' | 'edit' | 'trash';

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  let paths: ReactNode;
  switch (name) {
    case 'search': paths=<><circle cx="11" cy="11" r="7"/><path d="m16 16 4.5 4.5"/></>; break;
    case 'library': paths=<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>; break;
    case 'team': paths=<><path d="M16 20v-1.6c0-2-2-3.4-5-3.4s-5 1.4-5 3.4V20"/><circle cx="11" cy="7" r="3"/><path d="M19 20v-1.5c0-1.3-.7-2.4-2-3.1M17 4a3 3 0 0 1 0 6"/></>; break;
    case 'panel': paths=<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></>; break;
    case 'sun': paths=<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>; break;
    case 'moon': paths=<path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5 8.5 8.5 0 1 0 20.5 13.2Z"/>; break;
    case 'chevron': paths=<path d="m6 9 6 6 6-6"/>; break;
    case 'settings': paths=<><circle cx="12" cy="12" r="3"/><path d="m9.8 2.9.5-1h3.4l.5 1 1.2 1.2 1.2.1 2.4 2.4-.1 1.3 1.3 1.3h1.1l.9 3.3-.9.6-1.3 1.3.1 1.3-2.4 2.4-1.2.1-1.2 1.2-.5 1h-3.4l-.5-1-1.2-1.2-1.2-.1-2.4-2.4.1-1.3-1.3-1.3H3.8L3 11l.9-.6 1.3-1.3-.1-1.3 2.4-2.4 1.2-.1z" transform="translate(0 .5) scale(.95)"/></>; break;
    case 'logout': paths=<><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m14 16 4-4-4-4M8 12h10"/></>; break;
    case 'plus': paths=<path d="M12 5v14M5 12h14"/>; break;
    case 'download': paths=<><path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/></>; break;
    case 'upload': paths=<><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/></>; break;
    case 'copy': paths=<><rect x="7" y="7" width="13" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></>; break;
    case 'arrow': paths=<><path d="M5 12h14m-6-6 6 6-6 6"/></>; break;
    case 'check': paths=<path d="m4.5 12.5 5 5 10-11"/>; break;
    case 'shield': paths=<><path d="m12 2 8 4v5c0 5-3 8.5-8 11-5-2.5-8-6-8-11V6z"/><path d="m9 12 2 2 4-4"/></>; break;
    case 'mail': paths=<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>; break;
    case 'key': paths=<><circle cx="8" cy="15" r="4"/><path d="m11.1 12 8.5-8.5 2 2-2 2 1.3 1.3-2 2-1.3-1.3-2 2"/></>; break;
    case 'sparkle': paths=<><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></>; break;
    case 'close': paths=<path d="M5 5 19 19M19 5 5 19"/>; break;
    case 'refresh': paths=<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7.5 7.5 0 0 1 19 8M5 16a7.5 7.5 0 0 0 13.4-1"/></>; break;
    case 'lock': paths=<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>; break;
    case 'command': paths=<><rect x="4" y="4" width="6" height="6" rx="3"/><rect x="14" y="4" width="6" height="6" rx="3"/><rect x="4" y="14" width="6" height="6" rx="3"/><rect x="14" y="14" width="6" height="6" rx="3"/><path d="M10 7h4M7 10v4M17 10v4M10 17h4"/></>; break;
    case 'edit': paths=<><path d="m4 16 11.5-11.5 4 4L8 20H4zM13.5 6.5l4 4"/></>; break;
    case 'trash': paths=<><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></>; break;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}
