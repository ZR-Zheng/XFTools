import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import type { DraftEdit, Edit, ImageSource, Rect, Size } from './session';

const ImageCanvasSurface = lazy(() => import('./ImageCanvasSurface'));

const zoomLevels = [25, 50, 75, 100, 150, 200, 300, 400] as const;

export default function ImageCanvas({
  source,
  edits,
  draft,
  size,
  loading,
  onOpen,
  onCrop,
  onError
}: {
  source: ImageSource | null;
  edits: readonly Edit[];
  draft: DraftEdit | null;
  size: Size | null;
  loading: boolean;
  onOpen: () => void;
  onCrop: (rect: Rect) => void;
  onError: (message: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const pan = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [panning, setPanning] = useState(false);
  const crop = draft?.type === 'crop' ? draft : null;

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () =>
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = size
    ? Math.min(
        1,
        Math.max(1, viewport.width - 40) / size.width,
        Math.max(1, viewport.height - 40) / size.height
      )
    : 1;
  const scale = zoom === 'fit' ? fit : zoom / 100;
  const width = size ? Math.max(1, Math.round(size.width * scale)) : 0;
  const height = size ? Math.max(1, Math.round(size.height * scale)) : 0;
  const zoomIn = zoomLevels.find((value) => value > scale * 100 + 0.1);
  const zoomOut = zoomLevels.findLast((value) => value < scale * 100 - 0.1);

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    if (zoom === 'fit') {
      element.scrollLeft = element.scrollTop = 0;
    } else {
      element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    }
  }, [source, zoom]);

  return (
    <section className="iw-viewer" aria-label="图片预览">
      <div
        ref={stage}
        className={`iw-stage ${panning ? 'is-panning' : ''}`}
        data-can-pan={source && zoom !== 'fit' ? true : undefined}
        tabIndex={0}
        aria-label="图片画布"
        onPointerDown={(event) => {
          const element = event.currentTarget;
          if (
            !source ||
            zoom === 'fit' ||
            event.pointerType !== 'mouse' ||
            event.button !== 0 ||
            (crop && (event.target as Element).closest('.ReactCrop')) ||
            (element.scrollWidth <= element.clientWidth &&
              element.scrollHeight <= element.clientHeight)
          )
            return;
          pan.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: element.scrollLeft,
            top: element.scrollTop
          };
          element.setPointerCapture(event.pointerId);
          setPanning(true);
        }}
        onPointerMove={(event) => {
          const initial = pan.current;
          if (initial?.id !== event.pointerId) return;
          event.currentTarget.scrollLeft =
            initial.left + initial.x - event.clientX;
          event.currentTarget.scrollTop =
            initial.top + initial.y - event.clientY;
        }}
        onLostPointerCapture={() => {
          pan.current = null;
          setPanning(false);
        }}
      >
        {source && size ? (
          <div
            className="iw-stage-scene"
            style={{ minWidth: width + 40, minHeight: height + 40 }}
          >
            <Suspense
              fallback={
                <span className="iw-preview-loading" role="status">
                  正在加载画布…
                </span>
              }
            >
              <ImageCanvasSurface
                source={source}
                edits={edits}
                draft={draft}
                size={size}
                width={width}
                height={height}
                onCrop={onCrop}
                onError={onError}
              />
            </Suspense>
          </div>
        ) : (
          <div className="iw-empty">
            <span className="iw-empty-icon">
              <Glyph name="image" size={32} />
            </span>
            <strong>{loading ? '正在读取图片…' : '将图片拖到这里'}</strong>
            <button
              type="button"
              className="iw-primary"
              disabled={loading}
              onClick={onOpen}
            >
              <Glyph name="upload" size={16} /> 选择图片
            </button>
          </div>
        )}
      </div>
      <div className="iw-view-controls" aria-label="画布视图" role="group">
        <span className="iw-view-size">
          {size ? `${size.width} × ${size.height} px` : '画布'}
        </span>
        <div>
          <button
            type="button"
            className="iw-icon-button"
            aria-label="缩小"
            title="缩小"
            disabled={!source || zoomOut === undefined}
            onClick={() => zoomOut && setZoom(zoomOut)}
          >
            <Glyph name="minus" size={16} />
          </button>
          <select
            aria-label="画布缩放"
            value={zoom}
            disabled={!source}
            onChange={(event) =>
              setZoom(
                event.target.value === 'fit'
                  ? 'fit'
                  : Number(event.target.value)
              )
            }
          >
            <option value="fit">适应窗口</option>
            {zoomLevels.map((level) => (
              <option key={level} value={level}>
                {level}%
              </option>
            ))}
          </select>
          <button
            type="button"
            className="iw-icon-button"
            aria-label="放大"
            title="放大"
            disabled={!source || zoomIn === undefined}
            onClick={() => zoomIn && setZoom(zoomIn)}
          >
            <Glyph name="add" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
