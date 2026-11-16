import { useEffect } from 'react';
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title && title !== 'XFTools' ? `${title} · XFTools` : 'XFTools';
  }, [title]);
}
