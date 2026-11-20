import { useEffect, useRef, useState, type ReactNode } from 'react';
import useFileDrop from 'hooks/useFileDrop';
import useObjectUrl from 'hooks/useObjectUrl';
import { getImageDimensions } from '@utils/image';
import { downloadFile } from '@utils/file';
import Glyph from './Glyph';
import './image-batch-workbench.css';

const acceptedImages = ['image/*', '.heic', '.heif'];

interface Source {
  id: number;
  name: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

export interface ImageBatchOutput {
  file: File;
  detail?: string;
  dimensions?: { width: number; height: number };
}

type ProcessImage = (file: File) => Promise<ImageBatchOutput>;
type Outcome = ImageBatchOutput | { error: string };

interface Report {
  sources: Source[];
  process: ProcessImage;
  outcomes: Map<number, Outcome>;
  archive: File | null;
  archiveError: boolean;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function createArchive(files: File[], name: string) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const file of files) {
    const base = file.name.replace(/\.[^.]+$/, '');
    const extension = file.name.slice(base.length);
    let filename = file.name;
    let suffix = 2;
    while (usedNames.has(filename.toLowerCase())) {
      filename = base + '-' + suffix++ + extension;
    }
    usedNames.add(filename.toLowerCase());
    zip.file(filename, new Uint8Array(await file.arrayBuffer()));
  }
  return new File([await zip.generateAsync({ type: 'blob' })], name, {
    type: 'application/zip'
  });
}

function ResultPreview({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return url ? <img src={url} alt="处理结果" /> : null;
}

interface Props {
  settings: ReactNode;
  settingsTitle: string;
  importHint: string;
  action: string;
  archiveName: string;
  processImage: ProcessImage;
  ready?: boolean;
}

export default function ImageBatchWorkbench({
  settings,
  settingsTitle,
  importHint,
  action,
  archiveName,
  processImage,
  ready = true
}: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const active = useRef(true);
  const working = useRef(false);
  const nextId = useRef(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<number>();
  const [showResult, setShowResult] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [report, setReport] = useState<Report>();

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, []);

  const { isDragging, dropHandlers, addFiles } = useFileDrop({
    accept: acceptedImages,
    onFiles: async (files) => {
      if (working.current) return;
      working.current = true;
      setImporting(true);
      setImportErrors([]);
      const added: Source[] = [];
      const failed: string[] = [];
      try {
        for (const source of files) {
          if (!active.current) return;
          try {
            let file = source;
            if (
              /\.hei[cf]$/i.test(source.name) ||
              /^image\/hei[cf]/.test(source.type)
            ) {
              const { heicTo } = await import('heic-to');
              const blob = await heicTo({ blob: source, type: 'image/jpeg' });
              file = new File(
                [blob],
                source.name.replace(/\.[^.]+$/, '') + '.jpg',
                {
                  type: 'image/jpeg'
                }
              );
            }
            const dimensions = await getImageDimensions(file);
            if (!active.current) return;
            const url = URL.createObjectURL(file);
            urls.current.add(url);
            added.push({
              ...dimensions,
              id: nextId.current++,
              name: source.name,
              file,
              url
            });
          } catch {
            failed.push(source.name);
          }
        }
        if (added.length) {
          setSources((previous) => [...previous, ...added]);
          setSelected(added[0].id);
          setShowResult(false);
        }
        setImportErrors(failed);
      } finally {
        working.current = false;
        if (active.current) setImporting(false);
      }
    }
  });

  const current =
    report?.sources === sources && report.process === processImage
      ? report
      : undefined;
  const source = sources.find((item) => item.id === selected) ?? sources[0];
  const outcome = source ? current?.outcomes.get(source.id) : undefined;
  const result = outcome && 'file' in outcome ? outcome : undefined;
  const previewingResult = showResult && Boolean(result);
  const dimensions = (previewingResult && result?.dimensions) || source;
  const busy = progress !== null;

  function remove(item: Source) {
    URL.revokeObjectURL(item.url);
    urls.current.delete(item.url);
    setSources((previous) => previous.filter((file) => file.id !== item.id));
  }

  async function run() {
    if (!sources.length || working.current || !ready) return;
    working.current = true;
    setReport(undefined);
    setProgress(0);
    const outcomes = new Map<number, Outcome>();
    const files: File[] = [];
    let archive: File | null = null;
    let archiveError = false;
    try {
      for (const item of sources) {
        if (!active.current) return;
        try {
          const output = await processImage(item.file);
          outcomes.set(item.id, output);
          files.push(output.file);
        } catch (error) {
          outcomes.set(item.id, {
            error: error instanceof Error ? error.message : '无法处理此图片。'
          });
        }
        if (!active.current) return;
        setProgress(outcomes.size);
      }
      if (files.length > 1) {
        try {
          archive = await createArchive(files, archiveName);
        } catch {
          archiveError = true;
        }
      }
      if (active.current) {
        setReport({
          sources,
          process: processImage,
          outcomes,
          archive,
          archiveError
        });
        setShowResult(true);
      }
    } finally {
      working.current = false;
      if (active.current) setProgress(null);
    }
  }

  const failedCount = current
    ? [...current.outcomes.values()].filter((item) => 'error' in item).length
    : 0;

  return (
    <div className="image-batch-workbench">
      <section
        className="image-batch-main"
        aria-labelledby="image-batch-preview"
      >
        <header className="image-batch-toolbar">
          <h2 id="image-batch-preview">图片预览</h2>
          {source && (
            <div
              className="image-batch-switch"
              role="group"
              aria-label="预览内容"
            >
              <button
                type="button"
                aria-pressed={!previewingResult}
                onClick={() => setShowResult(false)}
              >
                原图
              </button>
              <button
                type="button"
                aria-pressed={previewingResult}
                disabled={!result}
                onClick={() => setShowResult(true)}
              >
                结果
              </button>
            </div>
          )}
        </header>
        <div
          className={`image-batch-stage${isDragging ? ' is-dragging' : ''}`}
          {...dropHandlers}
        >
          <input
            ref={picker}
            type="file"
            accept={acceptedImages.join(',')}
            multiple
            hidden
            onChange={(event) => {
              if (event.currentTarget.files)
                void addFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
          {source ? (
            previewingResult && result ? (
              <ResultPreview file={result.file} />
            ) : (
              <img src={source.url} alt="原图" />
            )
          ) : (
            <button
              className="image-batch-upload"
              type="button"
              disabled={importing}
              onClick={() => picker.current?.click()}
            >
              <span className="image-batch-upload-icon">
                <Glyph name="upload" size={27} />
              </span>
              <strong>
                {importing
                  ? '正在导入…'
                  : isDragging
                    ? '松开以导入'
                    : '选择图片或拖放到这里'}
              </strong>
              <span>{importHint}</span>
            </button>
          )}
        </div>
        {source && (
          <div className="image-batch-caption">
            <div>
              <strong
                title={
                  result && previewingResult ? result.file.name : source.name
                }
              >
                {result && previewingResult ? result.file.name : source.name}
              </strong>
              <small>
                {dimensions?.width} × {dimensions?.height} px ·{' '}
                {formatSize(source.file.size)}
                {result && ' → ' + formatSize(result.file.size)}
              </small>
              {result?.detail && <small>{result.detail}</small>}
              {outcome && 'error' in outcome && (
                <small role="alert">{outcome.error}</small>
              )}
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || importing}
              onClick={() => picker.current?.click()}
            >
              <Glyph name="add" size={16} /> 添加图片
            </button>
          </div>
        )}
        {importErrors.length > 0 && (
          <p className="image-batch-message" role="alert">
            无法读取：{importErrors.join('、')}
          </p>
        )}
        {sources.length > 0 && (
          <ul className="image-batch-queue" aria-label="图片列表">
            {sources.map((item) => {
              const status = current?.outcomes.get(item.id);
              const done = status && 'file' in status;
              return (
                <li key={item.id}>
                  <button
                    className="image-batch-file"
                    type="button"
                    aria-pressed={item.id === source?.id}
                    onClick={() => setSelected(item.id)}
                  >
                    <img src={item.url} alt="" />
                    <span>
                      <strong title={item.name}>{item.name}</strong>
                      <small>
                        {status
                          ? done
                            ? '已完成'
                            : '处理失败'
                          : formatSize(item.file.size)}
                      </small>
                    </span>
                  </button>
                  {done && (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={'下载 ' + status.file.name}
                      onClick={() => downloadFile(status.file)}
                    >
                      <Glyph name="download" size={17} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={'移除 ' + item.name}
                    disabled={busy || importing}
                    onClick={() => remove(item)}
                  >
                    <Glyph name="close" size={17} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <aside className="image-batch-controls" aria-busy={busy}>
        <h2>{settingsTitle}</h2>
        <fieldset className="image-batch-options" disabled={busy}>
          {settings}
        </fieldset>
        <div className="image-batch-actions">
          <button
            className="primary-button"
            type="button"
            data-testid="process-tool"
            disabled={!sources.length || busy || importing || !ready}
            onClick={() => void run()}
          >
            {busy
              ? '正在处理…'
              : sources.length > 1
                ? action + ' ' + sources.length + ' 张图片'
                : action}
            <Glyph name="arrow" size={17} />
          </button>
          {busy && (
            <progress
              aria-label="处理进度"
              value={progress ?? 0}
              max={sources.length}
            />
          )}
          {result && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => downloadFile(result.file)}
            >
              <Glyph name="download" size={17} /> 下载
            </button>
          )}
          {current?.archive && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => current.archive && downloadFile(current.archive)}
            >
              <Glyph name="download" size={17} /> 下载全部为 ZIP
            </button>
          )}
          {current && (
            <p className="image-batch-message" role="status">
              已完成 {sources.length - failedCount} / {sources.length} 张
              {failedCount > 0 && ' · ' + failedCount + ' 张失败'}
              {current.archiveError && ' · ZIP 生成失败，可单独下载'}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
