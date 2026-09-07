import type { CSSProperties, ReactNode } from "react";

/**
 * Stroke icon set ported 1:1 from the mock (icons.jsx · ICON_PATHS).
 * Pure SVG — safe in both server and client components. <Icon name="search" size={16} />
 */
const ICON_PATHS: Record<string, ReactNode> = {
  files: <path d="M3 3.5h5l1.5 2H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />,
  search: <><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2 14 14" /></>,
  git: <><circle cx="4" cy="4" r="1.8" /><circle cx="4" cy="12" r="1.8" /><circle cx="12" cy="9.5" r="1.8" /><path d="M4 5.8v4.4M5.8 4H9a2 2 0 0 1 2 2v1.6" /></>,
  debug: <><circle cx="8" cy="8.5" r="3.5" /><path d="M8 5V3M4.5 8.5H2m12 0h-2.5M4.8 11.8 3.4 13M11.2 11.8l1.4 1.2M5.2 5 3.8 3.6M10.8 5l1.4-1.4" /></>,
  ext: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><path d="M9 11.2h4.5M11.2 9v4.5" /></>,
  settings: <><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" /></>,
  account: <><circle cx="8" cy="5.5" r="2.8" /><path d="M2.8 14c0-2.8 2.3-4.5 5.2-4.5s5.2 1.7 5.2 4.5" /></>,
  chevronRight: <path d="M6 4l4 4-4 4" />,
  chevronDown: <path d="M4 6l4 4 4-4" />,
  chevronUp: <path d="M4 10l4-4 4 4" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  add: <path d="M8 3v10M3 8h10" />,
  newFile: <><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" /><path d="M9 2v4h4M8 8v4M6 10h4" /></>,
  newFolder: <><path d="M2 5.5a1 1 0 0 1 1-1h3l1.2 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5z" /><path d="M8 8v3M6.5 9.5h3" /></>,
  refresh: <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5" />,
  collapse: <path d="M3 5h6M3 8h6M3 11h6M12 6l-1.5 1.5L12 9" />,
  more: <><circle cx="3.5" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12.5" cy="8" r="1" /></>,
  split: <><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M8 3v10" /></>,
  terminal: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M4.5 6.5 6.5 8l-2 1.5M8 10h3.5" /></>,
  panelBottom: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 10h12" /></>,
  sidebarIcon: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M6 3v10" /></>,
  bell: <><path d="M8 2a3.5 3.5 0 0 0-3.5 3.5c0 3-1.3 4-1.3 4h9.6s-1.3-1-1.3-4A3.5 3.5 0 0 0 8 2z" /><path d="M6.7 12a1.4 1.4 0 0 0 2.6 0" /></>,
  check: <path d="M3 8.5 6.5 12 13 4" />,
  error: <><circle cx="8" cy="8" r="6" /><path d="M8 5v4M8 11h.01" /></>,
  warn: <><path d="M8 2.5 14.5 13.5h-13z" /><path d="M8 7v3M8 12h.01" /></>,
  branch: <><circle cx="4" cy="4" r="1.6" /><circle cx="4" cy="12" r="1.6" /><circle cx="12" cy="9" r="1.6" /><path d="M4 5.6v4.8M5.6 4H9a1.8 1.8 0 0 1 1.8 1.8v1.6" /></>,
  sync: <path d="M3 6a5 5 0 0 1 8.5-2M13 10a5 5 0 0 1-8.5 2M11.5 2.5V4h-1.5M4.5 13.5V12h1.5" />,
  command: <path d="M5.5 3.5A1.5 1.5 0 1 1 4 5h8a1.5 1.5 0 1 1-1.5 1.5v3A1.5 1.5 0 1 1 12 11H4a1.5 1.5 0 1 1 1.5-1.5v-3z" />,
  goto: <><path d="M3 8h8M7.5 4.5 11 8l-3.5 3.5" /><path d="M13 3v10" /></>,
  sun: <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" /></>,
  moon: <path d="M13 9.2A5.5 5.5 0 0 1 6.8 3 5.5 5.5 0 1 0 13 9.2z" />,
  play: <path d="M5 3.5v9l7-4.5z" />,
  trash: <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.5 8.5h5l.5-8.5" />,
  dot: <circle cx="8" cy="8" r="3" />,
  fileTs: <><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" /><path d="M9 2v4h4" /></>,
  arrowUp: <path d="M8 13V3M4 7l4-4 4 4" />,
  arrowDown: <path d="M8 3v10M4 9l4 4 4-4" />,
  agents: <><circle cx="5.5" cy="6" r="2.2" /><circle cx="11" cy="6.5" r="1.8" /><path d="M2 13c0-2 1.6-3.2 3.5-3.2S9 11 9 13M9.5 12.5c.2-1.6 1.3-2.5 2.8-2.5 1.3 0 2.4.8 2.4 2.3" /></>,
  bot: <><rect x="3" y="5.5" width="10" height="7" rx="2" /><path d="M8 3v2.5M5.8 9h.01M10.2 9h.01M6 12h4" /><circle cx="8" cy="3" r="1" /></>,
  send: <path d="M14 2 7 9M14 2l-4.5 12-2.5-5L2 6.5z" />,
  at: <><circle cx="8" cy="8" r="3" /><path d="M11 8v1.2a1.8 1.8 0 0 0 3.5.6A6.5 6.5 0 1 0 11 13.2" /></>,
  chevronLeft: <path d="M10 4 6 8l4 4" />,
  dockRight: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M10 3v10" /><rect x="10.5" y="3.5" width="3" height="9" rx="1" fill="currentColor" stroke="none" opacity="0.25" /></>,
  dockLeft: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M6 3v10" /><rect x="2.5" y="3.5" width="3" height="9" rx="1" fill="currentColor" stroke="none" opacity="0.25" /></>,
  chat: <path d="M3 4.5h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H7l-3 2.5V11.5H3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z" />,
  grid: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></>,
  inbox: <><path d="M2 9h3l1 2h4l1-2h3" /><path d="M2.5 9 4 3.5h8L13.5 9v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" /></>,
  calendar: <><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>,
  repeat: <><path d="M3 6a4 4 0 0 1 7-2.5L12 5M13 10a4 4 0 0 1-7 2.5L4 11" /><path d="M12 2v3H9M4 14v-3h3" /></>,
  doc: <><path d="M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5L9 2z" /><path d="M9 2v3.5h3.5M6 8.5h4M6 11h4" /></>,
  skill: <path d="M8 2.5l1.4 3.1 3.4.4-2.5 2.3.7 3.3L8 9.9 5 11.6l.7-3.3L3.2 6l3.4-.4z" />,
  pulse: <path d="M2 8h3l1.5-4 2.5 8 1.5-4H14" />,
  coins: <><ellipse cx="6" cy="4.5" rx="3.5" ry="1.8" /><path d="M2.5 4.5v3c0 1 1.6 1.8 3.5 1.8s3.5-.8 3.5-1.8v-3" /><ellipse cx="10" cy="9.5" rx="3.5" ry="1.8" /><path d="M6.5 9.5c.4.9 1.8 1.5 3.5 1.5s3.5-.8 3.5-1.8v-1.2" /></>,
  cpu: <><rect x="4" y="4" width="8" height="8" rx="1.5" /><rect x="6.3" y="6.3" width="3.4" height="3.4" rx=".5" /><path d="M6 2v2M10 2v2M6 12v2M10 12v2M2 6h2M2 10h2M12 6h2M12 10h2" /></>,
  shield: <><path d="M8 2 3 4v4c0 3 2.2 5 5 6 2.8-1 5-3 5-6V4z" /><path d="M5.8 8 7.3 9.5 10.4 6.3" /></>,
  target: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.4" /></>,
  selectParent: <><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M8 11V6.5M5.5 9 8 6.5l2.5 2.5" /></>,
};

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 16, className = "", strokeWidth = 1.4, style }: {
  name: IconName | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  const filled = name === "play" || name === "dot";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
         stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {filled ? <g fill="currentColor" stroke="none">{path}</g> : path}
    </svg>
  );
}
