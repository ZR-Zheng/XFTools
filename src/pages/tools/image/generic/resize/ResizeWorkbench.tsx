import { useEffect, useRef, useState } from 'react';
import { useWorkbenchText } from 'i18n/workbench';
import useFileDrop from 'hooks/useFileDrop';
import Glyph from '@components/workbench/Glyph';
import { resizeImages } from './service';
import type { InitialValuesType } from './types';
import { getResizeDimensions } from './resize-dimensions';
import './resize-workbench.css';

interface Source {
  id: number;
  file: File;
  url: string;
  width: number;
  height: number;
}
const defaults: InitialValuesType = {
  resizeMethod: 'pixels',
  dimensionType: 'width',
  width: '800',
  height: '600',
  percentage: '50',
  maintainAspectRatio: true
};
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ResizeWorkbench() {
  const { english } = useWorkbenchText();
  const tr = (zh: string, en: string) => (english ? en : zh);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState(0);
  const [options, setOptions] = useState(defaults);
  const [results, setResults] = useState<File[]>([]);
  const [zip, setZip] = useState<File | null>(null);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [view, setView] = useState<'original' | 'result'>('original');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const currentSources = useRef(sources);
  currentSources.current = sources;
  const nextId = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    const next = results.map((file) => URL.createObjectURL(file));
    setResultUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [results]);
  const clearResults = () => {
    setResults([]);
    setZip(null);
    setView('original');
    setError('');
  };
  const change = (next: Partial<InitialValuesType>) => {
    setOptions((value) => ({ ...value, ...next }));
    clearResults();
  };
  const source = sources[selected] || sources[0];
  const target = source
    ? getResizeDimensions(source.width, source.height, options)
    : null;
  const { isDragging, dropHandlers, addFiles } = useFileDrop({
    accept: ['image/*', '.heic', '.heif'],
    onFiles: async (files) => {
      if (busy || importing) return;
      setImporting(true);
      setError('');
      const added: Source[] = [];
      const failed: string[] = [];
      for (let file of files) {
        let url = '';
        try {
          if (
            /\.hei[cf]$/i.test(file.name) ||
            /image\/hei[cf]/.test(file.type)
          ) {
            const { heicTo } = await import('heic-to');
            const blob = await heicTo({ blob: file, type: 'image/jpeg' });
            file = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg'
            });
          }
          const names = new Set(
            [...currentSources.current, ...added].map((item) => item.file.name)
          );
          if (names.has(file.name)) {
            const dot = file.name.lastIndexOf('.'),
              base = dot > 0 ? file.name.slice(0, dot) : file.name,
              extension = dot > 0 ? file.name.slice(dot) : '';
            let suffix = 2;
            while (names.has(`${base}-${suffix}${extension}`)) suffix++;
            file = new File([file], `${base}-${suffix}${extension}`, {
              type: file.type
            });
          }
          url = URL.createObjectURL(file);
          const image = new Image();
          image.src = url;
          await image.decode();
          if (!active.current) {
            URL.revokeObjectURL(url);
            break;
          }
          urls.current.add(url);
          added.push({
            id: ++nextId.current,
            file,
            url,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        } catch {
          if (url) URL.revokeObjectURL(url);
          failed.push(file.name);
        }
      }
      if (!active.current) return;
      if (added.length) {
        if (!currentSources.current.length)
          setOptions((value) => ({
            ...value,
            width: String(added[0].width),
            height: String(added[0].height),
            dimensionType: 'width'
          }));
        setSources((value) => [...value, ...added]);
        clearResults();
      }
      if (failed.length)
        setError(`${tr('无法读取：', 'Could not read: ')}${failed.join(', ')}`);
      setImporting(false);
    }
  });
  const setDimension = (dimension: 'width' | 'height', value: string) => {
    const next: Partial<InitialValuesType> = {
      [dimension]: value,
      dimensionType: dimension
    };
    if (options.maintainAspectRatio && source && Number(value) > 0) {
      if (dimension === 'width')
        next.height = String(
          Math.max(
            1,
            Math.round((Number(value) * source.height) / source.width)
          )
        );
      else
        next.width = String(
          Math.max(
            1,
            Math.round((Number(value) * source.width) / source.height)
          )
        );
    }
    change(next);
  };
  const remove = (index: number) => {
    const item = sources[index];
    URL.revokeObjectURL(item.url);
    urls.current.delete(item.url);
    setSources((value) => value.filter((_, i) => i !== index));
    setSelected((value) => Math.max(0, value >= index ? value - 1 : value));
    clearResults();
  };
  const run = async () => {
    if (!sources.length || busy) return;
    if (
      !target ||
      !Number.isFinite(target.width) ||
      !Number.isFinite(target.height) ||
      target.width < 1 ||
      target.height < 1 ||
      (options.resizeMethod === 'pixels' &&
        (!Number.isInteger(target.width) ||
          !Number.isInteger(target.height))) ||
      (options.resizeMethod === 'percentage' &&
        (Number(options.percentage) < 1 || Number(options.percentage) > 1000))
    ) {
      setError(
        tr(
          '请输入有效尺寸，缩放比例应在 1% 到 1000% 之间。',
          'Enter valid dimensions and a scale between 1% and 1000%.'
        )
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const output = await resizeImages(
        sources.map((item) => item.file),
        options
      );
      if (!active.current) return;
      if (!output || output.results.length !== sources.length)
        throw new Error(
          tr(
            '部分图片未能处理，请检查格式或减小尺寸后重试。',
            'Some images could not be resized. Check their format or try smaller dimensions.'
          )
        );
      setResults(output.results);
      setZip(output.zipFile);
      setView('result');
    } catch (error) {
      if (active.current)
        setError(
          error instanceof Error
            ? error.message
            : tr('调整失败，请重试。', 'Could not resize. Please try again.')
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };

  return (
    <div className="image-resize-workbench" data-testid="resize-workbench">
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        disabled={busy || importing}
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <div className="resize-editor">
        <section
          className={`resize-stage-panel ${isDragging ? 'dragging' : ''}`}
          {...dropHandlers}
          aria-label={tr('图片工作区', 'Image workspace')}
        >
          <div className="resize-stage-toolbar">
            <div
              className="resize-tabs"
              role="group"
              aria-label={tr('预览视图', 'Preview view')}
            >
              <button
                type="button"
                aria-pressed={view === 'original'}
                onClick={() => setView('original')}
              >
                {tr('原图', 'Original')}
              </button>
              <button
                type="button"
                aria-pressed={view === 'result'}
                disabled={!results.length}
                onClick={() => setView('result')}
              >
                {tr('处理结果', 'Result')}
              </button>
            </div>
            <button
              className="text-link"
              type="button"
              disabled={busy || importing}
              onClick={() => input.current?.click()}
            >
              <Glyph name="add" size={16} />
              {sources.length
                ? tr('添加图片', 'Add images')
                : tr('选择图片', 'Choose images')}
            </button>
          </div>
          {source ? (
            <div className="resize-stage">
              <img
                src={view === 'result' ? resultUrls[selected] : source.url}
                alt={
                  view === 'result'
                    ? tr('调整后的图片', 'Resized image')
                    : source.file.name
                }
              />
              <span className="resize-dimension-badge">
                {view === 'result' && target
                  ? `${target.width} × ${target.height}`
                  : `${source.width} × ${source.height}`}{' '}
                px
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="resize-upload"
              onClick={() => input.current?.click()}
              disabled={importing}
            >
              <Glyph name="image" size={38} />
              <strong>
                {importing
                  ? tr('正在读取图片…', 'Reading images…')
                  : tr(
                      '选择图片，或拖到这里',
                      'Choose images or drop them here'
                    )}
              </strong>
              <span>JPG · PNG · WebP · GIF · SVG · HEIC</span>
            </button>
          )}
          {source && (
            <div className="resize-source-info">
              <span title={source.file.name}>{source.file.name}</span>
              <span>
                {view === 'result' && results[selected]
                  ? formatSize(results[selected].size)
                  : formatSize(source.file.size)}
              </span>
            </div>
          )}
        </section>
        <aside
          className="resize-controls"
          aria-label={tr('尺寸设置', 'Resize settings')}
        >
          <div className="resize-control-heading">
            <h2>{tr('尺寸设置', 'Dimensions')}</h2>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                change({
                  ...defaults,
                  width: String(source?.width || 800),
                  height: String(source?.height || 600)
                });
              }}
            >
              {tr('重置', 'Reset')}
            </button>
          </div>
          <fieldset disabled={busy}>
            <div
              className="resize-mode"
              role="group"
              aria-label={tr('调整方式', 'Resize mode')}
            >
              <button
                type="button"
                aria-pressed={options.resizeMethod === 'pixels'}
                onClick={() => change({ resizeMethod: 'pixels' })}
              >
                {tr('像素', 'Pixels')}
              </button>
              <button
                type="button"
                aria-pressed={options.resizeMethod === 'percentage'}
                onClick={() => change({ resizeMethod: 'percentage' })}
              >
                {tr('百分比', 'Percentage')}
              </button>
            </div>
            {options.resizeMethod === 'pixels' ? (
              <>
                <div className="resize-dimensions">
                  <label>
                    {tr('宽度', 'Width')}
                    <div>
                      <input
                        data-testid="width-input"
                        type="number"
                        min="1"
                        value={
                          options.maintainAspectRatio &&
                          options.dimensionType === 'height' &&
                          target
                            ? target.width
                            : options.width
                        }
                        onChange={(event) =>
                          setDimension('width', event.target.value)
                        }
                      />
                      <span>px</span>
                    </div>
                  </label>
                  <label>
                    {tr('高度', 'Height')}
                    <div>
                      <input
                        data-testid="height-input"
                        type="number"
                        min="1"
                        value={
                          options.maintainAspectRatio &&
                          options.dimensionType === 'width' &&
                          target
                            ? target.height
                            : options.height
                        }
                        onChange={(event) =>
                          setDimension('height', event.target.value)
                        }
                      />
                      <span>px</span>
                    </div>
                  </label>
                </div>
                <label className="resize-ratio">
                  <input
                    type="checkbox"
                    checked={options.maintainAspectRatio}
                    onChange={(event) =>
                      change({ maintainAspectRatio: event.target.checked })
                    }
                  />
                  {tr('锁定宽高比', 'Lock aspect ratio')}
                </label>
                <div
                  className="resize-presets"
                  role="group"
                  aria-label={tr('常用宽度', 'Width presets')}
                >
                  {[640, 1280, 1920].map((width) => (
                    <button
                      type="button"
                      key={width}
                      onClick={() => setDimension('width', String(width))}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <label className="resize-percentage">
                  {tr('缩放比例', 'Scale')}
                  <div>
                    <input
                      data-testid="percentage-input"
                      type="number"
                      min="1"
                      max="1000"
                      value={options.percentage}
                      onChange={(event) =>
                        change({ percentage: event.target.value })
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
                <input
                  className="resize-scale-range"
                  aria-label={tr('缩放比例滑块', 'Scale slider')}
                  type="range"
                  min="1"
                  max="200"
                  value={Math.min(200, Number(options.percentage) || 1)}
                  onChange={(event) =>
                    change({ percentage: event.target.value })
                  }
                />
                <div
                  className="resize-presets"
                  role="group"
                  aria-label={tr('常用缩放比例', 'Scale presets')}
                >
                  {[25, 50, 75, 100].map((percentage) => (
                    <button
                      type="button"
                      key={percentage}
                      aria-pressed={options.percentage === String(percentage)}
                      onClick={() => change({ percentage: String(percentage) })}
                    >
                      {percentage}%
                    </button>
                  ))}
                </div>
              </>
            )}
          </fieldset>
          <div className="resize-summary">
            <span>{tr('原始尺寸', 'Original size')}</span>
            <strong>
              {source ? `${source.width} × ${source.height}` : '—'}
            </strong>
            <span>{tr('输出尺寸', 'Output size')}</span>
            <strong data-testid="resize-target">
              {target &&
              Number.isFinite(target.width) &&
              Number.isFinite(target.height)
                ? `${target.width} × ${target.height}`
                : '—'}
            </strong>
          </div>
          {sources.length > 1 && (
            <p className="resize-batch-note">
              {tr(
                `设置将应用于全部 ${sources.length} 张图片；锁定比例时，每张图片分别保持自己的比例。`,
                `Settings apply to all ${sources.length} images; each keeps its own aspect ratio when locked.`
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="tool-inline-error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="primary-button resize-submit"
            disabled={!sources.length || busy || importing}
            onClick={() => {
              void run();
            }}
          >
            {busy
              ? tr('正在调整…', 'Resizing…')
              : sources.length > 1
                ? tr(
                    `调整 ${sources.length} 张图片`,
                    `Resize ${sources.length} images`
                  )
                : tr('调整大小', 'Resize image')}
            <Glyph name="arrow" size={17} />
          </button>
          {results.length > 0 && (
            <button
              type="button"
              className="secondary-button resize-submit"
              onClick={() => download(zip || results[selected] || results[0])}
            >
              <Glyph name="download" size={17} />
              {zip
                ? tr('下载全部 ZIP', 'Download all as ZIP')
                : tr('下载图片', 'Download image')}
            </button>
          )}
        </aside>
      </div>
      {sources.length > 0 && (
        <section
          className="resize-file-strip"
          aria-label={tr('图片列表', 'Image list')}
        >
          {sources.map((item, index) => {
            const output = getResizeDimensions(
              item.width,
              item.height,
              options
            );
            return (
              <div
                key={item.id}
                className={`resize-file-card ${selected === index ? 'selected' : ''}`}
              >
                <button
                  type="button"
                  className="resize-file-focus"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                >
                  <img src={item.url} alt="" />
                  <span>
                    <strong>{item.file.name}</strong>
                    <small>
                      {item.width} × {item.height}{' '}
                      <Glyph name="arrow" size={12} />{' '}
                      {Number.isFinite(output.width) &&
                      Number.isFinite(output.height)
                        ? `${output.width} × ${output.height}`
                        : '—'}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${tr('移除', 'Remove')} ${item.file.name}`}
                  disabled={busy}
                  onClick={() => remove(index)}
                >
                  <Glyph name="close" size={16} />
                </button>
                {results[index] && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${tr('下载', 'Download')} ${results[index].name}`}
                    onClick={() => download(results[index])}
                  >
                    <Glyph name="download" size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}
      <p className="resize-help">
        {tr(
          '支持批量调整。锁定比例时，修改宽度或高度会自动联动另一边；SVG 保持矢量，GIF 保留动画。',
          'Batch resizing is supported. Locked dimensions update together; SVG stays vector and GIF retains animation.'
        )}
      </p>
    </div>
  );
}
