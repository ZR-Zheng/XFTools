import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Glyph from '@components/workbench/Glyph';
import useFileDrop from 'hooks/useFileDrop';
import { getFileExtension } from '@utils/file';
import {
  AUDIO_FORMATS,
  type AudioFormat
} from '../../converters/audio-converter/types';
import AudioInspector, {
  NumberField,
  type InspectorTab
} from './AudioInspector';
import AudioExport, { AudioDialog } from './AudioExport';
import WaveTimeline, { type Lane } from './WaveTimeline';
import type { AudioExportOptions, Status } from './engine';
import { audioTypes, openAudio } from './media';
import { AudioPreview } from './player';
import {
  clamp,
  clipDuration,
  editRange,
  emptyHistory,
  minClip,
  newClip,
  placeAudio,
  sliceAudio,
  stepHistory,
  timeText,
  type Asset,
  type Clip,
  type Entry,
  type Project,
  type Range
} from './project';
import '@components/workbench/workspace-theme.css';
import './audio-workspace.css';


export default function AudioWorkspace({ title }: { title: string }) {
  const [params, setParams] = useSearchParams();
  const preset = params.get('panel');
  const [history, dispatch] = useReducer(stepHistory, emptyHistory);
  const project = history.present;
  const current = useRef(project);
  current.current = project;
  const [assets, setAssets] = useState(() => new Map<string, Asset>());
  const [tab, setTab] = useState<InspectorTab>(
    preset === 'effects' || preset === 'loop' ? preset : 'clip'
  );
  const [lane, setLane] = useState<Lane>('main');
  const [selected, setSelected] = useState<string>();
  const [cursor, setCursor] = useState(0);
  const [range, setRange] = useState<Range | null>(null);
  const [playing, setPlaying] = useState(false);
  const [repeatPreview, setRepeatPreview] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [options, setOptions] = useState<AudioExportOptions>({
    format: 'mp3',
    sampleRate: '44100',
    channels: '2',
    bitrate: '192k'
  });
  const [status, setStatus] = useState<Status | null>(null);
  const [output, setOutput] = useState<File | null>(null);
  const [exportError, setExportError] = useState('');
  const [notice, setNotice] = useState('');
  const [opening, setOpening] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const mixInput = useRef<HTMLInputElement>(null);
  const mediaTask = useRef<AbortController>(null);
  const exportTask = useRef<AbortController>(null);
  const preview = useRef<AudioPreview>(null);
  const owned = useRef(new Set<string>());

  const entries = useMemo(() => placeAudio(project.clips), [project.clips]);
  const mix =
    (project.mix && {
      clip: project.mix.clip,
      start: project.mix.offset,
      end: project.mix.offset + clipDuration(project.mix.clip)
    }) ||
    undefined;
  const mainEnd = entries.at(-1)?.end ?? 0;
  const duration = Math.max(mainEnd, mix?.end ?? 0);
  const position = clamp(cursor, 0, duration);
  const focused =
    lane === 'mix'
      ? mix
      : (entries.find((item) => item.clip.id === selected) ??
        entries.find((item) => item.end > position) ??
        entries.at(-1));
  const asset = focused && assets.get(focused.clip.assetId);
  const selectedIndex = focused ? entries.indexOf(focused) : -1;
  const target = entries.find(
    (item) => item.start + minClip <= position && item.end - minClip >= position
  );
  const limit =
    lane === 'main'
      ? { start: 0, end: mainEnd }
      : { start: mix?.start ?? 0, end: mix?.end ?? 0 };
  const selection = range && {
    start: clamp(range.start, limit.start, limit.end),
    end: clamp(range.end, limit.start, limit.end)
  };
  const start = selection?.start ?? limit.start;
  const end = selection?.end ?? limit.end;
  const hasRange = !!selection && end - start >= minClip;

  useEffect(
    () => () => {
      mediaTask.current?.abort();
      exportTask.current?.abort();
      preview.current?.destroy();
      for (const url of owned.current) URL.revokeObjectURL(url);
      owned.current.clear();
    },
    []
  );

  function stop() {
    preview.current?.stop();
    setPlaying(false);
  }

  useEffect(() => {
    const pauseHidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', pauseHidden);
    return () => document.removeEventListener('visibilitychange', pauseHidden);
  }, []);

  function change(next: Project | 'undo' | 'redo', clear = true) {
    stop();
    dispatch(next);
    setOutput(null);
    setExportError('');
    if (clear) setRange(null);
  }

  function seek(time: number) {
    stop();
    setCursor(clamp(time, 0, duration));
  }

  function choose(item: Entry, track: Lane) {
    setLane(track);
    setSelected(item.clip.id);
    setRange(null);
    seek(item.start);
  }

  function selectWave(track: Lane, time: number, next: Range | null) {
    const item =
      track === 'mix'
        ? mix
        : (entries.find((entry) => entry.end > time) ?? entries.at(-1));
    setLane(track);
    setSelected(item?.clip.id);
    setRange(next);
    seek(time);
  }

  async function addFiles(files: File[], destination: Lane) {
    if (mediaTask.current || exportTask.current || !files.length) return;
    const task = new AbortController();
    mediaTask.current = task;
    stop();
    setNotice('');
    const staged: Asset[] = [];
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setOpening(`正在读取素材 ${index + 1} / ${files.length}…`);
        try {
          staged.push(await openAudio(file, task.signal));
        } catch {
          if (task.signal.aborted) return;
          failures.push(file.name);
        }
      }
      if (task.signal.aborted) return;
      if (staged.length) {
        setAssets(
          (prior) =>
            new Map([
              ...prior,
              ...staged.map((asset) => [asset.id, asset] as const)
            ])
        );
        for (const asset of staged) owned.current.add(asset.url);
        const prior = current.current;
        const clips = staged.map(newClip);
        const offset =
          destination === 'mix'
            ? (prior.mix?.offset ?? 0)
            : (placeAudio(prior.clips).at(-1)?.end ?? 0);
        const clip = clips[0];
        change(
          destination === 'mix'
            ? { ...prior, mix: { clip, offset } }
            : { ...prior, clips: [...prior.clips, ...clips] }
        );
        setLane(destination);
        setSelected(clip.id);
        setCursor(offset);
        if (!prior.clips.length && !prior.mix && preset === 'loop') {
          const extension = getFileExtension(staged[0].file.name);
          if (Object.hasOwn(AUDIO_FORMATS, extension))
            setOptions((prior) => ({
              ...prior,
              format: extension as AudioFormat
            }));
        }
        if (preset === 'export') setExportOpen(true);
      }
      if (failures.length)
        setNotice(`无法读取 ${failures.join('、')}，请检查文件是否包含音频。`);
    } finally {
      if (task.signal.aborted)
        for (const asset of staged) URL.revokeObjectURL(asset.url);
      mediaTask.current = null;
      setOpening('');
    }
  }

  const {
    addFiles: dropMain,
    isDragging,
    dropHandlers
  } = useFileDrop({
    accept: audioTypes,
    onFiles: (files) => addFiles(files, 'main')
  });
  const { addFiles: dropMix } = useFileDrop({
    accept: audioTypes,
    onFiles: (files) => addFiles(files.slice(0, 1), 'mix')
  });

  function append(asset: Asset, destination: Lane) {
    if (opening) return;
    const clip = newClip(asset);
    const offset =
      destination === 'main' ? mainEnd : (project.mix?.offset ?? 0);
    change(
      destination === 'main'
        ? { ...project, clips: [...project.clips, clip] }
        : { ...project, mix: { clip, offset } }
    );
    setSelected(clip.id);
    setLane(destination);
    setCursor(offset);
  }

  function changeClip(clip: Clip) {
    if (lane === 'mix' && project.mix)
      change({ ...project, mix: { ...project.mix, clip } });
    else
      change({
        ...project,
        clips: project.clips.map((item) => (item.id === clip.id ? clip : item))
      });
  }

  function move(id: string, target: string) {
    if (id === target || opening) return;
    const clips = [...project.clips];
    const from = clips.findIndex((clip) => clip.id === id);
    const to = clips.findIndex((clip) => clip.id === target);
    if (from < 0 || to < 0) return;
    const [clip] = clips.splice(from, 1);
    clips.splice(to, 0, clip);
    change({ ...project, clips });
    setLane('main');
    setSelected(clip.id);
    setCursor(placeAudio(clips)[to].start);
  }

  function split() {
    if (!target || lane !== 'main' || opening) return;
    const left = sliceAudio(target, target.start, position);
    const right = sliceAudio(target, position, target.end, crypto.randomUUID());
    if (!left || !right) return;
    change({
      ...project,
      clips: project.clips.flatMap((clip) =>
        clip.id === target.clip.id ? [left, right] : [clip]
      )
    });
    setSelected(right.id);
  }

  function trimRange(keep: boolean) {
    if (!hasRange || lane !== 'main' || opening) return;
    const clips = editRange(project.clips, { start, end }, keep);
    change({ ...project, clips });
    setCursor(keep ? 0 : start);
    setSelected(clips[0]?.id);
  }

  function remove() {
    if (!focused || opening) return;
    if (lane === 'main' && hasRange) return trimRange(false);
    change(
      lane === 'mix'
        ? { ...project, mix: null }
        : {
            ...project,
            clips: project.clips.filter((item) => item.id !== focused.clip.id)
          }
    );
    setSelected(undefined);
  }

  function duplicate(count = 2) {
    if (!focused || lane !== 'main' || opening) return;
    const extras = Array.from({ length: count - 1 }, () => ({
      ...focused.clip,
      id: crypto.randomUUID()
    }));
    change({
      ...project,
      clips: project.clips.flatMap((clip) =>
        clip.id === focused.clip.id ? [clip, ...extras] : [clip]
      )
    });
    setSelected(extras[0]?.id);
    setCursor(focused.end);
  }

  function play(onlySelection = false) {
    if (playing && !onlySelection) {
      stop();
      return;
    }
    if (!duration || opening) return;
    const focusedRange = hasRange
      ? { start, end }
      : focused
        ? { start: focused.start, end: focused.end }
        : { start: 0, end: duration };
    const bounds =
      onlySelection || repeatPreview
        ? focusedRange
        : { start: 0, end: duration };
    if (
      ![...entries, ...(mix ? [mix] : [])].some(
        (entry) =>
          entry.start < bounds.end &&
          entry.end > bounds.start &&
          assets.get(entry.clip.assetId)?.playable
      )
    ) {
      setNotice('当前范围没有浏览器可试听的音频，仍可编辑并导出。');
      return;
    }
    const point =
      onlySelection || position < bounds.start || position >= bounds.end - 0.005
        ? bounds.start
        : position;
    setNotice('');
    setCursor(point);
    setPlaying(true);
    preview.current ??= new AudioPreview();
    void preview.current
      .play({
        entries,
        mix,
        assets,
        position: point,
        range: bounds,
        repeat: repeatPreview,
        onTime: setCursor,
        onStop: (error) => {
          setPlaying(false);
          if (error) setNotice(error);
        }
      })
      .catch(() => {
        stop();
        setNotice('无法启动试听，请检查浏览器的音频播放权限。');
      });
  }

  function openExport() {
    stop();
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

  async function renderAudio() {
    if (!duration || exportTask.current || mediaTask.current) return;
    const task = new AbortController();
    exportTask.current = task;
    setStatus({ stage: 'load' });
    setExportError('');
    setOutput(null);
    try {
      const { exportAudio } = await import('./engine');
      const result = await exportAudio(
        project,
        assets,
        options,
        task.signal,
        setStatus
      );
      if (!task.signal.aborted) setOutput(result);
    } catch (error) {
      if (!task.signal.aborted)
        setExportError(
          error instanceof Error && /[\u3400-\u9fff]/.test(error.message)
            ? error.message
            : '无法导出音频，请核对素材或尝试不同的输出格式。'
        );
    } finally {
      exportTask.current = null;
      setStatus(null);
    }
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const element = event.target as HTMLElement | null;
    if (
      drawer ||
      exportOpen ||
      opening ||
      event.altKey ||
      event.isComposing ||
      event.defaultPrevented ||
      element?.closest('textarea,input,select,[contenteditable],dialog')
    )
      return;
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    let action: (() => void) | undefined;
    if (command) {
      if (key === 'z') action = () => change(event.shiftKey ? 'redo' : 'undo');
      if (key === 'y' && event.ctrlKey && !event.shiftKey)
        action = () => change('redo');
      if (key === 'd' && focused && lane === 'main') action = () => duplicate();
    } else if (duration) {
      if (
        event.code === 'Space' &&
        !element?.closest('button:focus-visible,a:focus-visible')
      )
        action = () => play();
      if (!event.shiftKey && key === 's' && target && lane === 'main')
        action = split;
      if (key === 'delete' || key === 'backspace') action = remove;
      if (key === 'arrowleft' || key === 'arrowright')
        action = () =>
          seek(
            position +
              (event.shiftKey ? 1 : 0.1) * (key === 'arrowleft' ? -1 : 1)
          );
      if (key === 'home' || key === 'end')
        action = () => seek(key === 'home' ? 0 : duration);
    }
    if (!action) return;
    event.preventDefault();
    if (!event.repeat || key.startsWith('arrow')) action();
  });
  useEffect(() => {
    const listen = (event: KeyboardEvent) => handleKey(event);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, []);

  const inspector = (
    <AudioInspector
      selected={focused}
      asset={asset}
      lane={lane}
      tab={tab}
      onTab={setTab}
      onChange={changeClip}
      onOffset={(offset) =>
        project.mix && change({ ...project, mix: { ...project.mix, offset } })
      }
      onRepeat={duplicate}
    />
  );

  return (
    <section
      className={
        'workspace-theme audio-workspace' + (isDragging ? ' is-dragging' : '')
      }
      aria-label={title}
      {...dropHandlers}
    >
      <input
        ref={input}
        hidden
        type="file"
        multiple
        aria-label="导入音频素材"
        accept={audioTypes.join(',')}
        onChange={(event) => {
          if (event.currentTarget.files?.length)
            void dropMain(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={mixInput}
        hidden
        type="file"
        aria-label="导入混音音频"
        accept={audioTypes.join(',')}
        onChange={(event) => {
          if (event.currentTarget.files?.length)
            void dropMix(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <header className="aw-header">
        <Link
          to="/"
          className="aw-icon"
          aria-label="返回工具箱"
          title="返回工具箱"
        >
          <Glyph name="arrow" size={20} style={{ rotate: '180deg' }} />
        </Link>
        <div className="aw-title">
          <Glyph name="audio" size={20} />
          <strong aria-hidden="true">{title}</strong>
        </div>
        <div className="aw-header-actions">
          <button
            type="button"
            className="secondary-button aw-import"
            disabled={!!opening}
            onClick={() => input.current?.click()}
          >
            <Glyph name="upload" size={16} /> 导入
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!duration || !!opening}
            onClick={openExport}
          >
            <Glyph name="download" size={16} /> 导出
          </button>
        </div>
      </header>
      {notice && (
        <p className="aw-error" role="alert">
          {notice}
        </p>
      )}
      <div className="aw-layout">
        <section className="aw-panel aw-library" aria-label="音频素材">
          <header className="aw-panel-head">
            <h2>素材</h2>
            {assets.size > 0 && <small>{assets.size} 个</small>}
          </header>
          {opening && (
            <div className="aw-opening" role="status">
              <span>{opening}</span>
              <button
                type="button"
                className="aw-icon"
                aria-label="取消导入"
                onClick={() => mediaTask.current?.abort()}
              >
                <Glyph name="close" size={16} />
              </button>
            </div>
          )}
          {!assets.size && !opening && (
            <button
              className="aw-library-empty"
              type="button"
              onClick={() => input.current?.click()}
            >
              <Glyph name="add" size={18} /> 导入音频文件
            </button>
          )}
          {assets.size > 0 && (
            <ul>
              {[...assets.values()].map((asset) => (
                <li key={asset.id}>
                  <Glyph name="audio" size={16} />{' '}
                  <span className="aw-library-file">
                    <strong title={asset.file.name}>{asset.file.name}</strong>
                    <small>{timeText(asset.duration)}</small>
                  </span>
                  <button
                    type="button"
                    className="aw-icon"
                    title="添加到剪辑轨"
                    aria-label={`添加 ${asset.file.name} 到剪辑轨`}
                    disabled={!!opening}
                    onClick={() => append(asset, 'main')}
                  >
                    <Glyph name="add" size={16} />
                  </button>
                  <button
                    type="button"
                    className="aw-icon"
                    title="设为混音"
                    aria-label={`将 ${asset.file.name} 设为混音`}
                    disabled={!!opening}
                    onClick={() => append(asset, 'mix')}
                  >
                    <Glyph name="convert" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="aw-panel aw-board" aria-label="音频编辑">
          <div className="aw-transport">
            <button
              type="button"
              className="aw-icon"
              aria-label="回到开头"
              disabled={!duration}
              onClick={() => seek(0)}
            >
              <Glyph name="arrow" size={17} style={{ rotate: '180deg' }} />
            </button>
            <button
              type="button"
              className="aw-icon aw-play"
              aria-label={playing ? '暂停' : '播放'}
              aria-keyshortcuts="Space"
              disabled={!duration || !!opening}
              onClick={() => play()}
            >
              <Glyph name={playing ? 'pause' : 'play'} size={19} />
            </button>
            <output className="aw-clock" aria-label="播放头时间">
              {timeText(position)} <small>/ {timeText(duration)}</small>
            </output>
            <button
              type="button"
              className="aw-text-button aw-mobile"
              disabled={!focused}
              onClick={() => setDrawer(true)}
              aria-label="打开片段参数"
            >
              <Glyph name="panel" size={17} /> 参数
            </button>
            <button
              type="button"
              className="aw-text-button aw-loop-toggle"
              aria-pressed={repeatPreview}
              disabled={!duration}
              onClick={() => {
                stop();
                setRepeatPreview(!repeatPreview);
              }}
            >
              <Glyph name="redo" size={16} /> 循环试听
            </button>
          </div>
          {!duration && (
            <button
              type="button"
              className="aw-drop"
              onClick={() => input.current?.click()}
            >
              <span>
                <Glyph name="audio" size={25} />
              </span>
              <strong>拖放音频，开始编辑</strong>
              <small>也可点击导入 MP3、WAV、FLAC 等素材</small>
            </button>
          )}
          <WaveTimeline
            entries={entries}
            mix={mix}
            assets={assets}
            duration={duration}
            position={position}
            range={selection}
            lane={lane}
            selected={focused?.clip.id}
            onSelect={selectWave}
            onClip={choose}
            onMove={move}
            onImport={() => input.current?.click()}
            onMix={() => mixInput.current?.click()}
          />
          <div className="aw-edit-tools" role="group" aria-label="片段编辑">
            <button
              type="button"
              className="aw-icon"
              aria-label="撤销"
              title="撤销（Ctrl / ⌘ + Z）"
              disabled={!history.past.length || !!opening}
              onClick={() => change('undo')}
            >
              <Glyph name="undo" size={18} />
            </button>
            <button
              type="button"
              className="aw-icon"
              aria-label="重做"
              title="重做（Ctrl / ⌘ + Shift + Z）"
              disabled={!history.future.length || !!opening}
              onClick={() => change('redo')}
            >
              <Glyph name="redo" size={18} />
            </button>
            <button
              type="button"
              className="aw-text-button"
              disabled={!target || lane !== 'main' || !!opening}
              title="在播放头处分割（S）"
              onClick={split}
            >
              <Glyph name="scissors" size={16} /> 分割
            </button>
            <button
              type="button"
              className="aw-text-button"
              disabled={!hasRange || lane !== 'main' || !!opening}
              onClick={() => trimRange(true)}
            >
              保留选区
            </button>
            <button
              type="button"
              className="aw-text-button"
              disabled={!focused || !!opening}
              title="删除（Delete）"
              onClick={remove}
            >
              <Glyph name="trash" size={16} />{' '}
              {hasRange && lane === 'main' ? '删除选区' : '删除'}
            </button>
            <button
              type="button"
              className="aw-icon"
              aria-label="复制片段"
              title="复制片段（Ctrl / ⌘ + D）"
              disabled={lane !== 'main' || !focused || !!opening}
              onClick={() => duplicate()}
            >
              <Glyph name="copy" size={17} />
            </button>
            <button
              type="button"
              className="aw-icon"
              aria-label="前移片段"
              disabled={selectedIndex <= 0 || !!opening}
              onClick={() =>
                focused &&
                move(focused.clip.id, entries[selectedIndex - 1].clip.id)
              }
            >
              <Glyph name="arrow" size={17} style={{ rotate: '180deg' }} />
            </button>
            <button
              type="button"
              className="aw-icon"
              aria-label="后移片段"
              disabled={
                selectedIndex < 0 ||
                selectedIndex >= entries.length - 1 ||
                !!opening
              }
              onClick={() =>
                focused &&
                move(focused.clip.id, entries[selectedIndex + 1].clip.id)
              }
            >
              <Glyph name="arrow" size={17} />
            </button>
          </div>
          <div className="aw-selection" aria-label="时间与选区">
            <NumberField
              label="播放位置（秒）"
              value={position}
              min={0}
              max={duration}
              disabled={!duration}
              onChange={seek}
            />
            <NumberField
              label="选区起点（秒）"
              value={start}
              min={limit.start}
              max={end}
              disabled={limit.end <= limit.start}
              onChange={(start) => {
                setRange({ start, end });
                seek(start);
              }}
            />
            <NumberField
              label="选区终点（秒）"
              value={end}
              min={start}
              max={limit.end}
              disabled={limit.end <= limit.start}
              onChange={(end) => {
                setRange({ start, end });
                seek(start);
              }}
            />
            <button
              type="button"
              className="secondary-button"
              disabled={!focused || !!opening}
              onClick={() => play(true)}
            >
              <Glyph name="play" size={15} /> 播放选区
            </button>
          </div>
        </section>
        <aside className="aw-panel aw-inspector" aria-label="片段参数">
          <header className="aw-panel-head">
            <h2>片段参数</h2>
          </header>
          <div className="aw-parameters">{inspector}</div>
        </aside>
      </div>
      {drawer && (
        <AudioDialog
          title="片段参数"
          className="aw-drawer"
          onClose={() => setDrawer(false)}
        >
          {inspector}
        </AudioDialog>
      )}
      {exportOpen && (
        <AudioExport
          options={options}
          status={status}
          error={exportError}
          file={output}
          duration={duration}
          onOptions={(next) => {
            setOptions(next);
            setOutput(null);
            setExportError('');
          }}
          onRun={() => void renderAudio()}
          onClose={closeExport}
          onCancel={() => {
            exportTask.current?.abort();
            setExportError('已取消导出，可调整参数后重试。');
          }}
        />
      )}
    </section>
  );
}
