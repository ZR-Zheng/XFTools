import { useEffect, useState } from 'react';
import { getBookmarkedToolPaths } from '@utils/bookmark';
const event = 'xftools:history';
export function getRecentTools(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem('recentTools') || '[]'
    );
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 24)
      : [];
  } catch {
    return [];
  }
}
export function recordTool(path: string) {
  try {
    localStorage.setItem(
      'recentTools',
      JSON.stringify(
        [path, ...getRecentTools().filter((p) => p !== path)].slice(0, 24)
      )
    );
  } catch {
    /* Storage may be disabled. */
  }
  window.dispatchEvent(new Event(event));
}
export function useToolHistory() {
  const [state, setState] = useState(() => ({
    favorites: getBookmarkedToolPaths(),
    recent: getRecentTools()
  }));
  useEffect(() => {
    const update = () =>
      setState({
        favorites: getBookmarkedToolPaths(),
        recent: getRecentTools()
      });
    window.addEventListener(event, update);
    window.addEventListener('xftools:bookmarks', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(event, update);
      window.removeEventListener('xftools:bookmarks', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return state;
}
