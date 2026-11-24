import { useState } from 'react';
import { downloadFile } from '@utils/file';
import {
  runBackgroundTask,
  type BackgroundMode,
  type BackgroundResult
} from './background-task';
import ImageTaskStatus from './ImageTaskStatus';
import { decodeImage } from './render-image';
import { snapshotFile, type ImageSnapshot } from './snapshot';
import type { ImageSource } from './session';
import useImageTask from './use-image-task';

export type ImageComparison = { snapshot: ImageSnapshot; result: ImageSource };

export default function ImageBackgroundPanel({
  snapshot,
  comparing,
  disabled,
  onPreview,
  onApply
}: {
  snapshot: ImageSnapshot | null;
  comparing: boolean;
  disabled: boolean;
  onPreview: (comparison: ImageComparison | null) => void;
  onApply: (comparison: ImageComparison) => void;
}) {
  const [mode, setMode] = useState<BackgroundMode>('auto');
  const task = useImageTask<{
    image: ImageSource;
    method: BackgroundResult['method'];
  }>(snapshot);
  const start = () => {
    if (!snapshot) return;
    onPreview(null);
    void task.run(async (job) => {
      const input = await snapshotFile(snapshot, job.signal);
      const { file, method } = await runBackgroundTask(input, job, mode);
      const result = await decodeImage(file);
      job.signal?.throwIfAborted();
      onPreview({ snapshot, result });
      return { image: result, method };
    });
  };
  const comparison =
    snapshot && task.result ? { snapshot, result: task.result.image } : null;
  return (
    <div className="iw-settings iw-task-panel">
      <h2>去背景</h2>
      <p className="iw-task-hint">
        {snapshot
          ? '自动抠图按需加载 AI 模型。纯色去底可离线处理与图片边缘相连的同色区域。'
          : '打开图片后即可去除背景。'}
      </p>
      <label className="iw-field">
        处理方式
        <select
          value={mode}
          disabled={task.running}
          onChange={(event) => {
            setMode(event.target.value as BackgroundMode);
            task.cancel();
            onPreview(null);
          }}
        >
          <option value="auto">自动抠图</option>
          <option value="color">纯色去底（离线）</option>
        </select>
      </label>
      <button
        type="button"
        className="iw-primary"
        disabled={!snapshot || disabled || task.running}
        onClick={start}
      >
        开始去背景
      </button>
      <ImageTaskStatus {...task} />
      {task.result?.method === 'fallback' && (
        <p className="iw-task-hint" role="status">
          AI 抠图暂不可用，已用纯色去底处理。
        </p>
      )}
      {comparison && (
        <>
          <div className="iw-task-actions" role="group" aria-label="去背景对比">
            <button
              type="button"
              aria-pressed={!comparing}
              onClick={() => onPreview(null)}
            >
              处理前
            </button>
            <button
              type="button"
              aria-pressed={comparing}
              onClick={() => onPreview(comparison)}
            >
              去背景结果
            </button>
          </div>
          <div className="iw-task-actions">
            <button
              type="button"
              onClick={() => downloadFile(comparison.result.file)}
            >
              下载透明 PNG
            </button>
            <button
              type="button"
              className="iw-primary"
              disabled={disabled}
              onClick={() => onApply(comparison)}
            >
              应用到画布
            </button>
          </div>
        </>
      )}
    </div>
  );
}
