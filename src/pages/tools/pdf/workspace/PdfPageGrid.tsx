import { useEffect, useRef, useState, type ReactNode } from 'react';
import Glyph from '@components/workbench/Glyph';
import type { PdfAsset, PdfPageInstance } from '../shared/page-plan';
import type { PageMenuAnchor } from './PdfPageMenu';

type DropTarget = {
  id: string;
  side: 'before' | 'after';
  axis: 'horizontal' | 'vertical';
};
type PageDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  ids: ReadonlySet<string>;
  active: boolean;
};

function findTarget(
  grid: HTMLDivElement | null,
  drag: PageDrag
): DropTarget | null {
  if (!grid) return null;
  const { x, y } = drag;
  const hit = document.elementFromPoint(x, y);
  const candidates =
    hit === grid
      ? [
          [x + 5, y],
          [x - 5, y],
          [x, y + 5],
          [x, y - 5]
        ].map(([left, top]) => document.elementFromPoint(left, top))
      : [hit];
  const card = candidates
    .map((element) => element?.closest<HTMLElement>('.pdf-page'))
    .find(
      (element) =>
        element?.parentElement === grid &&
        !drag.ids.has(element.dataset.pageId ?? '')
    );
  const id = card?.dataset.pageId;
  if (!card || !id) return null;
  const rect = card.getBoundingClientRect();
  const across = card.offsetWidth < grid.clientWidth - 2;
  const before = across
    ? drag.x < rect.left + rect.width / 2
    : drag.y < rect.top + rect.height / 2;
  return {
    id,
    side: before ? 'before' : 'after',
    axis: across ? 'horizontal' : 'vertical'
  };
}

export default function PdfPageGrid({
  pages,
  sources,
  offset,
  selected,
  currentPage,
  busy,
  thumbnail,
  onSelect,
  onPreview,
  onMove,
  onOpenMenu,
  t
}: {
  pages: readonly PdfPageInstance[];
  sources: readonly PdfAsset[];
  offset: number;
  selected: ReadonlySet<string>;
  currentPage: string | null;
  busy: boolean;
  thumbnail: (source: PdfAsset, index: number, rotation: number) => ReactNode;
  onSelect: (id: string, range: boolean) => void;
  onPreview: (id: string) => void;
  onMove: (
    ids: ReadonlySet<string>,
    id: string,
    side: DropTarget['side']
  ) => void;
  onOpenMenu: (anchor: PageMenuAnchor) => void;
  t: (zh: string, en: string) => string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<PageDrag | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState<ReadonlySet<string> | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const updateTarget = (current: PageDrag) => {
    const next = findTarget(grid.current, current);
    setTarget((previous) =>
      previous?.id === next?.id &&
      previous?.side === next?.side &&
      previous?.axis === next?.axis
        ? previous
        : next
    );
  };
  const stopDrag = () => {
    drag.current = null;
    cancelAnimationFrame(frame.current);
    setDragging(null);
    setTarget(null);
  };
  const scrollDuringDrag = () => {
    const current = drag.current;
    const sidebar = grid.current?.closest<HTMLElement>('.pdf-editor');
    if (!current?.active || !sidebar) return;
    const bounds = sidebar.getBoundingClientRect();
    if (
      current.x >= bounds.left &&
      current.x <= bounds.right &&
      current.y >= bounds.top &&
      current.y <= bounds.bottom
    ) {
      const topEdge = bounds.top + 48;
      const bottomEdge = bounds.bottom - 48;
      const delta = current.y < topEdge ? -12 : current.y > bottomEdge ? 12 : 0;
      const before = sidebar.scrollTop;
      sidebar.scrollTop += delta;
      if (sidebar.scrollTop !== before) updateTarget(current);
    }
    frame.current = requestAnimationFrame(scrollDuringDrag);
  };

  return (
    <div
      className="pdf-page-grid"
      ref={grid}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        if (!current.active) {
          if (
            Math.hypot(current.x - current.startX, current.y - current.startY) <
            6
          )
            return;
          current.active = true;
          suppressClick.current = true;
          setDragging(current.ids);
          frame.current = requestAnimationFrame(scrollDuringDrag);
        }
        updateTarget(current);
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        const destination = current.active && findTarget(grid.current, current);
        stopDrag();
        if (destination) onMove(current.ids, destination.id, destination.side);
      }}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId === event.pointerId) stopDrag();
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        if (!event.detail) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {pages.map((page, index) => {
        const source = sources.find((item) => item.id === page.sourceId);
        const number = offset + index + 1;
        const checked = selected.has(page.id);
        const showSource = source && sources.length > 1;
        const showSourcePage =
          source && (showSource || number !== page.pageIndex + 1);
        const openByButton = (trigger: HTMLElement) => {
          const bounds = trigger.getBoundingClientRect();
          onOpenMenu({
            id: page.id,
            x: bounds.left,
            y: bounds.bottom,
            trigger
          });
        };
        return (
          <article
            key={page.id}
            data-page-id={page.id}
            data-moving={dragging?.has(page.id) || undefined}
            data-drop-side={target?.id === page.id ? target.side : undefined}
            data-drop-axis={target?.id === page.id ? target.axis : undefined}
            className={`pdf-page ${checked ? 'is-selected' : ''}`}
            onPointerDown={(event) => {
              suppressClick.current = false;
              if (busy || event.button !== 0 || drag.current) return;
              const element = event.target as Element;
              const grip = element.closest('.pdf-page-grip');
              if (
                element.closest('label') ||
                (event.pointerType !== 'mouse' && !grip)
              )
                return;
              const capture = element.closest('button') ?? event.currentTarget;
              capture.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                x: event.clientX,
                y: event.clientY,
                ids: checked ? selected : new Set([page.id]),
                active: false
              };
            }}
            onContextMenu={(event) => {
              if (busy) return;
              event.preventDefault();
              if (drag.current?.active) return;
              const trigger =
                event.currentTarget.querySelector<HTMLButtonElement>(
                  '.pdf-page-thumb'
                );
              if (trigger) {
                onOpenMenu({
                  id: page.id,
                  x: event.clientX,
                  y: event.clientY,
                  trigger
                });
              }
            }}
          >
            <div className="pdf-page-header">
              <label className="pdf-page-select">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onSelect(
                      page.id,
                      (event.nativeEvent as MouseEvent).shiftKey
                    )
                  }
                  aria-label={t(
                    `选择第 ${number} 页`,
                    `Select output page ${number}`
                  )}
                />
                <span>{number}</span>
              </label>
              <button
                type="button"
                className="pdf-page-grip"
                aria-label={t(`第 ${number} 页操作`, `Page ${number} actions`)}
                aria-haspopup="menu"
                title={t(
                  '拖动排序，点击查看操作',
                  'Drag to reorder. Click for actions.'
                )}
                onClick={(event) => openByButton(event.currentTarget)}
              >
                <Glyph name="grip" size={16} />
              </button>
            </div>
            <button
              type="button"
              className="pdf-page-thumb"
              aria-current={currentPage === page.id ? 'page' : undefined}
              aria-label={t(
                `预览输出第 ${number} 页`,
                `Preview output page ${number}`
              )}
              onClick={() => onPreview(page.id)}
              onKeyDown={(event) => {
                if (
                  event.key !== 'ContextMenu' &&
                  !(event.shiftKey && event.key === 'F10')
                )
                  return;
                event.preventDefault();
                openByButton(event.currentTarget);
              }}
            >
              {source ? (
                thumbnail(source, page.pageIndex, page.rotation)
              ) : (
                <span className="pdf-blank">
                  A4
                  <br />
                  {t('空白页', 'Blank page')}
                  {page.rotation ? ` · ${page.rotation}°` : ''}
                </span>
              )}
            </button>
            {source && (showSourcePage || !!page.rotation) && (
              <div className="pdf-page-caption">
                {showSource && (
                  <strong title={source.name}>{source.name}</strong>
                )}
                <span>
                  {showSourcePage &&
                    t(
                      `原第 ${page.pageIndex + 1} 页`,
                      `Source page ${page.pageIndex + 1}`
                    )}
                  {page.rotation
                    ? `${showSourcePage ? ' · ' : ''}+${page.rotation}°`
                    : ''}
                </span>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
