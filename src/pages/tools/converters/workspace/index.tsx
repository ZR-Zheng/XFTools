import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Glyph from '@components/workbench/Glyph';
import useFileDrop from 'hooks/useFileDrop';
import { downloadFile, getFileExtension } from '@utils/file';
import {
  groups,
  isAudioFormat,
  audioFormats,
  presets,
  supportsFormat,
  type Group,
  type Format,
  type Preset,
  type Settings
} from './formats';
import { useConversionQueue, type Job } from './use-conversion-queue';
import '@components/workbench/workspace-theme.css';
import './conversion-workspace.css';

const categories = {
  video: {
    label: '视频',
    icon: 'video',
    description: '转码、动图与提取音频',
    source: 'MP4、WebM、MOV、MKV、AVI、GIF 等'
  },
  audio: {
    label: '音频',
    icon: 'audio',
    description: '有损与无损音频',
    source: 'MP3、M4A、WAV、FLAC、OGG 等'
  },
  image: {
    label: '图片',
    icon: 'image',
    description: '常用图片与单页 PDF',
    source: 'JPG、PNG、WebP、BMP、AVIF、HEIC、GIF'
  },
  document: {
    label: 'PDF',
    icon: 'file',
    description: '页面图片、文本与电子书',
    source: 'PDF 文档'
  }
};
const groupKeys = Object.keys(categories) as Group[];
const presetNames = { high: '高质量', balanced: '均衡', compact: '小体积' };
const primaryOutput = {
  video: 'mp4',
  audio: 'mp3',
  image: 'jpg',
  document: 'png'
} as const;
const names: Partial<Record<Format, string>> = {
  jpg: 'JPG',
  webp: 'WebP',
  webm: 'WebM'
};
const formatName = (format: Format) => names[format] ?? format.toUpperCase();

function usesPreset({ group, format }: Settings) {
  if (group === 'document') return format === 'png' || format === 'jpg';
  return !isAudioFormat(format) || Boolean(audioFormats[format].bitrate);
}

function formatHint({ group, format, preset }: Settings) {
  const spec = presets[preset];
  if (isAudioFormat(format)) {
    const prefix = group === 'video' ? '提取第一条音轨。' : '转换第一条音轨。';
    return (
      prefix +
      (audioFormats[format].bitrate
        ? `目标码率 ${spec.bitrate.slice(0, -1)} kbps。`
        : '使用无损编码。')
    );
  }
  if (group === 'video') {
    return format === 'gif'
      ? `长边最多 ${spec.gifSide} px，${spec.gifFps} 帧/秒，支持 90 秒以内的素材。`
      : `${format === 'webm' ? 'VP8 + Opus' : 'H.264 + AAC'}，长边最多 ${spec.videoSide} px。`;
  }
  if (group === 'document') {
    if (format === 'txt' || format === 'epub')
      return '提取可选中的文字。扫描件需要先做 OCR。';
    return `${spec.pdfScale}× 渲染。多页自动打包为一个 ZIP。`;
  }
  const resolution = spec.imageSide
    ? `长边最多 ${spec.imageSide} px。`
    : '保留原始分辨率。';
  if (format === 'pdf') return `每张图片生成一个单页 PDF。${resolution}`;
  if (format === 'jpg' || format === 'bmp')
    return `透明区域会填充为白色。${resolution}`;
  return `保留透明通道。${resolution}`;
}

const stateNames = {
  pending: '待转换',
  running: '转换中',
  done: '已完成',
  error: '失败',
  cancelled: '已取消'
};

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function QueueRow({
  job,
  queue
}: {
  job: Job;
  queue: ReturnType<typeof useConversionQueue>;
}) {
  const { file, status, output, settings, progress, waiting } = job;
  const extension = getFileExtension(file.name).toUpperCase();
  return (
    <li className="cw-row" aria-label={file.name} data-status={status}>
      <div className="cw-file">
        <span className="cw-file-icon" data-group={settings.group}>
          <Glyph name={categories[settings.group].icon} size={20} />
        </span>
        <div>
          <strong title={file.name}>{file.name}</strong>
          <small>
            {fileSize(file.size)}
            {extension && ` · ${extension}`}
          </small>
        </div>
      </div>
      <div className="cw-output">
        <strong>{formatName(settings.format)}</strong>
        <small>
          {usesPreset(settings) ? presetNames[settings.preset] : '默认设置'}
        </small>
      </div>
      <div className="cw-status">
        <span className="cw-state" data-state={status}>
          {status === 'done' && <Glyph name="check" size={13} />}
          {waiting ? '等待媒体引擎' : stateNames[status]}
        </span>
        {status === 'running' && !waiting && (
          <progress
            max={100}
            value={progress || undefined}
            aria-label={`${file.name} 的转换进度`}
          />
        )}
        {output && <small>{fileSize(output.size)}</small>}
      </div>
      <div className="cw-row-actions">
        {output && (
          <button
            className="cw-icon-button"
            type="button"
            title="下载结果"
            aria-label={`下载 ${file.name} 的结果`}
            onClick={() => downloadFile(output)}
          >
            <Glyph name="download" size={17} />
          </button>
        )}
        {(status === 'error' || status === 'cancelled') &&
          queue.canRetry(job) && (
            <button
              className="cw-icon-button"
              type="button"
              title="重新排队"
              aria-label={`重试 ${file.name}`}
              onClick={() => queue.retry(job.id)}
            >
              <Glyph name="redo" size={17} />
            </button>
          )}
        {status !== 'running' && (
          <button
            className="cw-icon-button"
            type="button"
            title="移除任务"
            aria-label={`移除 ${file.name}`}
            onClick={() => queue.remove(job.id)}
          >
            <Glyph name="trash" size={16} />
          </button>
        )}
      </div>
      {job.error && <p className="cw-row-error">{job.error}</p>}
    </li>
  );
}

export default function ConversionWorkspace({ title }: { title: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();
  const [settings, setSettings] = useState<Settings>(() => {
    const group =
      groupKeys.find((key) => key === params.get('group')) ?? 'video';
    const queryFormat = params.get('format') ?? '';
    return {
      group,
      format: supportsFormat(group, queryFormat)
        ? queryFormat
        : primaryOutput[group],
      preset: 'balanced',
      pages: ''
    };
  });
  const { group, format, preset, pages } = settings;
  const queue = useConversionQueue();
  const accept = [
    group === 'document' ? 'application/pdf' : `${group}/*`,
    ...groups[group].extensions.map((extension) => `.${extension}`)
  ];
  const { isDragging, dropHandlers, addFiles } = useFileDrop({
    onFiles: (files) => queue.add(files, settings)
  });
  const completedCount = queue.jobs.filter(
    (job) => job.status === 'done'
  ).length;
  const pending = queue.jobs.filter((job) => job.status === 'pending').length;
  const failed = queue.jobs.filter((job) => job.status === 'error').length;
  const setOutput = (group: Group, format: Format) =>
    setSettings((current) => ({ ...current, group, format }));
  const add = () => input.current?.click();

  return (
    <div className="workspace-theme conversion-workspace">
      <div className="cw-container">
        <header className="cw-top">
          <Link className="cw-back" to="/">
            <Glyph name="arrow" size={16} />
            返回工具箱
          </Link>
        </header>

        <section className="cw-hero">
          <span className="cw-emblem">
            <Glyph name="convert" size={30} />
          </span>
          <div>
            <h2>{title}</h2>
            <p>批量转换视频、音频、图片和 PDF，文件无需上传。</p>
          </div>
        </section>

        <nav className="cw-categories" aria-label="转换分类">
          {groupKeys.map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={group === key}
              className="cw-category"
              onClick={() =>
                setOutput(key, key === group ? format : primaryOutput[key])
              }
            >
              <span className="cw-category-icon" data-group={key}>
                <Glyph name={categories[key].icon} size={22} />
              </span>
              <span>
                <strong>{categories[key].label}</strong>
                <small>{categories[key].description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="cw-workspace-grid">
          <section
            className="cw-card cw-settings"
            aria-labelledby="cw-settings-title"
          >
            <h3 id="cw-settings-title">
              <Glyph name="panel" size={18} />
              转换设置
            </h3>
            <label className="cw-field">
              <span>输出格式</span>
              <select
                aria-label="输出格式"
                value={format}
                onChange={(event) => {
                  if (supportsFormat(group, event.target.value))
                    setOutput(group, event.target.value);
                }}
              >
                {group === 'video' ? (
                  <>
                    <optgroup label="视频和动图">
                      {groups.video.formats
                        .filter((item) => !isAudioFormat(item))
                        .map((item) => (
                          <option key={item} value={item}>
                            {formatName(item)}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="仅提取音频">
                      {groups.video.formats
                        .filter(isAudioFormat)
                        .map((item) => (
                          <option key={item} value={item}>
                            {formatName(item)}
                          </option>
                        ))}
                    </optgroup>
                  </>
                ) : (
                  groups[group].formats.map((item) => (
                    <option key={item} value={item}>
                      {formatName(item)}
                    </option>
                  ))
                )}
              </select>
            </label>
            {usesPreset(settings) && (
              <fieldset className="cw-presets">
                <legend>输出预设</legend>
                <div>
                  {(Object.keys(presetNames) as Preset[]).map((key) => (
                    <label key={key}>
                      <input
                        type="radio"
                        name="conversion-preset"
                        checked={preset === key}
                        onChange={() =>
                          setSettings((current) => ({
                            ...current,
                            preset: key
                          }))
                        }
                      />
                      <span>{presetNames[key]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {group === 'document' && (
              <label className="cw-field">
                <span>页码范围</span>
                <input
                  type="text"
                  value={pages}
                  maxLength={240}
                  placeholder="全部页面，例如 1,3-5"
                  onChange={(event) =>
                    setSettings({ ...settings, pages: event.target.value })
                  }
                />
              </label>
            )}
            <p className="cw-format-hint" aria-live="polite">
              {formatHint(settings)}
            </p>
            {group === 'image' && (
              <p className="cw-settings-note">
                图片模式取动图首帧。保留动画请使用视频分类。
              </p>
            )}
            <p className="cw-settings-note">
              设置会在添加文件时保存到对应任务。
            </p>
          </section>

          <section
            className="cw-card cw-queue"
            aria-labelledby="cw-queue-title"
          >
            <div className="cw-queue-head">
              <h3 id="cw-queue-title">
                <Glyph name="list" size={18} />
                转换队列 <span>{queue.jobs.length}</span>
              </h3>
              <button
                className="cw-button cw-secondary"
                type="button"
                onClick={add}
              >
                <Glyph name="add" size={17} />
                添加文件
              </button>
              <input
                ref={input}
                type="file"
                multiple
                accept={accept.join(',')}
                hidden
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
            <div
              className={`cw-drop${isDragging ? ' is-dragging' : ''}${queue.jobs.length ? ' has-jobs' : ''}`}
              {...dropHandlers}
            >
              <button
                type="button"
                onClick={add}
                aria-label={`选择${categories[group].label}文件`}
              >
                <span className="cw-drop-icon">
                  <Glyph name="upload" size={22} />
                </span>
                <span>
                  <strong>
                    拖放{categories[group].label}文件到此处，或点击选择
                  </strong>
                  <small>{categories[group].source} · 单文件最多 150 MB</small>
                </span>
              </button>
            </div>
            {!!queue.jobs.length && (
              <div className="cw-list">
                <div className="cw-columns" aria-hidden="true">
                  <span>源文件</span>
                  <span>输出</span>
                  <span>状态</span>
                  <span>操作</span>
                </div>
                <ul aria-label="转换任务">
                  {queue.jobs.map((job) => (
                    <QueueRow key={job.id} job={job} queue={queue} />
                  ))}
                </ul>
              </div>
            )}
            {queue.notice && (
              <p className="cw-notice" role="alert">
                {queue.notice}
              </p>
            )}
            <footer className="cw-queue-footer">
              <span role="status">
                {pending} 项待转换 · {completedCount} 项完成
                {failed > 0 && ` · ${failed} 项失败`}
              </span>
              <div className="cw-queue-actions">
                {completedCount > 0 && (
                  <button
                    className="cw-button cw-quiet"
                    type="button"
                    onClick={queue.clearCompleted}
                  >
                    清理已完成
                  </button>
                )}
                {completedCount > 0 && (
                  <button
                    className="cw-button cw-secondary"
                    type="button"
                    disabled={queue.packing}
                    onClick={() => void queue.downloadAll()}
                  >
                    <Glyph name="download" size={16} />
                    {queue.packing ? '打包中…' : '下载 ZIP'}
                  </button>
                )}
                {queue.running ? (
                  <button
                    className="cw-button cw-secondary"
                    type="button"
                    onClick={queue.cancel}
                  >
                    <Glyph name="close" size={17} />
                    停止转换
                  </button>
                ) : (
                  <button
                    className="cw-button cw-primary"
                    type="button"
                    disabled={!pending}
                    onClick={() => void queue.start()}
                  >
                    <Glyph name="play" size={16} />
                    开始转换
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}
