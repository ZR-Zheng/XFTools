import { useEffect, useRef, useState } from 'react';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  hasEdit,
  type DraftEdit,
  type Edit,
  type ImageSource,
  type Rect,
  type Size
} from './session';
import {
  paintPreview,
  releaseFrame,
  renderEdits,
  sourceFrame,
  type Frame
} from './render-image';

export default function ImageCanvasSurface({
  source,
  edits,
  draft,
  size,
  width,
  height,
  onCrop,
  onError
}: {
  source: ImageSource;
  edits: readonly Edit[];
  draft: DraftEdit | null;
  size: Size;
  width: number;
  height: number;
  onCrop: (rect: Rect) => void;
  onError: (message: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cached = useRef<{
    source: ImageSource;
    edits: readonly Edit[];
    frame: Frame;
  } | null>(null);
  const [cropStart, setCropStart] = useState<PercentCrop>();
  const crop = draft?.type === 'crop' ? draft : null;
  const liveEdit = crop ? null : draft;

  useEffect(
    () => () => {
      if (cached.current) releaseFrame(cached.current.frame);
      cached.current = null;
    },
    []
  );

  useEffect(() => {
    if (!source || !canvas.current) return;
    const request = requestAnimationFrame(() => {
      let temporary: Frame | null = null;
      try {
        if (
          cached.current?.source !== source ||
          cached.current.edits !== edits
        ) {
          const frame = renderEdits(sourceFrame(source), edits, true);
          if (cached.current) releaseFrame(cached.current.frame);
          cached.current = { source, edits, frame };
        }
        const base = cached.current.frame;
        if (liveEdit) temporary = renderEdits(base, [liveEdit], true);
        if (canvas.current) paintPreview(canvas.current, temporary ?? base);
      } catch {
        onError('无法预览当前图片。');
      } finally {
        if (temporary) releaseFrame(temporary);
      }
    });
    return () => cancelAnimationFrame(request);
  }, [source, edits, liveEdit, onError]);

  const cropPercent: PercentCrop | undefined =
    crop && size && hasEdit(crop, size)
      ? {
          unit: '%',
          x: (crop.rect.x / size.width) * 100,
          y: (crop.rect.y / size.height) * 100,
          width: (crop.rect.width / size.width) * 100,
          height: (crop.rect.height / size.height) * 100
        }
      : undefined;

  return (
    <ReactCrop
      className="iw-image-surface"
      style={{ width, height }}
      disabled={!crop}
      crop={crop ? (cropStart ?? cropPercent) : undefined}
      circularCrop={crop?.circle}
      aspect={crop?.circle ? 1 : undefined}
      ruleOfThirds
      onDragEnd={() => setCropStart(undefined)}
      onChange={(_, selection) => {
        if (!crop) return;
        if (!selection.width || !selection.height) {
          setCropStart(selection);
          return;
        }
        setCropStart(undefined);
        const x = Math.max(
          0,
          Math.min(size.width - 1, Math.round((selection.x / 100) * size.width))
        );
        const y = Math.max(
          0,
          Math.min(
            size.height - 1,
            Math.round((selection.y / 100) * size.height)
          )
        );
        const cropWidth = Math.max(
          1,
          Math.min(
            size.width - x,
            Math.round((selection.width / 100) * size.width)
          )
        );
        const cropHeight = Math.max(
          1,
          Math.min(
            size.height - y,
            Math.round((selection.height / 100) * size.height)
          )
        );
        const side = Math.min(cropWidth, cropHeight);
        onCrop({
          x,
          y,
          width: crop.circle ? side : cropWidth,
          height: crop.circle ? side : cropHeight
        });
      }}
    >
      <canvas ref={canvas} aria-label="当前图片" role="img" />
    </ReactCrop>
  );
}
