import { canonicalToolPath } from '@tools/tool-aliases';

export function getBookmarkedToolPaths(): string[] {
  try {
    return [
      ...new Set(
        (localStorage.getItem('bookmarkedTools') || '')
          .split(',')
          .filter(Boolean)
          .map(canonicalToolPath)
      )
    ];
  } catch {
    return [];
  }
}
export function isBookmarked(path: string) {
  return getBookmarkedToolPaths().includes(path);
}
export function toggleBookmarked(path: string) {
  const paths = getBookmarkedToolPaths();
  try {
    localStorage.setItem(
      'bookmarkedTools',
      (paths.includes(path)
        ? paths.filter((p) => p !== path)
        : [path, ...paths]
      ).join(',')
    );
  } catch {
    /* Storage may be disabled. */
  }
  window.dispatchEvent(new Event('xftools:bookmarks'));
}
