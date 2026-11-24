import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Glyph from '@components/workbench/Glyph';
import type { ToolComponentProps } from '@tools/defineTool';
import { downloadFile } from '@utils/file';
import useFileDrop from 'hooks/useFileDrop';
import ImageCanvas from './ImageCanvas';
import ImageControls from './ImageControls';
import type { ImageComparison } from './ImageBackgroundPanel';
import type { ImageSnapshot } from './snapshot';
import type { ExportOptions } from './render-image';
import {
  canExportSvg,
  editSize,
  type Edit,
  hasEdit,
  imageSession,
  initialSession,
  type ImageTool,
  outputSize,
  validEdit
} from './session';
import '@components/workbench/workspace-theme.css';
import './image-workspace.css';

const ImageExportDialog = lazy(() => import('./ImageExportDialog'));
const ImageBackgroundPanel = lazy(() => import('./ImageBackgroundPanel'));
const ImageBatchPanel = lazy(() => import('./ImageBatchPanel'));
const ImagePrintPanel = lazy(() => import('./ImagePrintPanel'));
const tabs = [
  { id: 'edit', label: '图片编辑' },
  { id: 'background', label: '去背景' },
  { id: 'batch', label: '批量处理' },
  { id: 'print', label: '分页打印' }
] as const;
type Tab = (typeof tabs)[number]['id'];
const noEdits: readonly Edit[] = [];
const editTools: readonly ImageTool[] = [
  'crop',
  'rotate',
  'resize',
  'color',
  'mask',
  'opacity',
  'watermark'
];

const accepted = [
  'image/*',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.avif',
  '.gif',
  '.svg',
  '.heic',
  '.heif'
];

export default function ImageWorkspace({ title }: ToolComponentProps) {
  const [params, setParams] = useSearchParams();
  const tab = tabs.find(({ id }) => id === params.get('tab'))?.id ?? 'edit';
  const requestedTool = editTools.find((id) => id === params.get('tool'));
  const maskMode = params.get('mask') === 'replace' ? 'replace' : 'transparent';
  const [{ source, edits, undone, tool, draft }, dispatch] = useReducer(
    imageSession,
    { ...initialSession, tool: requestedTool ?? 'crop', maskMode }
  );
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [batchVisited, setBatchVisited] = useState(tab === 'batch');
  const [comparison, setComparison] = useState<ImageComparison | null>(null);
  const busy = loading || exporting;
  const size = useMemo(
    () => source && outputSize(source, edits),
    [source, edits]
  );
  const dirty = hasEdit(draft, size);
  const invalid = !!(draft && size && dirty && !validEdit(draft, size));
  const currentEdit = dirty && !invalid ? draft : null;
  const finalSize = useMemo(
    () => (size && currentEdit ? editSize(size, currentEdit) : size),
    [size, currentEdit]
  );
  const snapshot = useMemo<ImageSnapshot | null>(
    () =>
      source && finalSize && !invalid && !loading
        ? {
            source,
            edits: currentEdit ? [...edits, currentEdit] : edits,
            size: finalSize
          }
        : null,
    [source, finalSize, invalid, loading, currentEdit, edits]
  );
  const comparing = tab === 'background' && comparison?.snapshot === snapshot;
  const cropActive = tab === 'edit' && tool === 'crop';
  const canvasSize = cropActive ? size : finalSize;
  const canUndo = !busy && (dirty || edits.length > 0);
  const canRedo = !busy && !dirty && undone.length > 0;

  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );
  useEffect(() => {
    if (requestedTool)
      dispatch({ type: 'tool', tool: requestedTool, maskMode });
  }, [requestedTool, maskMode]);

  const setTab = (next: Tab) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set('tab', next);
        return updated;
      },
      { replace: true }
    );
  };

  const { isDragging, addFiles, dropHandlers } = useFileDrop({
    accept: accepted,
    onFiles: async ([file]) => {
      if (!file || exportOpen) return;
      const id = ++generation.current;
      setComparison(null);
      setLoading(true);
      setError('');
      void import('./ImageCanvasSurface').catch(() => {});
      try {
        const { decodeImage } = await import('./render-image');
        const decoded = await decodeImage(file);
        if (generation.current === id)
          dispatch({ type: 'load', source: decoded });
      } catch (failure) {
        if (generation.current === id)
          setError(
            failure instanceof Error ? failure.message : '读取图片失败。'
          );
      } finally {
        if (generation.current === id) setLoading(false);
      }
    }
  });

  const openFiles = () => input.current?.click();
  const chooseTab = (next: Tab) => {
    if (next === tab) return;
    dispatch({ type: 'apply' });
    setComparison(null);
    setTab(next);
    if (next === 'batch') setBatchVisited(true);
  };
  const save = async (options: ExportOptions) => {
    if (!source || busy || invalid) return;
    const id = generation.current;
    const recipe = currentEdit ? [...edits, currentEdit] : edits;
    setExporting(true);
    setExportError('');
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (generation.current !== id) return;
      const { exportImage } = await import('./render-image');
      const file = await exportImage(source, recipe, options);
      if (generation.current !== id) return;
      downloadFile(file);
      dispatch({ type: 'apply' });
      setExportOpen(false);
    } catch (failure) {
      if (generation.current === id)
        setExportError(
          failure instanceof Error ? failure.message : '导出图片失败。'
        );
    } finally {
      if (generation.current === id) setExporting(false);
    }
  };

  return (
    <section
      className={`workspace-theme image-workbench ${isDragging ? 'is-dragging' : ''}`}
      aria-label={title}
      {...dropHandlers}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          exportOpen ||
          target.closest('input, textarea, select, [contenteditable]') ||
          !(event.ctrlKey || event.metaKey) ||
          event.altKey
        )
          return;
        const key = event.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        event.preventDefault();
        const redo = key === 'y' || event.shiftKey;
        if (redo ? canRedo : canUndo)
          dispatch({ type: redo ? 'redo' : 'undo' });
      }}
    >
      <input
        ref={input}
        type="file"
        className="iw-file-input"
        aria-label="选择图片文件"
        accept={accepted.join(',')}
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <header className="iw-toolbar">
        <div className="iw-toolbar-file">
          <Link
            to="/categories/image-generic"
            className="iw-back"
            aria-label="返回图像处理"
            title="返回图像处理"
          >
            <Glyph name="arrow" size={18} style={{ rotate: '180deg' }} />
          </Link>
          <span className="iw-title">
            <Glyph name="image" size={19} />
            {title}
          </span>
          <button type="button" disabled={exporting} onClick={openFiles}>
            <Glyph name="upload" size={16} />
            {source ? '更换图片' : '打开图片'}
          </button>
        </div>
        <span className="iw-filename" title={source?.file.name}>
          {source?.file.name}
        </span>
        <div className="iw-toolbar-actions">
          <button
            type="button"
            className="iw-icon-button"
            aria-label="撤销"
            title="撤销"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'undo' })}
          >
            <Glyph name="undo" size={18} />
          </button>
          <button
            type="button"
            className="iw-icon-button"
            aria-label="重做"
            title="重做"
            disabled={!canRedo}
            onClick={() => dispatch({ type: 'redo' })}
          >
            <Glyph name="redo" size={18} />
          </button>
          <button
            type="button"
            className="iw-primary"
            disabled={!source || invalid || busy}
            onClick={() => {
              setExportError('');
              setExportOpen(true);
            }}
          >
            <Glyph name="download" size={16} /> 导出
          </button>
        </div>
      </header>
      <div className="iw-work-tabs" role="tablist" aria-label="工作台功能">
        {tabs.map(({ id, label }, index) => (
          <button
            key={id}
            id={`iw-tab-${id}`}
            role="tab"
            type="button"
            aria-selected={id === tab}
            aria-controls={`iw-panel-${id}`}
            tabIndex={id === tab ? 0 : -1}
            onClick={() => chooseTab(id)}
            onKeyDown={(event) => {
              const offsets = { ArrowLeft: -1, ArrowRight: 1 };
              const offset = offsets[event.key as keyof typeof offsets];
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : offset
                      ? (index + offset + tabs.length) % tabs.length
                      : -1;
              if (next < 0) return;
              event.preventDefault();
              chooseTab(tabs[next].id);
              (
                event.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="iw-workbench-alert iw-alert" role="alert">
          {error}
        </p>
      )}
      {tab !== 'edit' && invalid && (
        <p className="iw-workbench-alert iw-alert" role="alert">
          请返回图片编辑修正当前参数，再处理画布上的图片。
        </p>
      )}
      <div className="iw-layout" data-panel={tab}>
        <ImageCanvas
          source={comparing ? comparison.result : source}
          edits={comparing ? noEdits : edits}
          draft={
            comparing ? null : cropActive && !invalid ? draft : currentEdit
          }
          size={comparing ? comparison.result : canvasSize}
          loading={loading}
          onOpen={openFiles}
          onCrop={(rect) => {
            if (cropActive && draft?.type === 'crop' && !busy)
              dispatch({ type: 'draft', draft: { ...draft, rect } });
          }}
          onError={setError}
        />
        <aside className="iw-sidebar">
          {tabs.map(({ id }) => (
            <div
              key={id}
              id={`iw-panel-${id}`}
              role="tabpanel"
              aria-labelledby={`iw-tab-${id}`}
              hidden={id !== tab}
            >
              {(id === tab || (id === 'batch' && batchVisited)) && (
                <Suspense
                  fallback={
                    <p className="iw-settings" role="status">
                      正在加载工具…
                    </p>
                  }
                >
                  {id === 'edit' && (
                    <ImageControls
                      tool={tool}
                      draft={draft}
                      size={size}
                      dirty={dirty}
                      invalid={invalid}
                      busy={busy}
                      onTool={(next) => {
                        if (invalid) return;
                        dispatch({ type: 'tool', tool: next, maskMode });
                        setParams(
                          (current) => {
                            const updated = new URLSearchParams(current);
                            updated.set('tool', next);
                            return updated;
                          },
                          { replace: true }
                        );
                      }}
                      onDraft={(next) =>
                        dispatch({ type: 'draft', draft: next })
                      }
                      onApply={() => dispatch({ type: 'apply' })}
                      onDiscard={() => dispatch({ type: 'discard' })}
                    />
                  )}
                  {id === 'background' && (
                    <ImageBackgroundPanel
                      snapshot={snapshot}
                      comparing={comparing}
                      disabled={busy}
                      onPreview={setComparison}
                      onApply={(result) => {
                        if (result.snapshot !== snapshot) return;
                        dispatch({ type: 'background', result: result.result });
                        setComparison(null);
                        setTab('edit');
                      }}
                    />
                  )}
                  {id === 'batch' && <ImageBatchPanel snapshot={snapshot} />}
                  {id === 'print' && (
                    <ImagePrintPanel snapshot={snapshot} disabled={busy} />
                  )}
                </Suspense>
              )}
            </div>
          ))}
        </aside>
      </div>
      {exportOpen && source && finalSize && (
        <Suspense fallback={null}>
          <ImageExportDialog
            filename={`${source.file.name.replace(/\.[^.]+$/, '')}-edited`}
            size={finalSize}
            vector={canExportSvg(source, snapshot?.edits ?? edits)}
            saving={exporting}
            error={exportError}
            onClose={() => setExportOpen(false)}
            onExport={(options) => void save(options)}
          />
        </Suspense>
      )}
    </section>
  );
}
