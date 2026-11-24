import { useMemo, useState } from 'react';
import { PageSizes } from 'pdf-lib';
import { downloadFile } from '@utils/file';
import {
  planImagePages,
  splitImagesToPDF,
  toPts
} from '../generic/split/service';
import type { InitialValuesType } from '../generic/split/types';
import { isCanvasSize } from './session';
import ImageTaskStatus from './ImageTaskStatus';
import { snapshotFile, type ImageSnapshot } from './snapshot';
import useImageTask from './use-image-task';

export default function ImagePrintPanel({
  snapshot,
  disabled
}: {
  snapshot: ImageSnapshot | null;
  disabled: boolean;
}) {
  const [paper, setPaper] = useState<keyof typeof PageSizes>('A4');
  const [margin, setMargin] = useState('5');
  const [dpi, setDpi] = useState('81');
  const scope = useMemo(
    () => snapshot && { snapshot, paper, dpi, margin },
    [snapshot, paper, dpi, margin]
  );
  const task = useImageTask<File>(scope);
  const valid =
    margin !== '' &&
    Number.isFinite(Number(margin)) &&
    Number(margin) >= 0 &&
    Number.isFinite(Number(dpi)) &&
    Number(dpi) > 0;
  const [pageWidth, pageHeight] = PageSizes[paper];
  const options: InitialValuesType = {
    pageFormat: paper,
    pageWidth,
    pageHeight,
    unitKind: 'pt',
    padding: toPts(Number(margin), 'mm'),
    pxPerSquareQuantity: Number(dpi),
    squareQuantity: 1,
    unitsPerOneSquare: 72
  };
  let pages = 0;
  let error = '';
  if (snapshot) {
    try {
      if (!valid) throw new Error('请输入有效的边距和打印分辨率。');
      const { tileWidth, tileHeight, rows, columns } = planImagePages(
        snapshot.size,
        options
      );
      if (
        !isCanvasSize({ width: tileWidth, height: tileHeight }) ||
        rows * columns > 200 ||
        rows * columns * tileWidth * tileHeight > 60_000_000
      )
        throw new Error('当前设置超出分页处理范围，请调整打印分辨率或纸张。');
      pages = rows * columns;
    } catch (failure) {
      error = failure instanceof Error ? failure.message : '分页设置无效。';
    }
  }
  return (
    <div className="iw-settings iw-task-panel">
      <h2>分页打印</h2>
      <p className="iw-task-hint">
        {snapshot
          ? '按打印比例将画布拆为多页 PDF。'
          : '打开图片后可生成打印 PDF。'}
      </p>
      <fieldset disabled={task.running}>
        <label className="iw-field">
          纸张
          <select
            value={paper}
            onChange={(event) =>
              setPaper(event.target.value as keyof typeof PageSizes)
            }
          >
            {Object.keys(PageSizes).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <div className="iw-field-grid">
          <label className="iw-field">
            边距（mm）
            <input
              type="number"
              min={0}
              step={0.1}
              value={margin}
              onChange={(event) => setMargin(event.target.value)}
            />
          </label>
          <label className="iw-field">
            打印分辨率（DPI）
            <input
              type="number"
              min={1}
              value={dpi}
              onChange={(event) => setDpi(event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      {error && (
        <p className="iw-alert" role="alert">
          {error}
        </p>
      )}
      {pages > 0 && <p className="iw-task-hint">预计 {pages} 页</p>}
      <button
        type="button"
        className="iw-primary"
        disabled={!snapshot || !pages || disabled || task.running}
        onClick={() => {
          if (snapshot)
            void task.run(async (job) =>
              splitImagesToPDF(
                await snapshotFile(snapshot, job.signal),
                options,
                job
              )
            );
        }}
      >
        生成打印 PDF
      </button>
      <ImageTaskStatus {...task} />
      {task.result && (
        <button type="button" onClick={() => downloadFile(task.result!)}>
          下载打印 PDF
        </button>
      )}
    </div>
  );
}
