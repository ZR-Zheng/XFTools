import {
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { PdfAsset, PdfPageInstance } from '../shared/page-plan';
import Glyph from '@components/workbench/Glyph';

const PdfCanvas = lazy(() => import('../shared/PdfCanvas'));
const gutter = 16;
const focusLine = gutter + 1;
const zoomSteps = [50, 75, 100, 125, 150, 200, 300] as const;
type Zoom = 'width' | 'page' | (typeof zoomSteps)[number];

function pageAt(pages: { top: number }[], position: number) {
  let first = 0;
  let last = pages.length;
  while (first + 1 < last) {
    const middle = Math.floor((first + last) / 2);
    if (pages[middle].top <= position) first = middle;
    else last = middle;
  }
  return first;
}

export default function PdfReader({
  pages,
  sources,
  target,
  onPageChange,
  onOpen,
  busy,
  renderEdits,
  t
}: {
  pages: readonly PdfPageInstance[];
  sources: readonly PdfAsset[];
  target: { id: string } | null;
  onPageChange: (id: string | null) => void;
  onOpen: () => void;
  busy: boolean;
  renderEdits?: (page: PdfPageInstance, angle: number) => ReactNode;
  t: (zh: string, en: string) => string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef({ id: '', index: 0 });
  const previousTarget = useRef(target);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [zoom, setZoom] = useState<Zoom>('page');
  const [pageDraft, setPageDraft] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    const byId = new Map(sources.map((source) => [source.id, source]));
    let top = gutter;
    let maxWidth = 0;
    const sheets = pages.map((page) => {
      const source = page.sourceId ? byId.get(page.sourceId) : undefined;
      const dimensions = source?.sizes[page.pageIndex] ??
        page.blankSize ?? {
          width: 595.28,
          height: 841.89
        };
      const totalRotation =
        (source?.sizes[page.pageIndex]?.rotation ?? 0) + page.rotation;
      const angle = ((totalRotation % 360) + 360) % 360;
      const sideways = angle % 180 !== 0;
      const width = Math.max(
        1,
        sideways ? dimensions.height : dimensions.width
      );
      const height = Math.max(
        1,
        sideways ? dimensions.width : dimensions.height
      );
      const fitWidth = Math.max(1, size.width - gutter * 2) / width;
      const fitHeight = Math.max(1, size.height - gutter * 2) / height;
      const scale =
        zoom === 'width'
          ? fitWidth
          : zoom === 'page'
            ? Math.min(fitWidth, fitHeight)
            : (zoom / 100) * (96 / 72);
      const sheet = {
        page,
        source,
        angle,
        top,
        width: width * scale,
        height: height * scale,
        percent: scale * 75
      };
      top += sheet.height + gutter;
      maxWidth = Math.max(maxWidth, sheet.width);
      return sheet;
    });
    return {
      sheets,
      width: maxWidth + gutter * 2,
      height: Math.max(
        top,
        (sheets.at(-1)?.top ?? gutter) - gutter + size.height
      )
    };
  }, [pages, sources, size, zoom]);

  const { sheets } = layout;
  const active = pageAt(sheets, scrollTop + focusLine);
  const first = pageAt(sheets, Math.max(0, scrollTop - 160));
  const last = pageAt(sheets, scrollTop + size.height + 160);
  const updateScroll = useCallback(
    (top: number) => {
      const index = pageAt(sheets, top + focusLine);
      const id = sheets[index]?.page.id ?? '';
      anchor.current = { id, index };
      setScrollTop(top);
      onPageChange(id || null);
    },
    [sheets, onPageChange]
  );
  const jump = (index: number) => {
    const element = viewport.current;
    const sheet = sheets[index];
    if (!element || !sheet) return;
    element.scrollTop = sheet.top - gutter;
    updateScroll(element.scrollTop);
  };

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const requested =
      target !== previousTarget.current ? target?.id : undefined;
    previousTarget.current = target;
    const index = sheets.findIndex(
      ({ page }) => page.id === (requested ?? anchor.current.id)
    );
    const next =
      sheets[
        index < 0 ? Math.min(anchor.current.index, sheets.length - 1) : index
      ];
    element.scrollTop = next ? next.top - gutter : 0;
    updateScroll(element.scrollTop);
  }, [sheets, target, updateScroll]);

  const applyPageDraft = () => {
    const number = Number(pageDraft);
    if (
      pageDraft &&
      Number.isInteger(number) &&
      number >= 1 &&
      number <= sheets.length
    )
      jump(number - 1);
    setPageDraft(null);
  };
  const available = sheets.length > 0;
  const previous = t('上一页', 'Previous page');
  const next = t('下一页', 'Next page');
  const percent = sheets[active]?.percent ?? 100;
  const zoomIn = zoomSteps.find((step) => step > percent + 0.1);
  const zoomOut = zoomSteps.findLast((step) => step < percent - 0.1);

  return (
    <section className="pdf-reader" aria-label={t('PDF 预览', 'PDF preview')}>
      <div className="pdf-reader-toolbar" hidden={!available}>
        <div className="pdf-reader-navigation">
          <button
            type="button"
            aria-label={previous}
            title={previous}
            disabled={!available || active === 0}
            onClick={() => jump(active - 1)}
          >
            <Glyph name="chevron" size={16} style={{ rotate: '180deg' }} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            aria-label={t('跳转到页码', 'Go to page')}
            disabled={!available}
            value={pageDraft ?? (available ? active + 1 : '')}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setPageDraft(event.target.value)}
            onBlur={applyPageDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setPageDraft(null);
            }}
          />
          <span>/ {sheets.length}</span>
          <button
            type="button"
            aria-label={next}
            title={next}
            disabled={!available || active + 1 >= sheets.length}
            onClick={() => jump(active + 1)}
          >
            <Glyph name="chevron" size={16} />
          </button>
        </div>
        <div className="pdf-reader-zoom">
          <button
            type="button"
            aria-label={t('缩小', 'Zoom out')}
            title={t('缩小', 'Zoom out')}
            disabled={!available || !zoomOut}
            onClick={() => zoomOut && setZoom(zoomOut)}
          >
            <Glyph name="minus" size={16} />
          </button>
          <select
            aria-label={t('缩放', 'Zoom')}
            disabled={!available}
            value={zoom}
            onChange={(event) => {
              const value = event.target.value;
              setZoom(
                value === 'width' || value === 'page'
                  ? value
                  : (Number(value) as Zoom)
              );
            }}
          >
            <option value="width">{t('适应宽度', 'Fit width')}</option>
            <option value="page">{t('适合整页', 'Fit page')}</option>
            {zoomSteps.map((step) => (
              <option key={step} value={step}>
                {step}%
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={t('放大', 'Zoom in')}
            title={t('放大', 'Zoom in')}
            disabled={!available || !zoomIn}
            onClick={() => zoomIn && setZoom(zoomIn)}
          >
            <Glyph name="add" size={16} />
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        className="pdf-reader-viewport"
        tabIndex={0}
        aria-label={t('PDF 页面预览区', 'PDF page viewport')}
        onScroll={(event) => updateScroll(event.currentTarget.scrollTop)}
      >
        {!available && (
          <div className="pdf-reader-empty">
            <div className="pdf-drop-card">
              <span className="pdf-drop-icon">
                <Glyph name="file" size={30} />
              </span>
              <strong>{t('将 PDF 拖到这里', 'Drop PDFs here')}</strong>
              <p>
                {t(
                  '可以一次打开多个 PDF 文件。',
                  'Open one or more PDF files.'
                )}
              </p>
              <button
                type="button"
                className="pdf-primary"
                disabled={busy}
                onClick={onOpen}
              >
                <Glyph name="upload" size={16} />
                {t('选择文件', 'Choose files')}
              </button>
            </div>
          </div>
        )}
        {available && size.width > 0 && (
          <div
            className="pdf-reader-sheets"
            style={{ width: layout.width, height: layout.height }}
          >
            {sheets
              .slice(first, last + 1)
              .map(({ page, source, angle, top, width, height }, index) => (
                <div
                  className="pdf-reader-sheet"
                  key={page.id}
                  data-page-id={page.id}
                  aria-label={`${t('输出页', 'Output page')} ${first + index + 1}`}
                  style={{ top, width, height }}
                >
                  {source && (
                    <Suspense fallback={<span>PDF…</span>}>
                      <PdfCanvas
                        source={source}
                        pageIndex={page.pageIndex}
                        rotation={page.rotation}
                        width={width}
                      />
                    </Suspense>
                  )}
                  {renderEdits?.(page, angle)}
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
