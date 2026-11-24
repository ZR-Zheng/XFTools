import { useEffect, useRef } from 'react';
import Glyph from '@components/workbench/Glyph';
import useObjectUrl from 'hooks/useObjectUrl';
import { downloadFile } from '@utils/file';
import { timeLabel } from './timeline';
import type { ExportOptions } from './export-settings';
import type { ExportProgress } from './export';

const labels = {
  queue: '正在等待其他视频导出…',
  load: '正在装载导出引擎…',
  prepare: '正在分析时间线素材…',
  encode: '正在编码…'
};

function ExportResult({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return (
    <section className="vw-export-result" aria-label="导出结果">
      <span role="status">导出完成</span>
      <strong title={file.name}>{file.name}</strong>
      {file.type.startsWith('video/') && (
        <video src={url} controls playsInline aria-label="导出成片预览" />
      )}
      {file.type.startsWith('audio/') && (
        <audio src={url} controls aria-label="导出音频预览" />
      )}
      {file.type.startsWith('image/') && url && (
        <img src={url} alt="导出的 GIF" />
      )}
      <button
        className="primary-button"
        type="button"
        onClick={() => downloadFile(file)}
      >
        <Glyph name="download" size={17} /> 下载文件
      </button>
    </section>
  );
}

interface Props {
  options: ExportOptions;
  size?: { width: number; height: number };
  canvasLabel?: string;
  duration: number;
  progress: ExportProgress | null;
  error: string;
  result: File | null;
  onChange: (patch: Partial<ExportOptions>) => void;
  onRun: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export default function VideoExportDialog({
  options,
  size,
  canvasLabel,
  duration,
  progress,
  error,
  result,
  onChange,
  onRun,
  onCancel,
  onClose
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);
  const busy = !!progress;
  return (
    <dialog
      className="vw-dialog"
      ref={dialog}
      aria-labelledby="vw-export-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="vw-pane-header">
        <h2 id="vw-export-title">导出时间线</h2>
        <button
          type="button"
          className="vw-icon"
          disabled={busy}
          aria-label="关闭导出"
          onClick={onClose}
        >
          <Glyph name="close" size={18} />
        </button>
      </header>
      <div className="vw-dialog-content">
        <fieldset disabled={busy} className="vw-export-fields">
          <label className="vw-field">
            <span>导出格式</span>
            <select
              className="ui-input"
              value={options.format}
              onChange={(event) =>
                onChange({
                  format: event.target.value as ExportOptions['format']
                })
              }
            >
              <option value="mp4">MP4 视频</option>
              <option value="gif">GIF 动图</option>
              <option value="mp3">MP3 音频</option>
              <option value="aac">AAC 音频</option>
              <option value="wav">WAV 音频</option>
            </select>
          </label>
          {options.format === 'mp4' && (
            <div className="vw-field-grid">
              <label className="vw-field">
                <span>输出分辨率</span>
                <select
                  className="ui-input"
                  value={options.resolution}
                  onChange={(event) =>
                    onChange({
                      resolution: event.target
                        .value as ExportOptions['resolution']
                    })
                  }
                >
                  <option value="source">
                    {canvasLabel ? '按首段清晰度' : '跟随首段画面'}
                  </option>
                  <option value="480">480p</option>
                  <option value="720">720p</option>
                  <option value="1080">1080p</option>
                </select>
              </label>
              <label className="vw-field">
                <span>压缩设置</span>
                <select
                  className="ui-input"
                  value={options.quality}
                  onChange={(event) =>
                    onChange({
                      quality: event.target.value as ExportOptions['quality']
                    })
                  }
                >
                  <option value="high">画质优先</option>
                  <option value="balanced">均衡</option>
                  <option value="small">体积优先</option>
                </select>
              </label>
            </div>
          )}
          {options.format === 'gif' && (
            <div className="vw-field-grid">
              <label className="vw-field">
                <span>最长边上限</span>
                <select
                  className="ui-input"
                  value={options.gifWidth}
                  onChange={(event) =>
                    onChange({ gifWidth: Number(event.target.value) })
                  }
                >
                  {[240, 320, 480, 640].map((size) => (
                    <option key={size} value={size}>
                      {size} px
                    </option>
                  ))}
                </select>
              </label>
              <label className="vw-field">
                <span>帧率</span>
                <select
                  className="ui-input"
                  value={options.gifFps}
                  onChange={(event) =>
                    onChange({ gifFps: Number(event.target.value) })
                  }
                >
                  {[5, 10, 15, 24, 30, 50, 60].map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} fps
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>
        <div className="vw-export-summary">
          <span>
            <Glyph name="clock" size={16} /> {timeLabel(duration, true)}
          </span>
          {size && (options.format === 'mp4' || options.format === 'gif') && (
            <span>
              {canvasLabel && `${canvasLabel} · `}
              {size.width} × {size.height} px
            </span>
          )}
        </div>
        {!duration && <p className="vw-muted">添加视频或图片后即可导出。</p>}
        {progress && (
          <div className="vw-export-progress" role="status">
            <span>
              {labels[progress.stage]}{' '}
              {progress.percent === undefined ? '' : progress.percent + '%'}
            </span>
            <progress
              max={100}
              value={progress.percent}
              aria-label="导出进度"
            />
          </div>
        )}
        {error && (
          <p className="vw-error" role="alert">
            {error}
          </p>
        )}
        {result && <ExportResult file={result} />}
        {busy ? (
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消导出
          </button>
        ) : (
          !result && (
            <button
              className="primary-button"
              type="button"
              data-testid="process-tool"
              disabled={!duration}
              onClick={onRun}
            >
              开始导出 <Glyph name="arrow" size={17} />
            </button>
          )
        )}
      </div>
    </dialog>
  );
}
