import { useEffect, useRef, useState } from 'react';
import { PDFWorker } from 'pdfjs-dist';
import type { RenderTask } from 'pdfjs-dist';
import type { PdfAsset } from './page-plan';
import { useWorkbenchText } from 'i18n/workbench';
import { openPdfDocument } from './document';

let sharedWorker: { worker: PDFWorker; references: number } | undefined;
function acquireWorker() {
  sharedWorker ??= { worker: new PDFWorker(), references: 0 };
  sharedWorker.references++;
  return sharedWorker;
}
function releaseWorker(owner: NonNullable<typeof sharedWorker>) {
  owner.references--;
  if (!owner.references) {
    owner.worker.destroy();
    if (sharedWorker === owner) sharedWorker = undefined;
  }
}
function preview(source: PdfAsset) {
  if (!source.preview) {
    let cancelled = false;
    let task: ReturnType<typeof openPdfDocument> | undefined;
    let workerOwner: NonNullable<typeof sharedWorker> | undefined;
    source.preview = source.file.arrayBuffer().then((data) => {
      if (cancelled) throw new Error('Preview cancelled.');
      workerOwner = acquireWorker();
      task = openPdfDocument({ data, worker: workerOwner.worker });
      return task.promise;
    });
    source.disposePreview = () => {
      if (cancelled) return;
      cancelled = true;
      void (task?.destroy() || Promise.resolve())
        .catch(() => {})
        .finally(() => {
          if (workerOwner) releaseWorker(workerOwner);
        });
      source.preview = undefined;
    };
  }
  return source.preview;
}
export default function PdfCanvas({
  source,
  pageIndex,
  rotation = 0,
  width = 140
}: {
  source: PdfAsset;
  pageIndex: number;
  rotation?: number;
  width?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const { english } = useWorkbenchText();
  useEffect(() => {
    const target = host.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!visible || !element) return;
    let active = true;
    let render: RenderTask | undefined;
    setReady(false);
    setError(false);
    void preview(source)
      .then(async (document) => {
        const page = await document.getPage(pageIndex + 1);
        if (!active || !canvas.current) return;
        const angle = (page.rotate + rotation) % 360;
        const base = page.getViewport({ scale: 1, rotation: angle });
        const viewport = page.getViewport({
          scale: width / base.width,
          rotation: angle
        });
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(4_194_304 / (viewport.width * viewport.height)),
          4096 / Math.max(viewport.width, viewport.height)
        );
        element.width = Math.max(1, Math.floor(viewport.width * ratio));
        element.height = Math.max(1, Math.floor(viewport.height * ratio));
        render = page.render({
          canvas: element,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]
        });
        await render.promise;
        if (active) setReady(true);
      })
      .catch((error) => {
        if (active && error?.name !== 'RenderingCancelledException')
          setError(true);
      });
    return () => {
      active = false;
      render?.cancel();
      element.width = element.height = 0;
    };
  }, [source, pageIndex, rotation, width, visible]);
  return (
    <div className="pdf-canvas" ref={host} aria-busy={!ready && !error}>
      <canvas
        ref={canvas}
        aria-label={`${source.name} · ${pageIndex + 1}`}
        role="img"
        hidden={!ready}
      />
      {!ready && (
        <span>
          {error ? (english ? 'Preview unavailable' : '无法预览') : 'PDF…'}
        </span>
      )}
    </div>
  );
}
