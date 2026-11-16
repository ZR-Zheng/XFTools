import { useContext, useLayoutEffect, useState, type RefObject } from 'react';
import { ToolHeaderActionsContext } from '../tools/page-context';

/** Keep a document canvas inside the visible viewport, including wrapped headers. */
export default function useViewportWorkspace(
  ref: RefObject<HTMLElement | null>
) {
  const headerActions = useContext(ToolHeaderActionsContext);
  const [height, setHeight] = useState(480);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      if (!ref.current) return;
      const viewport = window.visualViewport;
      const bottom = viewport
        ? viewport.height + viewport.offsetTop
        : window.innerHeight;
      const next = Math.max(
        240,
        Math.floor(
          bottom - Math.max(0, ref.current.getBoundingClientRect().top) - 16
        )
      );
      setHeight((previous) => (previous === next ? previous : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    schedule();
    const header = ref.current
      ?.closest('.tool-page')
      ?.querySelector('.tool-page-header');
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(schedule);
    if (header) observer?.observe(header);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [ref, headerActions]);
  return height;
}
