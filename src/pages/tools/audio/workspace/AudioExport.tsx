import { useEffect, useRef } from 'react';
import Glyph from '@components/workbench/Glyph';
import useObjectUrl from 'hooks/useObjectUrl';
import { downloadFile } from '@utils/file';
import {
  AUDIO_FORMATS,
  type AudioFormat
} from '../../converters/audio-converter/types';
import type { AudioExportOptions, Status } from './engine';
import { timeText } from './project';

const labels = {
  queue: '等待其他媒体任务…',
  load: '正在加载导出引擎…',
  encode: '正在生成音频…'
};

export function AudioDialog({
  title,
  className = '',
  onClose,
  children
}: {
  title: string;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`aw-dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="aw-panel-head">
        <h2>{title}</h2>
        <button
          className="aw-icon"
          type="button"
          aria-label={`关闭${title}`}
          onClick={onClose}
        >
          <Glyph name="close" size={18} />
        </button>
      </header>
      <div className="aw-dialog-body">{children}</div>
    </dialog>
  );
}

function ExportedAudio({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return (
    <section className="aw-export-result" aria-label="导出结果">
      <strong>{file.name}</strong>
      <audio src={url} controls preload="metadata" aria-label="成片试听" />
      <button
        type="button"
        className="primary-button"
        onClick={() => downloadFile(file)}
      >
        <Glyph name="download" size={17} /> 下载音频
      </button>
    </section>
  );
}

export default function AudioExport({
  options,
  status,
  error,
  file,
  duration,
  onOptions,
  onRun,
  onCancel,
  onClose
}: {
  options: AudioExportOptions;
  status: Status | null;
  error: string;
  file: File | null;
  duration: number;
  onOptions: (options: AudioExportOptions) => void;
  onRun: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <AudioDialog title="导出音频" onClose={status ? onCancel : onClose}>
      <fieldset className="aw-export-fields" disabled={!!status}>
        <label className="aw-field">
          <span>导出格式</span>
          <select
            className="ui-input"
            value={options.format}
            onChange={(event) =>
              onOptions({
                ...options,
                format: event.target.value as AudioFormat
              })
            }
          >
            {Object.keys(AUDIO_FORMATS).map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <div className="aw-pair">
          <label className="aw-field">
            <span>采样率</span>
            <select
              className="ui-input"
              value={options.sampleRate}
              onChange={(event) =>
                onOptions({
                  ...options,
                  sampleRate: event.target.value === '48000' ? '48000' : '44100'
                })
              }
            >
              <option value="44100">44.1 kHz</option>
              <option value="48000">48 kHz</option>
            </select>
          </label>
          <label className="aw-field">
            <span>声道</span>
            <select
              className="ui-input"
              value={options.channels}
              onChange={(event) =>
                onOptions({
                  ...options,
                  channels: event.target.value === '1' ? '1' : '2'
                })
              }
            >
              <option value="1">单声道</option>
              <option value="2">立体声</option>
            </select>
          </label>
        </div>
        {AUDIO_FORMATS[options.format].bitrate && (
          <label className="aw-field">
            <span>比特率</span>
            <select
              className="ui-input"
              value={options.bitrate}
              onChange={(event) =>
                onOptions({
                  ...options,
                  bitrate: event.target.value as AudioExportOptions['bitrate']
                })
              }
            >
              <option value="128k">128 kbps</option>
              <option value="192k">192 kbps</option>
              <option value="256k">256 kbps</option>
            </select>
          </label>
        )}
      </fieldset>
      <p className="aw-muted">预计时长 {timeText(duration)}</p>
      {status && (
        <div className="aw-export-progress" role="status">
          <span>
            {labels[status.stage]}{' '}
            {status.progress !== undefined && `${status.progress}%`}
          </span>
          <progress max={100} value={status.progress} />
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消导出
          </button>
        </div>
      )}
      {error && (
        <p className="aw-error" role="alert">
          {error}
        </p>
      )}
      {!status && !file && (
        <button type="button" className="primary-button" onClick={onRun}>
          开始导出
        </button>
      )}
      {file && <ExportedAudio file={file} />}
    </AudioDialog>
  );
}
