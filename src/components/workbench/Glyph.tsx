import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  add: 'M12 4v16 M4 12h16',
  copy: 'M8 8h13v13H8z M16 8V3H3v13h5',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
  palette:
    'M12 3a9 9 0 1 0 0 18c3 0 1-4 4-4h2c5 0 5-14-6-14Z M7 10h.01 M10 6h.01 M16 7h.01 M6 15h.01',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  chart: 'M3 3v17h18 M6 15l4-5 4 3 6-7',
  frame: 'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8z',
  clock: 'M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  date: 'M4 6h16v15H4z M4 10h16 M8 4v4 M16 4v4 M8 14h2 M14 14h2 M8 17h2',
  image: 'M4 3h16v18H4z M4 16l5-5 4 4 3-3 4 4 M9 7h.01',
  'image-export':
    'M3 17V4h15v9 M3 14l5-5 4 4 3-3 M8 7h.01 M10 18h11m-4-4 4 4-4 4',
  compress: 'M3 3l6 6m-6 0h6V3m12 18-6-6m6 0h-6v6',
  grip: 'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',
  file: 'M14 2H5v20h14V7z M14 2v6h5 M8 13h8 M8 17h6',
  text: 'M4 5h16 M12 5v15 M8 20h8',
  video: 'M3 5h13v14H3z M16 10l5-3v10l-5-3',
  play: 'm8 4 13 8-13 8z',
  pause: 'M9 5v14m6-14v14',
  scissors:
    'M4 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M4 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M9 8l12 12M9 16 21 4',
  audio:
    'M9 18V5l11-2v13 M9 8l11-2 M9 18a3 3 0 1 1-3-3h3 M20 16a3 3 0 1 1-3-3h3',
  code: 'm8 6-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
  list: 'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
  table: 'M3 3h18v18H3z M3 9h18 M9 3v18 M3 15h18',
  convert: 'M3 7h17l-4-4 M21 17H4l4 4 M20 7l-4 4 M4 17l4-4',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  external: 'M13 4h7v7 M20 4l-9 9 M9 4H4v16h16v-5',
  undo: 'M9 5 4 10l5 5 M4 10h10a5 5 0 0 1 5 5v3',
  redo: 'm15 5 5 5-5 5 M20 10H10a5 5 0 0 0-5 5v3',
  panel: 'M3 4h18v16H3z M9 4v16 M5.5 8h1 M5.5 12h1',
  minus: 'M5 12h14',
  message: 'M3 4h18v12H9l-6 4V4z M7 8h10 M7 12h7',
  form: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z M8 12l3 3 5-6',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  close: 'm6 6 12 12 M6 18 18 6',
  chevron: 'm9 5 7 7-7 7',
  'chevron-up': 'm5 15 7-7 7 7',
  'chevron-down': 'm5 9 7 7 7-7',
  check: 'm5 12 4 4L19 6',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  globe:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18'
};
export const categoryGlyph: Record<string, string> = {
  'image-generic': 'image',
  gif: 'image',
  pdf: 'file',
  string: 'text',
  video: 'video',
  audio: 'audio',
  time: 'clock',
  charts: 'chart',
  converters: 'convert'
};
export default function Glyph({
  name,
  size = 20,
  style,
  filled = false
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
