import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const minWidth = 164;

function maximumWidth(layout: HTMLElement) {
  const output = layout.querySelector<HTMLElement>('.pdf-output:not([hidden])');
  return Math.max(
    minWidth,
    Math.min(
      600,
      layout.clientWidth * 0.55,
      layout.clientWidth - (output?.offsetWidth ?? 0) - 250
    )
  );
}

export default function PdfSidebarResize({
  sidebar,
  hasPanel,
  onResize,
  t
}: {
  sidebar: RefObject<HTMLElement | null>;
  hasPanel: boolean;
  onResize: (width?: number) => void;
  t: (zh: string, en: string) => string;
}) {
  const handle = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; width: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: minWidth,
    max: minWidth
  });

  useLayoutEffect(() => {
    const panel = sidebar.current;
    const layout = handle.current?.parentElement;
    if (!panel || !layout) return;
    const update = () => {
      const width = panel.offsetWidth;
      const max = Math.round(maximumWidth(layout));
      setDimensions((current) =>
        current.width === width && current.max === max
          ? current
          : { width, max }
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    observer.observe(layout);
    return () => observer.disconnect();
  }, [sidebar, hasPanel]);

  return (
    <div
      ref={handle}
      className="pdf-sidebar-resize"
      role="separator"
      tabIndex={0}
      aria-controls="pdf-arrange-panel"
      aria-orientation="vertical"
      aria-label={t('调整页面栏宽度', 'Resize page sidebar')}
      aria-valuemin={minWidth}
      aria-valuemax={dimensions.max}
      aria-valuenow={dimensions.width}
      data-resizing={resizing || undefined}
      title={t(
        '左右拖动调整宽度，双击恢复默认',
        'Drag to resize. Double-click to reset.'
      )}
      onDoubleClick={() => onResize()}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current !== null) return;
        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          width: dimensions.width
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(true);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (!start || start.id !== event.pointerId) return;
        const width = start.width + event.clientX - start.x;
        onResize(
          Math.round(Math.max(minWidth, Math.min(dimensions.max, width)))
        );
      }}
      onLostPointerCapture={(event) => {
        if (pointer.current?.id !== event.pointerId) return;
        pointer.current = null;
        setResizing(false);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 72 : 24;
        const widths: Partial<Record<string, number>> = {
          ArrowLeft: Math.max(minWidth, dimensions.width - step),
          ArrowRight: Math.min(dimensions.max, dimensions.width + step),
          Home: minWidth,
          End: dimensions.max
        };
        const width = widths[event.key];
        if (width === undefined && event.key !== 'Enter') return;
        event.preventDefault();
        onResize(width);
      }}
    />
  );
}
