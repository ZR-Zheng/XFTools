import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Glyph from '@components/workbench/Glyph';
import useFileDrop from 'hooks/useFileDrop';
import type { ToolComponentProps } from '@tools/defineTool';
import VideoInspector, { panels, type Panel } from './VideoInspector';
import VideoMonitor, { EmptyMonitor } from './VideoMonitor';
import VideoTimeline from './VideoTimeline';
import VideoExportDialog from './VideoExportDialog';
import VideoTemplatesDialog from './VideoTemplatesDialog';
import JianyingImportDialog from './JianyingImportDialog';
import { outputSize, formats, type ExportOptions } from './export-settings';
import { getTemplate, type CanvasSettings } from './templates';
import type { ExportProgress } from './export';
import {
  assetKind,
  audioTypes,
  imageTypes,
  importAsset,
  videoTypes
} from './media';
import {
  clamp,
  clipAt,
  clipDuration,
  createClip,
  createSoundtrack,
  EMPTY_HISTORY,
  historyReducer,
  placeClips,
  splitClip,
  timeLabel,
  type Asset,
  type Clip,
  type PositionedClip,
  type Project
} from './timeline';
import '@components/workbench/workspace-theme.css';
import './video-workspace.css';

const accepted = [...videoTypes, ...audioTypes, ...imageTypes];
const zeroProject = { clips: [], soundtrack: null };

function SettingsDrawer({
  children,
  onClose
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      className="vw-dialog vw-settings-drawer"
      ref={ref}
      aria-label="片段设置"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export default function VideoWorkspace({ title }: ToolComponentProps) {
  const [params, setParams] = useSearchParams();
  const initialPanel =
    panels.find((item) => item.id === params.get('panel'))?.id ?? 'clip';
  const initialFormat =
    formats.find((format) => format === params.get('format')) ?? 'mp4';
  const legacyImageSequence = params.get('preset') === 'images';
  const [history, dispatch] = useReducer(historyReducer, EMPTY_HISTORY);
  const [assets, setAssets] = useState(new Map<string, Asset>());
  const [selection, setSelection] = useState<string>();
  const [source, setSource] = useState<Asset>();
  const [preview, setPreview] = useState<'timeline' | 'source'>('timeline');
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [drawer, setDrawer] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [jianyingOpen, setJianyingOpen] = useState(false);
  const [exportOverrides, setExportOverrides] = useState<
    Partial<Record<CanvasSettings['template'], Partial<ExportOptions>>>
  >({});
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState('');
  const [result, setResult] = useState<File | null>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const copiedClip = useRef<Clip>(null);
  const mediaTask = useRef<AbortController>(null);
  const renderTask = useRef<AbortController>(null);
  const owned = useRef(new Set<string>());

  const project = history.present;
  const canvas = project.canvas;
  const importedCanvas = canvas.template === 'jianying';
  const template = getTemplate(canvas.template);
  const imageDuration =
    template?.stillDuration ?? (legacyImageSequence ? 0.1 : 0.2);
  const options: ExportOptions = {
    format: importedCanvas ? 'mp4' : (template?.format ?? initialFormat),
    resolution: importedCanvas
      ? 'source'
      : template
        ? '1080'
        : params.get('preset') === 'resize'
          ? '720'
          : 'source',
    quality:
      !template && params.get('preset') === 'compress' ? 'small' : 'balanced',
    gifWidth: 480,
    gifFps:
      !template && initialFormat === 'gif' && legacyImageSequence ? 10 : 15,
    ...exportOverrides[canvas.template]
  };
  const entries = useMemo(() => placeClips(project.clips), [project.clips]);
  const duration = entries.at(-1)?.end ?? 0;
  const position = clamp(time, 0, duration);
  const playingEntry = clipAt(entries, position);
  const playingAsset = playingEntry && assets.get(playingEntry.clip.assetId);
  const selected =
    entries.find((entry) => entry.clip.id === selection) ?? playingEntry;
  const selectedIndex = entries.findIndex((entry) => entry === selected);
  const firstClip = project.clips[0];
  const firstAsset = firstClip && assets.get(firstClip.assetId);
  const visualFormat =
    options.format === 'mp4' || options.format === 'gif'
      ? options.format
      : (template?.format ?? 'mp4');
  const frame =
    firstAsset && firstClip
      ? outputSize(
          firstAsset,
          firstClip,
          { ...options, format: visualFormat },
          canvas
        )
      : undefined;
  const audio = project.soundtrack
    ? assets.get(project.soundtrack.assetId)
    : undefined;

  useEffect(
    () => () => {
      mediaTask.current?.abort();
      renderTask.current?.abort();
      for (const url of owned.current) URL.revokeObjectURL(url);
      owned.current.clear();
    },
    []
  );

  function change(apply: (current: Project) => Project) {
    setPlaying(false);
    setResult(null);
    dispatch({ type: 'change', apply });
  }

  function changeExportOptions(
    id: CanvasSettings['template'],
    patch: Partial<ExportOptions>
  ) {
    setExportOverrides((current) => ({
      ...current,
      [id]: { ...current[id], ...patch }
    }));
    setResult(null);
    setExportError('');
  }

  function selectPanel(next: Panel, mobile = false) {
    setPanel(next);
    if (mobile && window.matchMedia('(max-width: 860px)').matches)
      setDrawer(true);
  }

  function openAudio() {
    selectPanel('audio', true);
    if (!audio) audioInput.current?.click();
  }

  function selectEntry(entry: PositionedClip) {
    setPlaying(false);
    setPreview('timeline');
    setSelection(entry.clip.id);
    setTime(entry.start);
  }

  function seek(next: number) {
    setPlaying(false);
    setPreview('timeline');
    setTime(clamp(next, 0, duration));
  }

  function togglePlayback() {
    if (!duration) return;
    setPreview('timeline');
    if (playing) {
      setPlaying(false);
      return;
    }
    if (position >= duration - 0.01) setTime(0);
    setNotice('');
    setPlaying(true);
  }

  const { isDragging, addFiles, dropHandlers } = useFileDrop({
    accept: accepted,
    onFiles: async (files) => {
      if (mediaTask.current || renderTask.current) return;
      const task = new AbortController();
      mediaTask.current = task;
      setPlaying(false);
      setImporting(true);
      setNotice('');
      const added: Asset[] = [];
      const failed: string[] = [];
      let failureMessage = '';
      try {
        for (const file of files) {
          try {
            const kind = assetKind(file);
            if (!kind) throw new Error('无法识别素材类型。');
            const asset = await importAsset(file, kind, task.signal);
            if (task.signal.aborted) {
              URL.revokeObjectURL(asset.url);
              return;
            }
            owned.current.add(asset.url);
            added.push(asset);
          } catch (error) {
            if (task.signal.aborted) return;
            failed.push(file.name);
            failureMessage =
              error instanceof Error && /[\u3400-\u9fff]/.test(error.message)
                ? error.message
                : '';
          }
        }
        if (added.length) {
          const visuals = added.filter(({ kind }) => kind !== 'audio');
          const music = added.findLast(({ kind }) => kind === 'audio');
          const clips = visuals.map((asset) =>
            createClip(asset, imageDuration)
          );
          const soundtrack = music && createSoundtrack(music);
          setAssets(
            (current) =>
              new Map([
                ...current,
                ...added.map((asset) => [asset.id, asset] as const)
              ])
          );
          change((current) => ({
            ...current,
            clips: [...current.clips, ...clips],
            soundtrack: soundtrack ?? current.soundtrack
          }));
          if (clips[0]) {
            setSelection(clips[0].id);
            setTime(duration);
            setSource(visuals[0]);
            setPreview('timeline');
            if (
              !duration &&
              canvas.template === 'source' &&
              !params.has('format') &&
              visuals.every(({ kind }) => kind !== 'video')
            ) {
              changeExportOptions('source', { format: 'gif' });
            }
            if (params.get('panel') === 'export') showExport();
          }
          if (soundtrack) selectPanel('audio');
        }
        if (failed.length)
          setNotice(
            failed.length === 1 && failureMessage
              ? failureMessage
              : '无法读取 ' +
                  failed.join('、') +
                  '。可尝试 MP4、WebM、GIF、PNG 或常见音频格式。'
          );
      } finally {
        mediaTask.current = null;
        if (!task.signal.aborted) setImporting(false);
      }
    }
  });

  function append(asset: Asset) {
    if (asset.kind === 'audio') {
      const soundtrack = createSoundtrack(asset);
      change((current) => ({ ...current, soundtrack }));
      selectPanel('audio', true);
    } else {
      const clip = createClip(asset, imageDuration);
      change((current) => ({ ...current, clips: [...current.clips, clip] }));
      setSelection(clip.id);
      seek(duration);
    }
  }

  function updateClip(clip: Clip) {
    change((current) => ({
      ...current,
      clips: current.clips.map((item) => (item.id === clip.id ? clip : item))
    }));
    setSelection(clip.id);
    if (panel === 'effects' && selected?.clip.id === clip.id) {
      if (playingEntry?.clip.id !== clip.id) seek(selected.start);
      else setPreview('timeline');
    }
  }

  function move(id: string, target: string) {
    if (id === target) return;
    const previous = project.clips.findIndex((clip) => clip.id === id);
    const next = project.clips.findIndex((clip) => clip.id === target);
    if (previous < 0 || next < 0) return;
    const clips = [...project.clips];
    const [clip] = clips.splice(previous, 1);
    clips.splice(next, 0, clip);
    change((current) => ({ ...current, clips }));
    const entry = placeClips(clips)[next];
    selectEntry(entry);
  }

  const canSplit =
    playingEntry &&
    position > playingEntry.start + 0.05 / playingEntry.clip.speed &&
    position < playingEntry.end - 0.05 / playingEntry.clip.speed;

  function split() {
    if (!playingEntry) return;
    const parts = splitClip(playingEntry, position, crypto.randomUUID());
    if (!parts) return;
    change((current) => ({
      ...current,
      clips: current.clips.flatMap((clip) =>
        clip.id === parts[0].id ? parts : [clip]
      )
    }));
    setSelection(parts[1].id);
  }

  function insertCopy(clip: Clip) {
    const copied = { ...clip, id: crypto.randomUUID() };
    const index = selected ? selectedIndex + 1 : project.clips.length;
    change((current) => ({
      ...current,
      clips: current.clips.toSpliced(index, 0, copied)
    }));
    setSelection(copied.id);
    seek(selected?.end ?? duration);
  }

  function duplicate() {
    if (selected) insertCopy(selected.clip);
  }

  function remove() {
    if (!selected) return;
    change((current) => ({
      ...current,
      clips: current.clips.filter((clip) => clip.id !== selected.clip.id)
    }));
  }

  function historyStep(type: 'undo' | 'redo') {
    setPlaying(false);
    setResult(null);
    dispatch({ type });
  }

  function showExport() {
    setPlaying(false);
    setExportOpen(true);
  }

  function closeExport() {
    setExportOpen(false);
    if (params.get('panel') === 'export') {
      const next = new URLSearchParams(params);
      next.delete('panel');
      setParams(next, { replace: true });
    }
  }

  async function runExport() {
    if (!project.clips.length || renderTask.current || mediaTask.current)
      return;
    const controller = new AbortController();
    renderTask.current = controller;
    setProgress({ stage: 'load' });
    setResult(null);
    setExportError('');
    try {
      const { exportVideo } = await import('./export');
      const output = await exportVideo(
        project,
        assets,
        options,
        controller.signal,
        setProgress
      );
      if (!controller.signal.aborted) setResult(output);
    } catch (error) {
      if (!controller.signal.aborted) {
        setExportError(
          error instanceof Error && /[\u3400-\u9fff]/.test(error.message)
            ? error.message
            : '无法完成导出。请确认素材可播放，或降低分辨率后重试。'
        );
      }
    } finally {
      renderTask.current = null;
      setProgress(null);
    }
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      drawer ||
      templateOpen ||
      jianyingOpen ||
      exportOpen ||
      target?.closest(
        'input:not([type="range"]),textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'
      )
    )
      return;

    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    let action: (() => void) | undefined;
    if (command) {
      if (key === 'z')
        action = () => historyStep(event.shiftKey ? 'redo' : 'undo');
      if (key === 'y' && event.ctrlKey && !event.shiftKey)
        action = () => historyStep('redo');
      if (key === 'd' && !event.shiftKey && selected) action = duplicate;
      if (
        key === 'c' &&
        !event.shiftKey &&
        selected &&
        window.getSelection()?.isCollapsed !== false
      )
        action = () => {
          copiedClip.current = selected.clip;
        };
      const clip = copiedClip.current;
      if (key === 'v' && !event.shiftKey && clip)
        action = () => insertCopy(clip);
    } else if (duration) {
      if (
        event.code === 'Space' &&
        !target?.closest(
          'button:focus-visible,a:focus-visible,summary:focus-visible'
        )
      )
        action = togglePlayback;
      if (!event.shiftKey && key === 's' && canSplit) action = split;
      if (
        !event.shiftKey &&
        (key === 'delete' || key === 'backspace') &&
        selected
      )
        action = remove;
      if (!target?.closest('input[type="range"]')) {
        if (key === 'arrowleft' || key === 'arrowright') {
          const step =
            (event.shiftKey ? 1 : 1 / 30) * (key === 'arrowleft' ? -1 : 1);
          action = () => seek(position + step);
        }
        if (key === 'home' || key === 'end')
          action = () => seek(key === 'home' ? 0 : duration);
      }
    }
    if (!action) return;
    event.preventDefault();
    if (!event.repeat || ['arrowleft', 'arrowright'].includes(key)) action();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleShortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const inspector = (
    <VideoInspector
      panel={panel}
      onPanel={setPanel}
      clip={selected?.clip}
      asset={selected && assets.get(selected.clip.assetId)}
      duration={duration}
      soundtrack={project.soundtrack}
      audioAsset={audio}
      onClip={updateClip}
      onApplyImageDuration={
        selected &&
        entries.some(
          ({ clip }) =>
            clip.id !== selected.clip.id &&
            assets.get(clip.assetId)?.kind === 'image'
        )
          ? () => {
              const seconds = clipDuration(selected.clip);
              change((current) => ({
                ...current,
                clips: current.clips.map((clip) =>
                  assets.get(clip.assetId)?.kind === 'image'
                    ? { ...clip, inPoint: 0, outPoint: seconds, speed: 1 }
                    : clip
                )
              }));
            }
          : undefined
      }
      onSoundtrack={(soundtrack) =>
        change((current) => ({ ...current, soundtrack }))
      }
      onImportAudio={() => audioInput.current?.click()}
      onClose={() => setDrawer(false)}
    />
  );

  return (
    <section
      className={
        'workspace-theme video-workspace' + (isDragging ? ' is-dragging' : '')
      }
      aria-label={title}
      {...dropHandlers}
    >
      <input
        hidden
        ref={mediaInput}
        type="file"
        multiple
        accept={accepted.join(',')}
        aria-label="导入视频或图片素材"
        onChange={(event) => {
          if (event.currentTarget.files)
            void addFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        hidden
        ref={audioInput}
        type="file"
        accept={audioTypes.join(',')}
        aria-label="导入配乐文件"
        onChange={(event) => {
          if (event.currentTarget.files)
            void addFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <header className="vw-toolbar">
        <Link
          className="vw-icon"
          aria-label="返回工具箱"
          title="返回工具箱"
          to="/"
        >
          <Glyph name="arrow" size={19} style={{ rotate: '180deg' }} />
        </Link>
        <div className="vw-title">
          <strong className="vw-title-text" aria-hidden="true">
            {title}
          </strong>
          {duration > 0 && <span>{timeLabel(duration, true)}</span>}
        </div>
        <div className="vw-toolbar-actions">
          <button
            className="vw-text-button vw-template-button"
            type="button"
            aria-label="剪辑模板"
            aria-haspopup="dialog"
            title={
              importedCanvas
                ? '剪映画布'
                : template
                  ? `${template.title} · ${template.label}`
                  : '选择剪辑模板'
            }
            disabled={importing}
            onClick={() => {
              setPlaying(false);
              setTemplateOpen(true);
            }}
          >
            <Glyph name="grid" size={16} />{' '}
            <span>
              模板
              {importedCanvas ? ' · 剪映' : template && ` ${template.label}`}
            </span>
          </button>
          <button
            className="primary-button vw-export-button"
            type="button"
            disabled={!duration || importing}
            onClick={showExport}
          >
            <Glyph name="download" size={17} /> 导出
          </button>
        </div>
      </header>
      {notice && (
        <p className="vw-error vw-workspace-notice" role="alert">
          {notice}
        </p>
      )}
      <div className="vw-editor">
        <section className="vw-panel vw-assets" aria-label="项目素材">
          <header className="vw-pane-header">
            <h2>素材</h2>
            <button
              className="vw-icon"
              type="button"
              aria-label="导入素材"
              disabled={importing}
              onClick={() => mediaInput.current?.click()}
            >
              <Glyph name="upload" size={17} />
            </button>
          </header>
          {importing && (
            <p className="vw-muted vw-media-empty" role="status">
              正在读取素材…
            </p>
          )}
          {!assets.size && !importing && (
            <button
              className="vw-media-empty"
              type="button"
              onClick={() => mediaInput.current?.click()}
            >
              <Glyph name="add" size={20} /> 导入视频、图片或音频
            </button>
          )}
          {assets.size > 0 && (
            <ul className="vw-library">
              {[...assets.values()].map((asset) => (
                <li key={asset.id}>
                  <button
                    className="vw-asset"
                    type="button"
                    aria-pressed={
                      preview === 'source' && source?.id === asset.id
                    }
                    onClick={() => {
                      setSource(asset);
                      setPlaying(false);
                      setPreview('source');
                    }}
                  >
                    <span className="vw-asset-image">
                      {asset.thumbnail ? (
                        <img
                          src={asset.thumbnail}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Glyph
                          name={asset.kind === 'gif' ? 'image' : asset.kind}
                          size={20}
                        />
                      )}
                    </span>
                    <span className="vw-asset-info">
                      <strong title={asset.file.name}>{asset.file.name}</strong>
                      <small>{timeLabel(asset.duration, true)}</small>
                    </span>
                  </button>
                  <button
                    className="vw-icon vw-add-asset"
                    type="button"
                    aria-label={
                      asset.kind === 'audio'
                        ? '将 ' + asset.file.name + ' 设为配乐'
                        : '添加 ' + asset.file.name + ' 到时间线'
                    }
                    disabled={importing}
                    onClick={() => append(asset)}
                  >
                    <Glyph name="add" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="vw-panel vw-monitor" aria-label="视频预览">
          <header className="vw-pane-header">
            <h2>预览</h2>
            <div className="vw-pills" role="group" aria-label="预览类型">
              <button
                type="button"
                aria-pressed={preview === 'timeline'}
                onClick={() => setPreview('timeline')}
              >
                时间线
              </button>
              <button
                type="button"
                aria-pressed={preview === 'source'}
                disabled={!source}
                onClick={() => {
                  setPlaying(false);
                  setPreview('source');
                }}
              >
                素材
              </button>
            </div>
            <button
              className="vw-icon vw-mobile-only"
              type="button"
              aria-label="打开片段设置"
              onClick={() => setDrawer(true)}
            >
              <Glyph name="panel" size={19} />
            </button>
          </header>
          <div className="vw-stage">
            {preview === 'source' && source ? (
              source.kind === 'video' ? (
                <video
                  src={source.url}
                  controls
                  playsInline
                  aria-label="原始素材预览"
                />
              ) : source.kind === 'audio' ? (
                <audio src={source.url} controls aria-label="原始音频预览" />
              ) : (
                <img src={source.url} alt="原始图片预览" />
              )
            ) : playingAsset && playingEntry && frame ? (
              <VideoMonitor
                asset={playingAsset}
                entry={playingEntry}
                frame={frame}
                framing={canvas.framing}
                transparent={visualFormat === 'gif'}
                time={position}
                duration={duration}
                playing={playing}
                soundtrack={project.soundtrack}
                audioAsset={audio}
                onTime={setTime}
                onStop={() => setPlaying(false)}
                onError={setNotice}
              />
            ) : (
              <EmptyMonitor onImport={() => mediaInput.current?.click()} />
            )}
          </div>
          <div className="vw-transport">
            <button
              type="button"
              className="vw-icon"
              disabled={!duration}
              aria-label={playing ? '暂停' : '播放'}
              aria-keyshortcuts="Space"
              title="播放或暂停（空格）"
              onClick={togglePlayback}
            >
              <Glyph name={playing ? 'pause' : 'play'} size={20} />
            </button>
            <span>
              {timeLabel(position, true)}{' '}
              <span>/ {timeLabel(duration, true)}</span>
            </span>
            <input
              type="range"
              aria-label="时间线播放位置"
              aria-valuetext={timeLabel(position, true)}
              min={0}
              max={duration || 1}
              step="any"
              value={position}
              disabled={!duration}
              onChange={(event) => seek(Number(event.target.value))}
            />
            {frame && (
              <span className="vw-frame-size">
                {frame.width} × {frame.height}
              </span>
            )}
          </div>
        </section>
        <aside className="vw-panel vw-inspector" aria-label="片段设置">
          {inspector}
        </aside>
      </div>
      <div className="vw-bottom">
        <div className="vw-edit-tools" role="group" aria-label="片段操作">
          <button
            className="vw-icon"
            type="button"
            disabled={!history.past.length}
            aria-label="撤销"
            aria-keyshortcuts="Control+Z Meta+Z"
            title="撤销（Ctrl / ⌘ + Z）"
            onClick={() => historyStep('undo')}
          >
            <Glyph name="undo" size={18} />
          </button>
          <button
            className="vw-icon"
            type="button"
            disabled={!history.future.length}
            aria-label="重做"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            title="重做（Ctrl / ⌘ + Shift + Z 或 Ctrl + Y）"
            onClick={() => historyStep('redo')}
          >
            <Glyph name="redo" size={18} />
          </button>
          <span className="vw-edit-divider" aria-hidden="true" />
          <button
            className="vw-text-button"
            type="button"
            disabled={!canSplit}
            aria-keyshortcuts="S"
            onClick={split}
            title="在播放头处分割（S）"
          >
            <Glyph name="scissors" size={17} /> 分割
          </button>
          <button
            className="vw-text-button"
            type="button"
            disabled={!selected}
            onClick={duplicate}
            aria-keyshortcuts="Control+D Meta+D"
            title="复制片段（Ctrl / ⌘ + D），也可用 Ctrl / ⌘ + C 和 V"
          >
            <Glyph name="copy" size={17} /> 复制片段
          </button>
          <button
            className="vw-text-button"
            type="button"
            disabled={!selected}
            onClick={remove}
            aria-keyshortcuts="Delete Backspace"
            title="删除片段（Delete / Backspace）"
          >
            <Glyph name="trash" size={17} /> 删除
          </button>
          <span className="vw-edit-divider" aria-hidden="true" />
          <button
            className="vw-icon"
            type="button"
            aria-label="前移片段"
            disabled={selectedIndex <= 0}
            onClick={() =>
              selected &&
              move(selected.clip.id, entries[selectedIndex - 1].clip.id)
            }
          >
            <Glyph name="arrow" size={18} style={{ rotate: '180deg' }} />
          </button>
          <button
            className="vw-icon"
            type="button"
            aria-label="后移片段"
            disabled={selectedIndex < 0 || selectedIndex >= entries.length - 1}
            onClick={() =>
              selected &&
              move(selected.clip.id, entries[selectedIndex + 1].clip.id)
            }
          >
            <Glyph name="arrow" size={18} />
          </button>
          {project.clips.length > 0 && (
            <button
              className="vw-text-button vw-clear"
              type="button"
              onClick={() => {
                change((current) => ({ ...current, ...zeroProject }));
                setTime(0);
                setPreview('timeline');
              }}
            >
              清空时间线
            </button>
          )}
        </div>
        <VideoTimeline
          entries={entries}
          assets={assets}
          selected={selected?.clip.id}
          soundtrack={project.soundtrack}
          time={position}
          onSeek={seek}
          onSelect={selectEntry}
          onTrim={updateClip}
          onMove={move}
          onSoundtrack={openAudio}
          onImport={() => mediaInput.current?.click()}
        />
      </div>
      {drawer && (
        <SettingsDrawer onClose={() => setDrawer(false)}>
          {inspector}
        </SettingsDrawer>
      )}
      {templateOpen && (
        <VideoTemplatesDialog
          canvas={canvas}
          onClose={() => setTemplateOpen(false)}
          onImport={() => {
            setTemplateOpen(false);
            setJianyingOpen(true);
          }}
          onApply={(settings) => {
            if (
              settings.template !== canvas.template ||
              settings.framing !== canvas.framing
            ) {
              change((current) => ({ ...current, canvas: settings }));
              setExportError('');
              setPreview('timeline');
            }
            setTemplateOpen(false);
          }}
        />
      )}
      {jianyingOpen && (
        <JianyingImportDialog
          onClose={() => setJianyingOpen(false)}
          onApply={(draft, nextAssets) => {
            for (const asset of nextAssets) owned.current.add(asset.url);
            setAssets(
              (current) =>
                new Map([
                  ...current,
                  ...nextAssets.map((asset) => [asset.id, asset] as const)
                ])
            );
            change(() => draft);
            setSelection(draft.clips[0]?.id);
            setSource(
              nextAssets.find((asset) => asset.id === draft.clips[0]?.assetId)
            );
            setTime(0);
            setPreview('timeline');
            selectPanel('clip');
            setNotice('');
            setExportError('');
            setJianyingOpen(false);
          }}
        />
      )}
      {exportOpen && (
        <VideoExportDialog
          options={options}
          size={frame}
          canvasLabel={importedCanvas ? '剪映画布' : template?.label}
          duration={duration}
          progress={progress}
          error={exportError}
          result={result}
          onChange={(patch) => changeExportOptions(canvas.template, patch)}
          onRun={() => void runExport()}
          onClose={closeExport}
          onCancel={() => {
            renderTask.current?.abort();
            setExportError('已取消导出，可调整设置后重试。');
          }}
        />
      )}
    </section>
  );
}
