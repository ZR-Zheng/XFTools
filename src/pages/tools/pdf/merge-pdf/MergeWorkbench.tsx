import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import type { ToolComponentProps } from '@tools/defineTool';
import { useWorkbenchText } from 'i18n/workbench';
import {
  duplicatePages,
  groupBySources,
  movePages,
  movePagesBefore,
  rotatePages,
  sourcePages
} from '../shared/page-plan';
import type {
  PdfAsset,
  PdfPageInstance,
  PdfWorkspace
} from '../shared/page-plan';
import { exportPagePlan } from '../shared/export-page-plan';
import './pdf-workbench.css';

const PdfCanvas = lazy(() => import('../shared/PdfCanvas'));
const empty = (): PdfWorkspace => ({ sources: [], pages: [] });
const sizeLabel = (bytes: number) =>
  bytes < 1048576
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
type Preview = { source: PdfAsset; pageIndex: number; rotation: number };

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

export default function MergeWorkbench({ title }: ToolComponentProps) {
  const { english } = useWorkbenchText();
  const t = (zh: string, en: string) => (english ? en : zh);
  const [workspace, setWorkspace] = useState<PdfWorkspace>(empty);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'files' | 'pages'>('files');
  const [windowIndex, setWindowIndex] = useState(0);
  const [filename, setFilename] = useState('merged.pdf');
  const [bookmarks, setBookmarks] = useState(true);
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'import' | 'export' | null>(null);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [moveTo, setMoveTo] = useState(1);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selectionAnchor = useRef<string | null>(null);
  const assets = useRef(new Map<string, PdfAsset>());
  const past = useRef<PdfWorkspace[]>([]),
    future = useRef<PdfWorkspace[]>([]);
  const task = useRef<AbortController | null>(null);
  const drop = useRef<{ kind: 'file' | 'page'; ids: Set<string> } | null>(null);
  const { sources, pages } = workspace;
  const commit = (next: PdfWorkspace) => {
    past.current = [...past.current.slice(-39), workspace];
    future.current = [];
    setWorkspace(next);
    setResult(null);
    setError('');
  };
  const editPages = (next: PdfPageInstance[]) =>
    commit({ ...workspace, pages: next });
  const history = (undo: boolean) => {
    const from = undo ? past : future,
      to = undo ? future : past;
    const next = from.current.pop();
    if (!next) return;
    to.current.push(workspace);
    setWorkspace(next);
    setSelected(new Set());
    setResult(null);
    setError('');
  };
  useEffect(
    () => () => {
      task.current?.abort();
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
  const pageSize = mode === 'files' ? 12 : 24;
  const items = mode === 'files' ? sources.length : pages.length;
  const lastWindow = Math.max(0, Math.ceil(items / pageSize) - 1);
  const currentWindow = Math.min(windowIndex, lastWindow);
  const offset = currentWindow * pageSize;
  const selectedIds = new Set(
    pages.filter((page) => selected.has(page.id)).map((page) => page.id)
  );

  const addFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy('import');
    setError('');
    setResult(null);
    const added: PdfAsset[] = [],
      errors: string[] = [];
    for (const [index, file] of files.entries()) {
      if (controller.signal.aborted) break;
      setProgress(
        `${t('读取文件', 'Reading files')} ${index + 1} / ${files.length}`
      );
      try {
        const document = await PDFDocument.load(await file.arrayBuffer());
        controller.signal.throwIfAborted();
        if (!document.getPageCount())
          throw new Error(t('文件没有页面', 'No pages in this PDF'));
        const source: PdfAsset = {
          id: crypto.randomUUID(),
          name: file.name,
          file,
          document,
          pageCount: document.getPageCount(),
          hasForms: document.getForm().getFields().length > 0,
          sizes: document.getPages().map((page) => ({
            ...page.getSize(),
            rotation: page.getRotation().angle
          }))
        };
        assets.current.set(source.id, source);
        added.push(source);
      } catch (error) {
        if (!controller.signal.aborted)
          errors.push(
            `${file.name}: ${t('无法读取，请检查文件是否损坏或受密码保护。', 'Cannot read this PDF. Check for corruption or password protection.')} ${error instanceof Error ? error.message : ''}`
          );
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (added.length)
      commit({
        sources: [...sources, ...added],
        pages: [
          ...pages,
          ...added.flatMap((source) => sourcePages(source.id, source.pageCount))
        ]
      });
    setError(errors.join('\n'));
    setProgress('');
    setBusy(null);
    task.current = null;
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
  const removeSelected = () => {
    editPages(pages.filter((page) => !selectedIds.has(page.id)));
    setSelected(new Set());
  };
  const exportPdf = async () => {
    if (!pages.length || busy) return;
    const controller = new AbortController();
    task.current = controller;
    setBusy('export');
    setResult(null);
    setError('');
    try {
      const file = await exportPagePlan(sources, pages, {
        filename,
        bookmarks,
        signal: controller.signal,
        onProgress: (done, total) =>
          setProgress(`${t('合并页面', 'Merging pages')} ${done} / ${total}`)
      });
      setResult(file);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          `${t('合并失败', 'Merge failed')}: ${error instanceof Error ? error.message : String(error)}`
        );
    } finally {
      setBusy(null);
      setProgress('');
      task.current = null;
    }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(result),
      link = document.createElement('a');
    link.href = url;
    link.download = result.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const thumbnail = (source: PdfAsset, pageIndex = 0, rotation = 0) => (
    <Suspense fallback={<span className="pdf-loading">PDF…</span>}>
      <PdfCanvas source={source} pageIndex={pageIndex} rotation={rotation} />
    </Suspense>
  );
  return (
    <section className="pdf-workbench" aria-label={title}>
      <div className="pdf-workbench-layout">
        <div className="pdf-editor">
          <div
            className={`pdf-import ${dragging ? 'is-over' : ''}`}
            onDragOver={(event) => {
              if (!busy && event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy) void addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <div>
              <strong>
                {sources.length
                  ? t('继续添加 PDF', 'Add more PDFs')
                  : t('将 PDF 拖放到这里', 'Drop PDFs here')}
              </strong>
              <span>
                {t(
                  '支持多个文件；同名文件也会独立保留',
                  'Multiple files supported, including files with the same name'
                )}
              </span>
            </div>
            <input
              ref={input}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              aria-label={t('选择 PDF 文件', 'Choose PDF files')}
              className="pdf-file-input"
              disabled={!!busy}
              onChange={(event) => {
                void addFiles(Array.from(event.target.files || []));
                event.target.value = '';
              }}
            />
            <button
              type="button"
              className="pdf-primary"
              disabled={!!busy}
              onClick={() => input.current?.click()}
            >
              {t('选择文件', 'Choose files')}
            </button>
          </div>
          <div className="pdf-editor-toolbar">
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
            <div className="pdf-history">
              <button
                type="button"
                disabled={!!busy || !past.current.length}
                onClick={() => history(true)}
              >
                {t('撤销', 'Undo')}
              </button>
              <button
                type="button"
                disabled={!!busy || !future.current.length}
                onClick={() => history(false)}
              >
                {t('重做', 'Redo')}
              </button>
              <button
                type="button"
                disabled={!!busy || (!sources.length && !pages.length)}
                onClick={clear}
              >
                {t('清空', 'Clear')}
              </button>
            </div>
          </div>
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
          <fieldset className="pdf-editing" disabled={!!busy}>
            {mode === 'files' ? (
              <>
                {!!sources.length && (
                  <p className="pdf-help">
                    {t(
                      '拖动文件或使用上移／下移按钮排序；需要交叉编排时切换到「页面」。文件排序会将同一来源的页面重新分组。',
                      'Drag files or use the move buttons. Switch to Pages to interleave pages; sorting files groups pages by source again.'
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
                            drop.current = {
                              kind: 'file',
                              ids: new Set([source.id])
                            };
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', source.id);
                          }}
                          onDragEnd={() => {
                            drop.current = null;
                          }}
                          onDragOver={(event) => {
                            if (drop.current?.kind === 'file')
                              event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (drop.current?.kind === 'file')
                              reorderFiles([...drop.current.ids][0], index);
                            drop.current = null;
                          }}
                        >
                          <span className="pdf-source-number">{index + 1}</span>
                          <button
                            type="button"
                            className="pdf-source-thumb"
                            aria-label={`${t('预览', 'Preview')} ${source.name}`}
                            onClick={() =>
                              setPreview({ source, pageIndex: 0, rotation: 0 })
                            }
                          >
                            {thumbnail(source)}
                          </button>
                          <div className="pdf-source-info">
                            <strong title={source.name}>{source.name}</strong>
                            <span>
                              {source.pageCount} {t('页', 'pages')} ·{' '}
                              {sizeLabel(source.file.size)}
                            </span>
                            <span>
                              {t('已选入', 'Included')}: {included}{' '}
                              {t('页', 'pages')}
                            </span>
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
                <div className="pdf-page-toolbar">
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(new Set(pages.map((page) => page.id)))
                      }
                      disabled={!pages.length}
                    >
                      {t('全选', 'Select all')}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedIds.size}
                      onClick={() => setSelected(new Set())}
                    >
                      {t('取消选择', 'Deselect')}
                    </button>
                    <span role="status">
                      {t('已选', 'Selected')} {selectedIds.size} /{' '}
                      {pages.length}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={!selectedIds.size}
                      onClick={() =>
                        editPages(movePages(pages, selectedIds, -1))
                      }
                    >
                      {t('前移', 'Move earlier')}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedIds.size}
                      onClick={() =>
                        editPages(movePages(pages, selectedIds, 1))
                      }
                    >
                      {t('后移', 'Move later')}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedIds.size}
                      onClick={() => editPages(rotatePages(pages, selectedIds))}
                    >
                      {t('旋转 90°', 'Rotate 90°')}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedIds.size}
                      onClick={() =>
                        editPages(duplicatePages(pages, selectedIds))
                      }
                    >
                      {t('复制页面', 'Duplicate')}
                    </button>
                    <button
                      type="button"
                      className="pdf-danger"
                      disabled={!selectedIds.size}
                      onClick={removeSelected}
                    >
                      {t('删除页面', 'Delete pages')}
                    </button>
                  </div>
                  <div>
                    <label>
                      {t('移动到第', 'Move to page')}{' '}
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, pages.length)}
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
                        !selectedIds.size ||
                        !Number.isInteger(moveTo) ||
                        moveTo < 1 ||
                        moveTo > pages.length
                      }
                      onClick={() =>
                        editPages(
                          movePagesBefore(
                            pages,
                            selectedIds,
                            pages[moveTo - 1].id
                          )
                        )
                      }
                    >
                      {t('移动', 'Move')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blank: PdfPageInstance = {
                          id: crypto.randomUUID(),
                          sourceId: null,
                          pageIndex: 0,
                          rotation: 0,
                          blankSize: { width: 595.28, height: 841.89 }
                        };
                        const index = pages.findLastIndex((page) =>
                          selectedIds.has(page.id)
                        );
                        editPages([
                          ...pages.slice(
                            0,
                            index < 0 ? pages.length : index + 1
                          ),
                          blank,
                          ...pages.slice(index < 0 ? pages.length : index + 1)
                        ]);
                      }}
                    >
                      {t('插入 A4 空白页', 'Insert blank A4 page')}
                    </button>
                  </div>
                </div>
                {!!pages.length && (
                  <p className="pdf-help">
                    {t(
                      '勾选后批量操作；可拖动选中页面到目标页前，也可用「移动到第…页前」跨屏排序。',
                      'Select pages for batch actions. Drag them before another page, or use Move to page to move across screens.'
                    )}
                  </p>
                )}
                <div className="pdf-page-grid">
                  {pages
                    .slice(offset, offset + pageSize)
                    .map((page, localIndex) => {
                      const source = sources.find(
                        (source) => source.id === page.sourceId
                      );
                      return (
                        <article
                          key={page.id}
                          data-page-id={page.id}
                          className={`pdf-page ${selectedIds.has(page.id) ? 'is-selected' : ''}`}
                          draggable={!busy}
                          onDragStart={(event) => {
                            const ids = selectedIds.has(page.id)
                              ? selectedIds
                              : new Set([page.id]);
                            setSelected(ids);
                            drop.current = { kind: 'page', ids };
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', page.id);
                          }}
                          onDragEnd={() => {
                            drop.current = null;
                          }}
                          onDragOver={(event) => {
                            if (drop.current?.kind === 'page')
                              event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (drop.current?.kind === 'page')
                              editPages(
                                movePagesBefore(
                                  pages,
                                  drop.current.ids,
                                  page.id
                                )
                              );
                            drop.current = null;
                          }}
                        >
                          <label className="pdf-page-select">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(page.id)}
                              onChange={(event) =>
                                toggle(
                                  page.id,
                                  (event.nativeEvent as MouseEvent).shiftKey
                                )
                              }
                              aria-label={`${t('选择第', 'Select output page')} ${offset + localIndex + 1} ${t('页', '')}`}
                            />
                            <span>{offset + localIndex + 1}</span>
                          </label>
                          <button
                            type="button"
                            className="pdf-page-thumb"
                            disabled={!source}
                            onClick={() =>
                              source &&
                              setPreview({
                                source,
                                pageIndex: page.pageIndex,
                                rotation: page.rotation
                              })
                            }
                            aria-label={`${t('预览输出第', 'Preview output page')} ${offset + localIndex + 1} ${t('页', '')}`}
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
                          <div className="pdf-page-caption">
                            <strong title={source?.name}>
                              {source?.name || t('空白页', 'Blank page')}
                            </strong>
                            <span>
                              {source
                                ? `${t('原第', 'Source page')} ${page.pageIndex + 1} ${t('页', '')}`
                                : 'A4'}
                              {page.rotation ? ` · +${page.rotation}°` : ''}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </>
            )}
          </fieldset>
          {!items && (
            <div className="pdf-empty">
              <span aria-hidden="true">▤</span>
              <strong>
                {mode === 'pages' && sources.length
                  ? t('还没有选入页面', 'No pages included')
                  : t('从添加 PDF 开始', 'Start by adding PDFs')}
              </strong>
              <p>
                {t(
                  '预览内容、调整顺序，确认后再合并下载。',
                  'Preview and arrange your pages before merging.'
                )}
              </p>
            </div>
          )}
          {items > pageSize && (
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
        </div>
        <aside className="pdf-output">
          <h3>{t('合并设置', 'Merge settings')}</h3>
          <div className="pdf-totals">
            <strong>
              {pages.length}
              <small>{t('输出页', 'pages')}</small>
            </strong>
            <span>
              {sources.length} {t('个来源文件', 'source files')}
            </span>
          </div>
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
          <p className="pdf-help">
            {t(
              '新书签指向各来源的首个输出页；原 PDF 的目录不会保留。',
              'New bookmarks point to each source’s first output page. Original outlines are not retained.'
            )}
          </p>
          {sources.some((source) => source.hasForms) && (
            <p className="pdf-form-note">
              {t(
                '检测到表单：合并会将当前填写内容固定到页面，输出表单不可继续编辑。数字签名不会保留效力。',
                'Forms detected: current appearances will be flattened. Output fields are not editable; digital signatures are not preserved.'
              )}
            </p>
          )}
          <button
            type="button"
            className="pdf-primary pdf-export"
            data-testid="process-tool"
            disabled={!pages.length || !!busy}
            onClick={() => void exportPdf()}
          >
            {busy === 'export'
              ? t('合并中…', 'Merging…')
              : t('合并 PDF', 'Merge PDFs')}
          </button>
          <div className="flow-result pdf-result" aria-live="polite">
            <strong>
              {result
                ? t('合并完成', 'PDF ready')
                : t('待生成', 'Ready when you are')}
            </strong>
            <p>
              {result
                ? `${result.name} · ${sizeLabel(result.size)}`
                : t(
                    '整理完成后，点击合并生成文件。',
                    'Arrange your pages, then merge to generate your file.'
                  )}
            </p>
            <button
              type="button"
              disabled={!result || !!busy}
              onClick={download}
            >
              {t('下载 PDF', 'Download PDF')}
            </button>
          </div>
        </aside>
      </div>
      {preview && (
        <PreviewDialog
          preview={preview}
          english={english}
          close={() => setPreview(null)}
          change={setPreview}
        />
      )}
    </section>
  );
}
