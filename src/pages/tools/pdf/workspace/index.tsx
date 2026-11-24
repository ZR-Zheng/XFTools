import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import type { PDFDocument } from 'pdf-lib';
import { Link, useSearchParams } from 'react-router-dom';
import type { ToolComponentProps } from '@tools/defineTool';
import { useWorkbenchText } from 'i18n/workbench';
import { downloadFile } from '@utils/file';
import Glyph from '@components/workbench/Glyph';
import { defaultCompression } from '../compress-pdf/types';
import { isFormEdit, pageCropBox, type PageEdit } from '../shared/page-edits';
import PdfEditLayer, { type NewGeometry, type Placement } from './PdfEditLayer';
import PdfEditPanel, { editKindName } from './PdfEditPanel';
import PdfImageImport from './PdfImageImport';
import PdfPasswordPrompt from './PdfPasswordPrompt';
import PdfPageGrid from './PdfPageGrid';
import PdfPageMenu, { type PageMenuAnchor } from './PdfPageMenu';
import PdfSidebarResize from './PdfSidebarResize';
import PdfToolsToolbar from './PdfToolsToolbar';
import PdfExportOptions, {
  PdfResultItems,
  outputLabel
} from './PdfExportOptions';
import {
  convertOutput,
  outputKinds,
  type ExportResult,
  type OutputKind,
  type OutputSettings
} from './advanced-exports';
import type { InitialValuesType as ImageOptions } from '../convert-to-pdf/types';
import type { PdfJob } from '../shared/task';
import {
  duplicatePages,
  groupBySources,
  movePages,
  movePagesRelative,
  rotatePages,
  sourcePages
} from '../shared/page-plan';
import type {
  PdfAsset,
  PdfPageInstance,
  PdfWorkspace
} from '../shared/page-plan';
import PdfReader from './PdfReader';
import {
  readPageGroups,
  willCopyPages,
  type ExportMode
} from './export-selection';
import '@components/workbench/workspace-theme.css';
import './pdf-workbench.css';

const loadPdfCanvas = () => import('../shared/PdfCanvas');
const PdfCanvas = lazy(loadPdfCanvas);
const PdfAdvancedEditor = lazy(() => import('./PdfAdvancedEditor'));
const compactPanels = '(max-width: 740px)';
const pagesPerPanel = 24;
type RightPanel = 'export' | 'annotation' | 'form' | 'images';
type OutputScope = ExportMode | 'png-range';
const empty = (): PdfWorkspace => ({ sources: [], pages: [] });
const sizeLabel = (bytes: number) =>
  bytes < 1048576
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
type Preview = { source: PdfAsset; pageIndex: number; rotation: number };

function makeAsset(file: File, document: PDFDocument): PdfAsset {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    file,
    document,
    pageCount: document.getPageCount(),
    hasForms: document.getForm().getFields().length > 0,
    sizes: document.getPages().map((page) => ({
      ...pageCropBox(page),
      rotation: page.getRotation().angle
    }))
  };
}

function PreviewDialog({
  preview,
  close,
  change,
  english
}: {
  preview: Preview;
  close: () => void;
  change: (next: Preview) => void;
  english: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="pdf-preview-dialog"
      ref={dialog}
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="pdf-preview-title"
    >
      <header>
        <h2 id="pdf-preview-title">{preview.source.name}</h2>
        <button type="button" onClick={close}>
          {english ? 'Close' : '关闭'}
        </button>
      </header>
      <div className="pdf-preview-sheet">
        <Suspense fallback={<span>PDF…</span>}>
          <PdfCanvas
            source={preview.source}
            pageIndex={preview.pageIndex}
            rotation={preview.rotation}
            width={700}
          />
        </Suspense>
      </div>
      <footer>
        <button
          type="button"
          disabled={!preview.pageIndex}
          onClick={() =>
            change({
              ...preview,
              pageIndex: preview.pageIndex - 1,
              rotation: 0
            })
          }
        >
          {english ? 'Previous page' : '上一页'}
        </button>
        <span>
          {preview.pageIndex + 1} / {preview.source.pageCount}
        </span>
        <button
          type="button"
          disabled={preview.pageIndex + 1 >= preview.source.pageCount}
          onClick={() =>
            change({
              ...preview,
              pageIndex: preview.pageIndex + 1,
              rotation: 0
            })
          }
        >
          {english ? 'Next page' : '下一页'}
        </button>
      </footer>
    </dialog>
  );
}

export default function PdfWorkspacePage({ title }: ToolComponentProps) {
  const { english } = useWorkbenchText();
  const t = (zh: string, en: string) => (english ? en : zh);
  const [params] = useSearchParams();
  const preset = params.get('mode');
  const requestedFormat = params.get('format') as OutputKind | null;
  const initialPanel: RightPanel | null =
    preset === 'editor'
      ? 'annotation'
      : preset === 'form'
        ? 'form'
        : preset === 'images'
          ? 'images'
          : preset || requestedFormat
            ? 'export'
            : null;
  const [workspace, setWorkspace] = useState<PdfWorkspace>(empty);
  const [selected, setSelectedState] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'files' | 'pages'>(
    preset === 'merge' ? 'files' : 'pages'
  );
  const [compact, setCompact] = useState(
    () => window.matchMedia(compactPanels).matches
  );
  const [drawer, setDrawer] = useState<'pages' | RightPanel | null>(() =>
    window.matchMedia(compactPanels).matches
      ? preset === 'rotate'
        ? 'pages'
        : initialPanel
      : null
  );
  const [pagesOpen, setPagesOpen] = useState(true);
  const [desktopPanel, setDesktopPanel] = useState<RightPanel | null>(
    initialPanel
  );
  const rightPanel = compact
    ? drawer === 'pages'
      ? null
      : drawer
    : desktopPanel;
  const showExport = rightPanel === 'export';
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [selectedMark, setSelectedMark] = useState<{
    pageId: string;
    editId: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [readerTarget, setReaderTarget] = useState<{ id: string } | null>(null);
  const [windowIndex, setWindowIndex] = useState(0);
  const initialFilename =
    preset === 'merge'
      ? 'merged.pdf'
      : preset === 'split'
        ? 'split.pdf'
        : preset === 'rotate'
          ? 'rotated.pdf'
          : 'document.pdf';
  const [filename, setFilename] = useState(initialFilename);
  const [bookmarks, setBookmarks] = useState(preset === 'merge');
  const [exportMode, setExportMode] = useState<OutputScope>(
    preset === 'split' ? 'selection' : 'all'
  );
  const [merging, setMerging] = useState(preset === 'merge');
  const [ranges, setRanges] = useState('');
  const [rotationAngle, setRotationAngle] = useState(90);
  const [output, setOutput] = useState<OutputSettings>({
    kind:
      requestedFormat && outputKinds.includes(requestedFormat)
        ? requestedFormat
        : preset === 'export'
          ? 'png'
          : 'pdf',
    ranges: '',
    scale: 1.5,
    ...defaultCompression,
    password: '',
    confirmPassword: ''
  });
  const [result, setResult] = useState<ExportResult | null>(null);
  const [advancedFile, setAdvancedFile] = useState<File | null>(null);
  const [encryptedFiles, setEncryptedFiles] = useState<File[]>([]);
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'import' | 'export' | null>(null);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [moveTo, setMoveTo] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState<number>();
  const [pageMenu, setPageMenu] = useState<PageMenuAnchor | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const organizer = useRef<HTMLElement>(null);
  const organizerToggle = useRef<HTMLButtonElement>(null);
  const selectionAnchor = useRef<string | null>(null);
  const assets = useRef(new Map<string, PdfAsset>());
  const past = useRef<PdfWorkspace[]>([]),
    future = useRef<PdfWorkspace[]>([]);
  const task = useRef<AbortController | null>(null);
  const sourceDrag = useRef<string | null>(null);
  const { sources, pages } = workspace;
  const thumbnailTray = compact && pagesOpen && !drawer && pages.length > 0;
  const showPages = compact ? drawer === 'pages' || thumbnailTray : pagesOpen;
  const organizerMode = thumbnailTray ? 'pages' : mode;
  const activePageIndex = pages.findIndex((page) => page.id === currentPage);
  const activePage = pages[activePageIndex];
  const selectedPage = pages.find((page) => page.id === selectedMark?.pageId);
  const currentEdit = selectedPage?.edits?.find(
    (edit) => edit.id === selectedMark?.editId
  );
  const openPanel = (panel: RightPanel | null) => {
    if (compact) setDrawer(panel);
    else setDesktopPanel(panel);
  };
  const togglePanel = (panel: RightPanel) => {
    setPlacement(null);
    openPanel(rightPanel === panel ? null : panel);
  };
  const showOrganizer = (view: typeof mode) => {
    setMode(view);
    if (view === 'pages' && thumbnailTray)
      setWindowIndex(Math.floor(Math.max(0, activePageIndex) / pagesPerPanel));
    else if (mode !== view) setWindowIndex(0);
    setPagesOpen(true);
    if (compact) setDrawer('pages');
  };
  const toggleOrganizer = () => {
    if (compact && drawer === 'pages') setDrawer(null);
    else if (!compact && showPages) setPagesOpen(false);
    else showOrganizer('pages');
  };
  const activeFilename =
    sources.find((source) => source.id === activePage?.sourceId)?.name ??
    sources[0]?.name;
  useEffect(() => {
    const media = window.matchMedia(compactPanels);
    const change = () => {
      setCompact(media.matches);
      setDrawer(null);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const setSelected: typeof setSelectedState = (next) => {
    setSelectedState(next);
    if (exportMode === 'selection') setResult(null);
  };
  const commit = (next: PdfWorkspace) => {
    past.current = [...past.current.slice(-39), workspace];
    future.current = [];
    setWorkspace(next);
    setResult(null);
    setError('');
  };
  const editPages = (next: PdfPageInstance[]) =>
    commit({ ...workspace, pages: next });
  const reorderPages = (
    ids: ReadonlySet<string>,
    targetId: string,
    side: 'before' | 'after' = 'before'
  ) => {
    if (busy) return;
    const next = movePagesRelative(pages, ids, targetId, side);
    if (next !== pages) editPages(next);
  };
  const history = (undo: boolean) => {
    const from = undo ? past : future,
      to = undo ? future : past;
    const next = from.current.pop();
    if (!next) return;
    to.current.push(workspace);
    setWorkspace(next);
    setSelected(new Set());
    setPlacement(null);
    setResult(null);
    setError('');
  };
  useEffect(
    () => () => {
      task.current?.abort();
      task.current = null;
      assets.current.forEach((source) => source.disposePreview?.());
    },
    []
  );
  useEffect(() => {
    const retained = new Set(
      [workspace, ...past.current, ...future.current].flatMap((state) =>
        state.sources.map((source) => source.id)
      )
    );
    const current = new Set(workspace.sources.map((source) => source.id));
    assets.current.forEach((source, id) => {
      if (!current.has(id)) source.disposePreview?.();
      if (!retained.has(id)) assets.current.delete(id);
    });
  }, [workspace]);
  const pageSize = organizerMode === 'files' ? 12 : pagesPerPanel;
  const items = organizerMode === 'files' ? sources.length : pages.length;
  const lastWindow = Math.max(0, Math.ceil(items / pageSize) - 1);
  const currentWindow = thumbnailTray
    ? Math.floor(Math.max(0, activePageIndex) / pageSize)
    : Math.min(windowIndex, lastWindow);
  const offset = currentWindow * pageSize;
  const selectedIds = useMemo(
    () =>
      new Set(
        pages.filter((page) => selected.has(page.id)).map((page) => page.id)
      ),
    [pages, selected]
  );
  const { groups, invalidRanges } = useMemo(() => {
    if (exportMode === 'split') {
      try {
        const rangesInOrder = readPageGroups(ranges, pages.length);
        return {
          groups: rangesInOrder.map(({ first, last }) =>
            pages.slice(first - 1, last)
          ),
          invalidRanges: false
        };
      } catch {
        return { groups: [], invalidRanges: true };
      }
    }
    const included =
      exportMode === 'selection'
        ? pages.filter((page) => selectedIds.has(page.id))
        : pages;
    return { groups: included.length ? [included] : [], invalidRanges: false };
  }, [exportMode, pages, ranges, selectedIds]);
  const pdfOutput = ['pdf', 'compress', 'protect'].includes(output.kind);
  const useBookmarks = pdfOutput && bookmarks;
  const showPngRanges = output.kind === 'png' && exportMode === 'png-range';
  const pngRanges = showPngRanges ? output.ranges.trim() : '';
  let outputPageCount = groups.reduce(
    (count, group) => count + group.length,
    0
  );
  let invalidPngRange = false;
  if (showPngRanges) outputPageCount = 0;
  if (pngRanges && groups.length) {
    try {
      const numbers = new Set<number>();
      for (const { first, last } of readPageGroups(pngRanges, groups[0].length))
        for (let number = first; number <= last; number++) numbers.add(number);
      outputPageCount = numbers.size;
    } catch {
      invalidPngRange = true;
    }
  }
  const canExport =
    !!groups.length &&
    !invalidPngRange &&
    (!showPngRanges || !!pngRanges) &&
    (output.kind !== 'protect' ||
      (!!output.password && output.password === output.confirmPassword));
  const changeOutput = (change: Partial<OutputSettings>) => {
    setOutput((previous) => ({ ...previous, ...change }));
    setResult(null);
  };
  const openOutput = (
    kind: OutputKind,
    scope: OutputScope = 'all',
    merge = false
  ) => {
    if (busy) return;
    if (kind !== output.kind)
      changeOutput({ kind, password: '', confirmPassword: '' });
    if (exportMode !== scope || merging !== merge) {
      setExportMode(scope);
      setMerging(merge);
      setResult(null);
    }
    setPlacement(null);
    openPanel('export');
  };
  const savePanel =
    showExport && output.kind === 'pdf' && !merging && exportMode !== 'split';
  const outputTitle = merging
    ? t('合并 PDF', 'Merge PDFs')
    : exportMode === 'split'
      ? t('拆分 PDF', 'Split PDF')
      : output.kind === 'pdf' && exportMode === 'selection'
        ? t('提取选中页', 'Extract selected pages')
        : outputLabel(output.kind, t);
  const outputAction =
    output.kind === 'png'
      ? t('生成 PNG', 'Generate PNG')
      : output.kind === 'epub'
        ? t('生成 EPUB', 'Generate EPUB')
        : output.kind === 'compress'
          ? t('开始压缩', 'Compress')
          : output.kind === 'protect'
            ? t('加密并保存', 'Encrypt and save')
            : output.kind === 'pdf' && !merging && exportMode === 'all'
              ? t('生成 PDF', 'Generate PDF')
              : outputTitle;
  const outputHasForms = useMemo(() => {
    const formSources = new Set(
      sources.filter((source) => source.hasForms).map((source) => source.id)
    );
    return (
      formSources.size > 0 &&
      groups.some(
        (group) =>
          willCopyPages(sources, group, bookmarks) &&
          group.some((page) => page.sourceId && formSources.has(page.sourceId))
      )
    );
  }, [sources, groups, bookmarks]);

  const addFiles = async (files: File[]) => {
    if (!files.length || task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy('import');
    setError('');
    setResult(null);
    setPlacement(null);
    const added: PdfAsset[] = [],
      errors: string[] = [];
    const encrypted: File[] = [];
    const loadLibrary = import('pdf-lib');
    void loadPdfCanvas().catch(() => {});
    let library: Awaited<typeof loadLibrary> | undefined;
    for (const [index, file] of files.entries()) {
      if (controller.signal.aborted) break;
      setProgress(
        `${t('读取文件', 'Reading files')} ${index + 1} / ${files.length}`
      );
      try {
        const [data, pdf] = await Promise.all([
          file.arrayBuffer(),
          loadLibrary
        ]);
        library = pdf;
        controller.signal.throwIfAborted();
        const document = await pdf.PDFDocument.load(data);
        controller.signal.throwIfAborted();
        if (!document.getPageCount())
          throw new Error(t('文件没有页面', 'No pages in this PDF'));
        const source = makeAsset(file, document);
        assets.current.set(source.id, source);
        added.push(source);
      } catch (error) {
        if (controller.signal.aborted) break;
        if (
          (library && error instanceof library.EncryptedPDFError) ||
          (error instanceof Error &&
            error.message.startsWith(
              'Input document to `PDFDocument.load` is encrypted.'
            ))
        )
          encrypted.push(file);
        else
          errors.push(
            `${file.name}: ${t('无法读取，请检查文件是否损坏或受密码保护。', 'Cannot read this PDF. Check for corruption or password protection.')} ${error instanceof Error ? error.message : ''}`
          );
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (task.current !== controller) return;
    if (added.length) {
      const newPages = added.flatMap((source) =>
        sourcePages(source.id, source.pageCount)
      );
      commit({
        sources: [...sources, ...added],
        pages: [...pages, ...newPages]
      });
      if (preset === 'split' && !pages.length && exportMode === 'selection')
        setSelected(new Set(newPages.map((page) => page.id)));
      if (!sources.length && added.length === 1)
        setFilename((current) =>
          current === 'document.pdf' ? added[0].name : current
        );
    }
    if (!controller.signal.aborted && encrypted.length)
      setEncryptedFiles((current) => [...current, ...encrypted]);
    setError(errors.join('\n'));
    setProgress('');
    setBusy(null);
    task.current = null;
  };

  const prepareImport = async (
    prepare: (job: PdfJob) => Promise<File>,
    onFailure: (message: string) => void
  ) => {
    if (task.current) return false;
    const controller = new AbortController();
    task.current = controller;
    setBusy('import');
    setError('');
    let prepared: File | undefined;
    try {
      prepared = await prepare({
        signal: controller.signal,
        onProgress: (done, total) =>
          setProgress(`${t('生成页面', 'Creating pages')} ${done} / ${total}`)
      });
      controller.signal.throwIfAborted();
    } catch (error) {
      if (!controller.signal.aborted)
        onFailure(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      if (task.current === controller) {
        task.current = null;
        setBusy(null);
        setProgress('');
      }
    }
    await addFiles([prepared]);
    return true;
  };
  const importImages = async (files: File[], options: ImageOptions) => {
    const imported = await prepareImport(async (job) => {
      const { buildPdf } = await import('../convert-to-pdf/service');
      return (await buildPdf(files, options, job)).pdfFile;
    }, setError);
    if (imported) openPanel(null);
  };
  const dismissPassword = () => {
    task.current?.abort();
    setPasswordError('');
    setEncryptedFiles((files) => files.slice(1));
  };
  const unlockFile = async (password: string) => {
    const file = encryptedFiles[0];
    if (!file || task.current) return;
    setPasswordError('');
    const imported = await prepareImport(async (job) => {
      const { unlockPdf } = await import('../protect-pdf/service');
      return unlockPdf(file, password, job.signal);
    }, setPasswordError);
    if (imported)
      setEncryptedFiles((files) => files.filter((item) => item !== file));
  };
  const reorderFiles = (sourceId: string, targetIndex: number) => {
    const index = sources.findIndex((source) => source.id === sourceId);
    if (
      index < 0 ||
      index === targetIndex ||
      targetIndex < 0 ||
      targetIndex >= sources.length
    )
      return;
    const next = [...sources];
    next.splice(targetIndex, 0, next.splice(index, 1)[0]);
    commit({ sources: next, pages: groupBySources(pages, next) });
  };
  const clear = () => {
    setWorkspace(empty());
    setSelected(new Set());
    setResult(null);
    setError('');
    setWindowIndex(0);
    setPreview(null);
    setReaderTarget(null);
    setPlacement(null);
    setSelectedMark(null);
    setEncryptedFiles([]);
    setPasswordError('');
    setOutput((previous) => ({
      ...previous,
      password: '',
      confirmPassword: ''
    }));
    setRanges('');
    setFilename(initialFilename);
    selectionAnchor.current = null;
    past.current = [];
    future.current = [];
    assets.current.forEach((source) => source.disposePreview?.());
    assets.current.clear();
  };
  const toggle = (id: string, range = false) => {
    const anchor = pages.findIndex(
      (page) => page.id === selectionAnchor.current
    );
    const index = pages.findIndex((page) => page.id === id);
    selectionAnchor.current = id;
    setSelected((previous) => {
      const next = new Set(previous);
      if (range && anchor >= 0 && index >= 0) {
        pages
          .slice(Math.min(anchor, index), Math.max(anchor, index) + 1)
          .forEach((page) => next.add(page.id));
        return next;
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const removePages = (ids: ReadonlySet<string>) => {
    editPages(pages.filter((page) => !ids.has(page.id)));
    setSelected(
      (previous) => new Set([...previous].filter((id) => !ids.has(id)))
    );
  };
  const insertBlank = (ids: ReadonlySet<string>) => {
    const blank: PdfPageInstance = {
      id: crypto.randomUUID(),
      sourceId: null,
      pageIndex: 0,
      rotation: 0,
      blankSize: { width: 595.28, height: 841.89 }
    };
    const last = pages.findLastIndex((page) => ids.has(page.id));
    const index = last < 0 ? pages.length : last + 1;
    editPages([...pages.slice(0, index), blank, ...pages.slice(index)]);
  };
  const exportSelection = (ids: ReadonlySet<string>) => {
    if (ids !== selectedIds) setSelected(new Set(ids));
    openOutput(output.kind, 'selection');
  };
  const applyRotation = () => {
    if (!pages.length) return;
    const byId = new Map(sources.map((source) => [source.id, source]));
    editPages(
      pages.map((page) => {
        if (selectedIds.size && !selectedIds.has(page.id)) return page;
        const original =
          (page.sourceId
            ? byId.get(page.sourceId)?.sizes[page.pageIndex].rotation
            : 0) ?? 0;
        const rotation = ((rotationAngle - original + 360) %
          360) as PdfPageInstance['rotation'];
        return { ...page, rotation };
      })
    );
  };
  const exportPdf = async () => {
    if (!canExport || task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy('export');
    setResult(null);
    setError('');
    try {
      const { exportWorkspaceGroups } = await import('./exports');
      const file = await exportWorkspaceGroups(sources, groups, {
        filename,
        bookmarks: useBookmarks,
        signal: controller.signal,
        onProgress: (done, total) =>
          setProgress(
            `${groups.length > 1 ? t('生成文件', 'Generating files') : t('处理页面', 'Processing pages')} ${done} / ${total}`
          )
      });
      const converted =
        output.kind === 'pdf'
          ? { file }
          : await convertOutput(
              file,
              {
                ...output,
                ranges: pngRanges.replace(/，/g, ',').replace(/–/g, '-')
              },
              {
                signal: controller.signal,
                onProgress: (done, total) =>
                  setProgress(
                    `${t('处理输出', 'Processing output')} ${done} / ${total}`
                  )
              }
            );
      controller.signal.throwIfAborted();
      setResult(converted);
      if (output.kind === 'protect')
        setOutput((previous) => ({
          ...previous,
          ranges: '',
          password: '',
          confirmPassword: ''
        }));
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          `${t('导出失败', 'Export failed')}: ${error instanceof Error ? error.message : String(error)}`
        );
    } finally {
      if (task.current === controller) {
        setBusy(null);
        setProgress('');
        task.current = null;
      }
    }
  };
  const openAdvanced = async () => {
    if (!pages.length || task.current) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy('export');
    setError('');
    setPlacement(null);
    try {
      const { exportWorkspacePdf } = await import('./exports');
      const file = await exportWorkspacePdf(sources, pages, {
        filename,
        bookmarks: false,
        signal: controller.signal
      });
      controller.signal.throwIfAborted();
      setAdvancedFile(file);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (task.current === controller) {
        task.current = null;
        setBusy(null);
        setProgress('');
      }
    }
  };
  const applyAdvanced = async (file: File) => {
    const [{ PDFDocument }, bytes] = await Promise.all([
      import('pdf-lib'),
      file.arrayBuffer()
    ]);
    const document = await PDFDocument.load(bytes);
    if (!document.getPageCount())
      throw new Error(t('PDF 中没有可用页面。', 'The PDF has no pages.'));
    const source = makeAsset(file, document);
    const next = sourcePages(source.id, source.pageCount);
    if (next.length === pages.length)
      next.forEach((page, index) => {
        page.id = pages[index].id;
      });
    assets.current.set(source.id, source);
    commit({ sources: [source], pages: next });
    setSelected(new Set());
    setSelectedMark(null);
    setAdvancedFile(null);
  };
  const thumbnail = (source: PdfAsset, pageIndex = 0, rotation = 0) => (
    <Suspense fallback={<span className="pdf-loading">PDF…</span>}>
      <PdfCanvas source={source} pageIndex={pageIndex} rotation={rotation} />
    </Suspense>
  );
  const openFiles = () => input.current?.click();
  const showPage = (id: string) => {
    setReaderTarget({ id });
    if (compact) setDrawer(null);
  };
  const selectMark = (pageId: string, edit: PageEdit) => {
    setSelectedMark({ pageId, editId: edit.id });
    openPanel(isFormEdit(edit.kind) ? 'form' : 'annotation');
  };
  const placeMark = (pageId: string, geometry: NewGeometry) => {
    if (!placement || busy) return;
    const { kind, edit: previous, pageId: previousPage } = placement;
    const isField = isFormEdit(kind);
    const edit: PageEdit = {
      ...(previous ?? {
        id: crypto.randomUUID(),
        kind,
        color:
          kind === 'note' || kind === 'highlight'
            ? '#f6cb53'
            : kind === 'ink'
              ? '#176852'
              : '#192e2e',
        text:
          kind === 'freeText'
            ? t('文本批注', 'Annotation')
            : kind === 'label'
              ? t('文字标签', 'Label')
              : '',
        name:
          isField && kind !== 'label'
            ? `field_${crypto.randomUUID().slice(0, 8)}`
            : '',
        checked: false,
        required: false
      }),
      ...geometry
    };
    editPages(
      pages.map((page) => {
        if (page.id !== pageId && page.id !== previousPage) return page;
        const edits = (page.edits ?? []).filter(
          (item) => page.id !== previousPage || item.id !== previous?.id
        );
        return {
          ...page,
          edits: page.id === pageId ? [...edits, edit] : edits
        };
      })
    );
    setPlacement(null);
    if (currentPage !== pageId) setReaderTarget({ id: pageId });
    selectMark(pageId, edit);
  };
  const changeMark = (edit: PageEdit, remove = false) => {
    if (busy || !selectedPage || !currentEdit) return;
    editPages(
      pages.map((page) =>
        page.id === selectedPage.id
          ? {
              ...page,
              edits: remove
                ? page.edits?.filter((item) => item.id !== edit.id)
                : page.edits?.map((item) => (item.id === edit.id ? edit : item))
            }
          : page
      )
    );
    if (remove) setSelectedMark(null);
  };
  return (
    <section
      className={`workspace-theme pdf-workbench ${dragging ? 'is-dragging' : ''}`}
      aria-label={title}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        void addFiles(Array.from(event.dataTransfer.files));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !preview && !event.defaultPrevented) {
          setPlacement(null);
          setDrawer(null);
        }
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        aria-label={t('选择 PDF 文件', 'Choose PDF files')}
        className="pdf-file-input"
        tabIndex={-1}
        disabled={!!busy}
        onChange={(event) => {
          void addFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />
      <div
        className="pdf-document-toolbar"
        role="group"
        aria-label={t('文档工具栏', 'Document toolbar')}
      >
        <div className="pdf-document-actions">
          <Link
            to="/"
            className="pdf-back-link"
            aria-label="返回工具箱"
            title="返回工具箱"
          >
            <Glyph name="arrow" size={18} style={{ rotate: '180deg' }} />
          </Link>
          <button
            type="button"
            className="pdf-open"
            disabled={!!busy}
            onClick={openFiles}
          >
            <Glyph name="upload" size={16} />
            {sources.length
              ? t('添加文件', 'Add files')
              : t('打开 PDF', 'Open PDF')}
          </button>
          <button
            type="button"
            className="pdf-icon-button pdf-thumbnails-toggle"
            ref={organizerToggle}
            aria-expanded={compact ? drawer === 'pages' : showPages}
            aria-controls="pdf-arrange-panel"
            aria-label={t('组织页面', 'Organize pages')}
            title={t('页面缩略图', 'Page thumbnails')}
            onClick={toggleOrganizer}
          >
            <Glyph name="panel" size={18} />
          </button>
        </div>
        <div
          className="pdf-document-label"
          title={activeFilename}
          hidden={!activeFilename && !pages.length}
        >
          <Glyph name="file" size={15} />
          <span>{activeFilename ?? t('新建文档', 'New document')}</span>
          {sources.length > 1 && (
            <small>
              {sources.length} {t('个文件', 'files')}
            </small>
          )}
        </div>
        <button
          type="button"
          className="pdf-primary pdf-export-toggle"
          aria-expanded={savePanel}
          aria-controls="pdf-export-panel"
          onClick={() =>
            savePanel
              ? openPanel(null)
              : openOutput(
                  'pdf',
                  output.kind === 'pdf' &&
                    exportMode === 'selection' &&
                    !merging
                    ? 'selection'
                    : 'all'
                )
          }
        >
          <Glyph name="download" size={17} />
          {outputLabel('pdf', t)}
        </button>
      </div>
      <PdfToolsToolbar
        undo={() => history(true)}
        redo={() => history(false)}
        canUndo={!busy && past.current.length > 0}
        canRedo={!busy && future.current.length > 0}
        groups={[
          {
            id: 'pages',
            label: t('页面整理', 'Organize pages'),
            icon: 'panel',
            actions: [
              {
                label: t('页面缩略图', 'Page thumbnails'),
                description: t(
                  '拖动排序，旋转或删除页面',
                  'Reorder, rotate or delete pages'
                ),
                icon: 'grid',
                active: showPages && organizerMode === 'pages',
                run: () => showOrganizer('pages')
              },
              {
                label: t('合并 PDF', 'Merge PDFs'),
                description: t(
                  '将多个 PDF 合成一个文件',
                  'Combine multiple PDFs into one file'
                ),
                icon: 'copy',
                active: showExport && merging,
                disabled: !!busy,
                run: () => {
                  openOutput('pdf', 'all', true);
                  if (!compact) showOrganizer('files');
                }
              },
              {
                label: t('拆分 PDF', 'Split PDF'),
                description: t(
                  '按页码范围分别保存',
                  'Save each page range separately'
                ),
                icon: 'list',
                active: showExport && exportMode === 'split',
                disabled: !!busy,
                run: () => openOutput('pdf', 'split')
              },
              {
                label: t('提取选中页', 'Extract selected pages'),
                icon: 'download',
                active: savePanel && exportMode === 'selection',
                disabled: !!busy,
                run: () => openOutput('pdf', 'selection')
              }
            ]
          },
          {
            id: 'edit',
            label: t('批注与表单', 'Annotations and forms'),
            short: t('批注表单', 'Edit'),
            icon: 'message',
            actions: [
              {
                label: t('批注', 'Annotations'),
                description: t(
                  '便签、高亮、手绘与文本',
                  'Notes, highlights, ink and text'
                ),
                icon: 'message',
                active: rightPanel === 'annotation',
                run: () => togglePanel('annotation')
              },
              {
                label: t('表单设计', 'Form design'),
                description: t(
                  '添加文本框、复选框等可填写字段',
                  'Add fillable fields, including checkboxes and text boxes'
                ),
                icon: 'form',
                active: rightPanel === 'form',
                run: () => togglePanel('form')
              }
            ]
          },
          {
            id: 'convert',
            label: t('格式转换', 'Convert formats'),
            short: t('格式转换', 'Convert'),
            icon: 'convert',
            actions: [
              {
                label: outputLabel('png', t),
                description: t('每页生成一张 PNG', 'Render each page as a PNG'),
                icon: 'image-export',
                active: showExport && output.kind === 'png',
                disabled: !!busy,
                run: () =>
                  openOutput('png', output.kind === 'png' ? exportMode : 'all')
              },
              {
                label: t('图片转 PDF', 'Images to PDF'),
                icon: 'image',
                active: rightPanel === 'images',
                run: () => togglePanel('images')
              },
              {
                label: outputLabel('epub', t),
                description: t(
                  '用可选中的文字生成电子书',
                  'Create an ebook from selectable text'
                ),
                icon: 'file',
                active: showExport && output.kind === 'epub',
                disabled: !!busy,
                run: () => openOutput('epub')
              },
              {
                label: outputLabel('extract', t),
                description: t(
                  '下载文档原有的图片',
                  'Download images embedded in the document'
                ),
                icon: 'download',
                active: showExport && output.kind === 'extract',
                disabled: !!busy,
                run: () => openOutput('extract')
              }
            ]
          },
          {
            id: 'file',
            label: t('压缩与加密', 'Compress and encrypt'),
            short: t('压缩加密', 'Optimize'),
            icon: 'shield',
            actions: [
              {
                label: outputLabel('compress', t),
                description: t(
                  '调整内嵌图片的编码、尺寸和画质',
                  'Adjust embedded image encoding, dimensions and quality'
                ),
                icon: 'compress',
                active: showExport && output.kind === 'compress',
                disabled: !!busy,
                run: () => openOutput('compress')
              },
              {
                label: outputLabel('protect', t),
                description: t(
                  '设置打开 PDF 所需的密码',
                  'Require a password to open the PDF'
                ),
                icon: 'shield',
                active: showExport && output.kind === 'protect',
                disabled: !!busy,
                run: () => openOutput('protect')
              }
            ]
          }
        ]}
        more={[
          {
            label: t('清空', 'Clear'),
            icon: 'trash',
            danger: true,
            disabled: !!busy || (!sources.length && !pages.length),
            run: clear
          }
        ]}
        t={t}
      />
      {!!busy && (
        <div className="pdf-task" role="status">
          <span>{progress || t('正在处理…', 'Processing…')}</span>
          <button type="button" onClick={() => task.current?.abort()}>
            {t('取消', 'Cancel')}
          </button>
        </div>
      )}
      {error && (
        <div className="pdf-error" role="alert">
          {error}
        </div>
      )}
      {placement && (
        <div className="pdf-task pdf-placement-status" role="status">
          <span>
            {editKindName(placement.kind, t)} ·{' '}
            {placement.kind === 'ink'
              ? t('在页面上拖动绘制', 'Drag to draw on a page')
              : t(
                  '单击放置或拖动选择区域',
                  'Click to place or drag to set the area'
                )}
          </span>
          <button type="button" onClick={() => setPlacement(null)}>
            {t('取消', 'Cancel')}
          </button>
        </div>
      )}
      <div
        className={`pdf-workbench-layout ${showPages ? 'has-organizer' : ''} ${rightPanel ? 'has-panel' : ''} ${thumbnailTray ? 'has-thumbnail-tray' : ''}`}
        style={
          sidebarWidth
            ? ({ '--pdf-sidebar-size': `${sidebarWidth}px` } as CSSProperties)
            : undefined
        }
      >
        {compact && drawer && (
          <button
            type="button"
            className="pdf-panel-backdrop"
            aria-label={t('关闭面板', 'Close panel')}
            onClick={() => setDrawer(null)}
          />
        )}
        <aside
          className={`pdf-editor ${thumbnailTray ? 'is-thumbnail-tray' : ''}`}
          ref={organizer}
          id="pdf-arrange-panel"
          aria-label={
            thumbnailTray
              ? t('页面缩略图', 'Page thumbnails')
              : t('页面整理', 'Page organizer')
          }
          hidden={!showPages}
        >
          <div className="pdf-editor-toolbar" hidden={thumbnailTray}>
            <div
              className="pdf-mode"
              role="group"
              aria-label={t('整理方式', 'Arrange by')}
            >
              <button
                type="button"
                aria-pressed={mode === 'files'}
                onClick={() => {
                  setMode('files');
                  setWindowIndex(0);
                }}
              >
                {t('文件', 'Files')} <span>{sources.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={mode === 'pages'}
                onClick={() => {
                  setMode('pages');
                  setWindowIndex(0);
                }}
              >
                {t('页面', 'Pages')} <span>{pages.length}</span>
              </button>
            </div>
            {compact && (
              <button
                type="button"
                className="pdf-icon-button"
                aria-label={t('关闭页面栏', 'Close page organizer')}
                onClick={() => setDrawer(null)}
              >
                <Glyph name="close" size={21} />
              </button>
            )}
          </div>
          <fieldset className="pdf-editing" disabled={!!busy}>
            {organizerMode === 'files' ? (
              <>
                {!!sources.length && (
                  <p className="pdf-help">
                    {t(
                      '调整文件顺序会按来源重新排列页面。',
                      'Reordering files groups pages by source.'
                    )}
                  </p>
                )}
                <div className="pdf-file-list">
                  {sources
                    .slice(offset, offset + pageSize)
                    .map((source, localIndex) => {
                      const index = offset + localIndex,
                        included = pages.filter(
                          (page) => page.sourceId === source.id
                        ).length;
                      return (
                        <article
                          className="pdf-source"
                          key={source.id}
                          draggable={!busy}
                          onDragStart={(event) => {
                            sourceDrag.current = source.id;
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', source.id);
                          }}
                          onDragEnd={() => {
                            sourceDrag.current = null;
                          }}
                          onDragOver={(event) => {
                            if (sourceDrag.current) event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (sourceDrag.current)
                              reorderFiles(sourceDrag.current, index);
                            sourceDrag.current = null;
                          }}
                        >
                          <button
                            type="button"
                            className="pdf-source-thumb"
                            aria-label={`${t('预览', 'Preview')} ${source.name}`}
                            onClick={() => {
                              const first = pages.find(
                                (page) => page.sourceId === source.id
                              );
                              if (first) showPage(first.id);
                              else
                                setPreview({
                                  source,
                                  pageIndex: 0,
                                  rotation: 0
                                });
                            }}
                          >
                            {thumbnail(source)}
                          </button>
                          <div className="pdf-source-info">
                            <strong title={source.name}>{source.name}</strong>
                            <span>
                              {source.pageCount} {t('页', 'pages')} ·{' '}
                              {sizeLabel(source.file.size)}
                            </span>
                            {included !== source.pageCount && (
                              <span>
                                {t('已选入', 'Included')}: {included}{' '}
                                {t('页', 'pages')}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPreview({
                                  source,
                                  pageIndex: 0,
                                  rotation: 0
                                })
                              }
                            >
                              {t('预览全部页面', 'Preview all pages')}
                            </button>
                          </div>
                          <div className="pdf-source-actions">
                            <button
                              type="button"
                              aria-label={`${t('上移', 'Move up')} ${source.name}`}
                              disabled={!index}
                              onClick={() => reorderFiles(source.id, index - 1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label={`${t('下移', 'Move down')} ${source.name}`}
                              disabled={index + 1 === sources.length}
                              onClick={() => reorderFiles(source.id, index + 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              aria-label={`${t('移除', 'Remove')} ${source.name}`}
                              onClick={() => {
                                commit({
                                  sources: sources.filter(
                                    (item) => item.id !== source.id
                                  ),
                                  pages: pages.filter(
                                    (page) => page.sourceId !== source.id
                                  )
                                });
                              }}
                            >
                              {t('移除', 'Remove')}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </>
            ) : (
              <>
                <div className="pdf-page-controls" hidden={thumbnailTray}>
                  <div className="pdf-page-toolbar">
                    {preset === 'rotate' && (
                      <div className="pdf-rotation-controls">
                        <label>
                          {t('旋转到', 'Rotate to')}{' '}
                          <select
                            value={rotationAngle}
                            onChange={(event) =>
                              setRotationAngle(Number(event.target.value))
                            }
                          >
                            {[90, 180, 270].map((angle) => (
                              <option key={angle} value={angle}>
                                {angle}°
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={!pages.length}
                          onClick={applyRotation}
                        >
                          {selectedIds.size
                            ? t('应用到选中页', 'Apply to selected pages')
                            : t('应用到全部页', 'Apply to all pages')}
                        </button>
                      </div>
                    )}
                    <div className="pdf-page-commands">
                      {!!pages.length && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelected(
                              selectedIds.size === pages.length
                                ? new Set()
                                : new Set(pages.map((page) => page.id))
                            )
                          }
                        >
                          {selectedIds.size === pages.length
                            ? t('取消选择', 'Deselect')
                            : t('全选', 'Select all')}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t('插入 A4 空白页', 'Insert blank A4 page')}
                        title={t('插入 A4 空白页', 'Insert blank A4 page')}
                        onClick={() => insertBlank(selectedIds)}
                      >
                        <Glyph name="add" size={15} />
                        {t('空白页', 'Blank page')}
                      </button>
                    </div>
                  </div>
                  {!!selectedIds.size && (
                    <section
                      className="pdf-page-selection"
                      aria-label={t('选中页面的操作', 'Selected page actions')}
                    >
                      <div className="pdf-page-selection-heading">
                        <span role="status">
                          {t(
                            `已选 ${selectedIds.size} 页`,
                            `${selectedIds.size} selected`
                          )}
                        </span>
                        {selectedIds.size < pages.length && (
                          <button
                            type="button"
                            onClick={() => setSelected(new Set())}
                          >
                            {t('取消选择', 'Deselect')}
                          </button>
                        )}
                      </div>
                      <div className="pdf-page-selection-actions">
                        <button
                          type="button"
                          onClick={() =>
                            editPages(movePages(pages, selectedIds, -1))
                          }
                        >
                          {t('前移', 'Move earlier')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            editPages(movePages(pages, selectedIds, 1))
                          }
                        >
                          {t('后移', 'Move later')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            editPages(rotatePages(pages, selectedIds))
                          }
                        >
                          {t('旋转 90°', 'Rotate 90°')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            editPages(duplicatePages(pages, selectedIds))
                          }
                        >
                          {t('复制页面', 'Duplicate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSelection(selectedIds)}
                        >
                          {t('导出所选', 'Export selection')}
                        </button>
                        <button
                          type="button"
                          className="pdf-danger"
                          onClick={() => removePages(selectedIds)}
                        >
                          {t('删除页面', 'Delete pages')}
                        </button>
                      </div>
                      <details className="pdf-disclosure">
                        <summary>{t('移到指定页', 'Move to a page')}</summary>
                        <div className="pdf-move-to">
                          <label>
                            {t('移动到第', 'Move before page')}{' '}
                            <input
                              type="number"
                              min={1}
                              max={pages.length}
                              value={moveTo}
                              onChange={(event) =>
                                setMoveTo(Number(event.target.value))
                              }
                            />
                            {t('页前', '')}
                          </label>
                          <button
                            type="button"
                            disabled={
                              !Number.isInteger(moveTo) ||
                              moveTo < 1 ||
                              moveTo > pages.length
                            }
                            onClick={() =>
                              reorderPages(selectedIds, pages[moveTo - 1].id)
                            }
                          >
                            {t('移动', 'Move')}
                          </button>
                        </div>
                      </details>
                    </section>
                  )}
                </div>
                <PdfPageGrid
                  pages={pages.slice(offset, offset + pageSize)}
                  sources={sources}
                  offset={offset}
                  selected={selectedIds}
                  currentPage={currentPage}
                  previewOnly={thumbnailTray}
                  busy={Boolean(busy)}
                  thumbnail={thumbnail}
                  onSelect={toggle}
                  onPreview={showPage}
                  onMove={reorderPages}
                  onOpenMenu={setPageMenu}
                  t={t}
                />
              </>
            )}
          </fieldset>
          {!items && (
            <p className="pdf-empty">
              {mode === 'pages'
                ? t('暂无页面', 'No pages')
                : t('暂无文件', 'No files')}
            </p>
          )}
          {!thumbnailTray && items > pageSize && (
            <nav
              className="pdf-pagination"
              aria-label={t('工作区分页', 'Workspace pagination')}
            >
              <button
                type="button"
                disabled={!currentWindow}
                onClick={() => setWindowIndex(currentWindow - 1)}
              >
                {t('上一组', 'Previous')}
              </button>
              <span>
                {offset + 1}–{Math.min(offset + pageSize, items)} / {items}
              </span>
              <button
                type="button"
                disabled={currentWindow >= lastWindow}
                onClick={() => setWindowIndex(currentWindow + 1)}
              >
                {t('下一组', 'Next')}
              </button>
            </nav>
          )}
          {thumbnailTray && (
            <button
              type="button"
              className="pdf-icon-button pdf-thumbnail-tray-close"
              aria-label={t('隐藏缩略图', 'Hide thumbnails')}
              title={t('隐藏缩略图', 'Hide thumbnails')}
              onClick={() => {
                setPagesOpen(false);
                organizerToggle.current?.focus({ preventScroll: true });
              }}
            >
              <Glyph name="close" size={16} />
            </button>
          )}
        </aside>
        {showPages && !compact && (
          <PdfSidebarResize
            sidebar={organizer}
            hasPanel={!!rightPanel}
            onResize={setSidebarWidth}
            t={t}
          />
        )}
        <PdfReader
          pages={pages}
          sources={sources}
          target={readerTarget}
          onPageChange={setCurrentPage}
          onOpen={openFiles}
          busy={Boolean(busy)}
          renderEdits={(page, angle) =>
            page.edits?.length || placement ? (
              <PdfEditLayer
                edits={page.edits ?? []}
                angle={angle}
                placement={busy ? null : placement}
                selected={
                  selectedMark?.pageId === page.id
                    ? selectedMark.editId
                    : undefined
                }
                onSelect={(edit) => selectMark(page.id, edit)}
                onPlace={(geometry) => placeMark(page.id, geometry)}
                t={t}
              />
            ) : null
          }
          t={t}
        />
        {(rightPanel === 'annotation' || rightPanel === 'form') &&
          (() => {
            const form = rightPanel === 'form';
            const page =
              currentEdit &&
              selectedPage &&
              isFormEdit(currentEdit.kind) === form
                ? selectedPage
                : activePage;
            return (
              <PdfEditPanel
                mode={rightPanel}
                currentPage={page ? pages.indexOf(page) + 1 : 0}
                compact={compact}
                busy={Boolean(busy)}
                edits={(page?.edits ?? []).filter(
                  (edit) => isFormEdit(edit.kind) === form
                )}
                selected={
                  currentEdit && isFormEdit(currentEdit.kind) === form
                    ? currentEdit
                    : undefined
                }
                onClose={() => {
                  setPlacement(null);
                  openPanel(null);
                }}
                onPlace={(kind, edit) => {
                  setPlacement({
                    kind,
                    edit,
                    pageId: edit ? selectedPage?.id : undefined
                  });
                  if (compact) setDrawer(null);
                }}
                onSelect={(edit) => page && selectMark(page.id, edit)}
                onSave={changeMark}
                onDelete={(edit) => changeMark(edit, true)}
                onAdvanced={() => void openAdvanced()}
                t={t}
              />
            );
          })()}
        {rightPanel === 'images' && (
          <PdfImageImport
            busy={Boolean(busy)}
            onClose={() => openPanel(null)}
            onImport={(files, options) => void importImages(files, options)}
            t={t}
          />
        )}
        <aside
          className="pdf-output"
          id="pdf-export-panel"
          aria-labelledby="pdf-output-title"
          hidden={!showExport}
        >
          <div className="pdf-output-heading">
            <h3 id="pdf-output-title">{outputTitle}</h3>
            <button
              type="button"
              className="pdf-icon-button"
              aria-label={t('关闭导出栏', 'Close export panel')}
              onClick={() => openPanel(null)}
            >
              <Glyph name="close" size={compact ? 21 : 17} />
            </button>
          </div>
          {merging && (
            <div className="pdf-output-selection">
              <span>
                {t(
                  `已添加 ${sources.length} 个文件`,
                  `${sources.length} files added`
                )}
              </span>
              <button
                type="button"
                disabled={!!busy || !sources.length}
                onClick={() => showOrganizer('files')}
              >
                {t('调整文件顺序', 'Arrange source files')}
              </button>
            </div>
          )}
          {exportMode !== 'split' && (
            <label className="pdf-output-name">
              {t('导出范围', 'Export scope')}
              <select
                value={exportMode}
                disabled={!!busy}
                onChange={(event) => {
                  setExportMode(event.target.value as OutputScope);
                  setResult(null);
                }}
              >
                <option value="all">{t('全部页面', 'All pages')}</option>
                <option value="selection">
                  {t('选中页面', 'Selected pages')}
                </option>
                {output.kind === 'png' && (
                  <option value="png-range">
                    {t('指定页码', 'Specific pages')}
                  </option>
                )}
              </select>
            </label>
          )}
          {exportMode === 'selection' && (
            <div className="pdf-output-selection">
              {!selectedIds.size && (
                <span>{t('尚未选择页面', 'No pages selected')}</span>
              )}
              <button
                type="button"
                disabled={!!busy || !pages.length}
                onClick={() => showOrganizer('pages')}
              >
                {selectedIds.size
                  ? t('调整选中页', 'Change selected pages')
                  : t('选择页面', 'Select pages')}
              </button>
            </div>
          )}
          {exportMode === 'split' && (
            <label className="pdf-output-name">
              {t('拆分范围（按当前页序）', 'Ranges in current page order')}
              <input
                type="text"
                value={ranges}
                placeholder="1-3, 4-6"
                disabled={!!busy}
                aria-invalid={invalidRanges}
                onChange={(event) => {
                  setRanges(event.target.value);
                  setResult(null);
                }}
              />
            </label>
          )}
          {invalidRanges && (
            <p role="alert" className="pdf-form-note">
              {t(
                '请输入有效的页码范围，例如 1-3, 4-6。',
                'Enter valid page ranges, for example 1-3, 4-6.'
              )}
            </p>
          )}
          <PdfExportOptions
            settings={output}
            showPngRanges={showPngRanges}
            onChange={changeOutput}
            busy={Boolean(busy)}
            t={t}
          />
          {invalidPngRange && (
            <p className="pdf-form-note" role="alert">
              {t(
                '请输入当前输出页序中的有效页码。',
                'Enter valid page numbers for the current output.'
              )}
            </p>
          )}
          <label className="pdf-output-name">
            {t('输出文件名', 'Output filename')}
            <input
              type="text"
              value={filename}
              disabled={!!busy}
              onChange={(event) => {
                setFilename(event.target.value);
                setResult(null);
              }}
            />
          </label>
          {pdfOutput && (
            <details className="pdf-disclosure pdf-output-options">
              <summary>
                {t('更多设置', 'More settings')}
                {useBookmarks && (
                  <span> · {t('书签已开启', 'Bookmarks enabled')}</span>
                )}
              </summary>
              <label className="pdf-bookmarks">
                <input
                  type="checkbox"
                  checked={bookmarks}
                  disabled={!!busy}
                  onChange={(event) => {
                    setBookmarks(event.target.checked);
                    setResult(null);
                  }}
                />
                <span>
                  {t('按来源文件创建书签', 'Create bookmarks by source file')}
                </span>
              </label>
              {useBookmarks && (
                <p className="pdf-help">
                  {t(
                    '新书签指向各来源的首个输出页；原 PDF 的目录不会保留。',
                    'New bookmarks point to each source’s first output page. Original outlines are not retained.'
                  )}
                </p>
              )}
            </details>
          )}
          {pdfOutput && outputHasForms && (
            <p className="pdf-form-note">
              {t(
                '跨文档复制会固定来源表单的外观。工作台新建的字段仍可填写。',
                'Copied pages preserve the appearance of source forms. Fields added in this workspace stay editable.'
              )}
            </p>
          )}
          <div className="pdf-export-footer">
            <p className="pdf-export-count" role="status">
              {t(`共 ${outputPageCount} 页`, `${outputPageCount} pages total`)}
            </p>
            <button
              type="button"
              className="pdf-primary pdf-export"
              data-testid="process-tool"
              disabled={!canExport || !!busy}
              onClick={() => void exportPdf()}
            >
              {busy === 'export' ? t('生成中…', 'Generating…') : outputAction}
            </button>
          </div>
          <div className="flow-result pdf-result" aria-live="polite">
            {result && (
              <p>
                {result.file.name} · {sizeLabel(result.file.size)}
              </p>
            )}
            {result?.originalSize !== undefined && (
              <p>
                {result.file.size < result.originalSize
                  ? `${sizeLabel(result.originalSize)} → ${sizeLabel(result.file.size)}`
                  : t(
                      '当前文件已较紧凑，保留同等大小的副本。',
                      'The document is already compact. The copy is the same size.'
                    )}
              </p>
            )}
            <button
              type="button"
              disabled={!result || !!busy}
              onClick={() => result && downloadFile(result.file)}
            >
              {result?.file.type === 'application/zip' ||
              (!result && output.kind === 'png')
                ? t('下载 ZIP', 'Download ZIP')
                : output.kind === 'epub'
                  ? t('下载 EPUB', 'Download EPUB')
                  : result?.file.type === 'image/png'
                    ? t('下载 PNG', 'Download PNG')
                    : t('下载 PDF', 'Download PDF')}
            </button>
            {result?.items?.length && <PdfResultItems result={result} t={t} />}
          </div>
        </aside>
      </div>
      {pageMenu &&
        showPages &&
        organizerMode === 'pages' &&
        !busy &&
        (() => {
          const number = pages.findIndex((page) => page.id === pageMenu.id) + 1;
          if (!number) return null;
          const ids = selectedIds.has(pageMenu.id)
            ? selectedIds
            : new Set([pageMenu.id]);
          const canMove = (direction: -1 | 1) =>
            pages.some((page, index) => {
              const neighbor = pages[index + direction];
              return ids.has(page.id) && neighbor && !ids.has(neighbor.id);
            });
          return (
            <PdfPageMenu
              anchor={pageMenu}
              label={t(`第 ${number} 页操作`, `Page ${number} actions`)}
              onClose={() => setPageMenu(null)}
              actions={[
                {
                  label: t('预览此页', 'Preview this page'),
                  icon: 'search',
                  run: () => showPage(pageMenu.id)
                },
                {
                  label: t('前移', 'Move earlier'),
                  icon: 'chevron-up',
                  disabled: !canMove(-1),
                  run: () => editPages(movePages(pages, ids, -1))
                },
                {
                  label: t('后移', 'Move later'),
                  icon: 'chevron-down',
                  disabled: !canMove(1),
                  run: () => editPages(movePages(pages, ids, 1))
                },
                {
                  label: t('旋转 90°', 'Rotate 90°'),
                  icon: 'redo',
                  run: () => editPages(rotatePages(pages, ids))
                },
                {
                  label: t('复制页面', 'Duplicate'),
                  icon: 'copy',
                  run: () => editPages(duplicatePages(pages, ids))
                },
                {
                  label: t('插入空白页', 'Insert blank page'),
                  icon: 'add',
                  run: () => insertBlank(ids)
                },
                {
                  label:
                    ids.size > 1
                      ? t('导出所选', 'Export selection')
                      : t('导出此页', 'Export this page'),
                  icon: 'download',
                  run: () => exportSelection(ids)
                },
                {
                  label: t('删除页面', 'Delete pages'),
                  icon: 'trash',
                  danger: true,
                  run: () => removePages(ids)
                }
              ]}
            />
          );
        })()}
      {preview && (
        <PreviewDialog
          preview={preview}
          english={english}
          close={() => setPreview(null)}
          change={setPreview}
        />
      )}
      {encryptedFiles[0] && (
        <PdfPasswordPrompt
          key={`${encryptedFiles[0].name}-${encryptedFiles.length}`}
          file={encryptedFiles[0]}
          busy={Boolean(busy)}
          error={passwordError}
          onUnlock={(password) => void unlockFile(password)}
          onClose={dismissPassword}
          t={t}
        />
      )}
      {advancedFile && (
        <Suspense
          fallback={
            <p className="pdf-task" role="status">
              {t('正在加载高级编辑器…', 'Loading the advanced editor…')}
            </p>
          }
        >
          <PdfAdvancedEditor
            file={advancedFile}
            onApply={applyAdvanced}
            onClose={() => setAdvancedFile(null)}
            t={t}
          />
        </Suspense>
      )}
    </section>
  );
}
