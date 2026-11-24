import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ImageBatchWorkbench from '@components/workbench/ImageBatchWorkbench';
import { useCompressionSettings } from '../generic/compress/batch-settings';
import {
  useConversionSettings,
  type Format
} from '../generic/convert/batch-settings';
import { snapshotFile, type ImageSnapshot } from './snapshot';
import { useResizeSettings, useWatermarkSettings } from './batch-settings';

const operations = [
  { id: 'compress', label: '批量压缩' },
  { id: 'convert', label: '批量转换' },
  { id: 'resize', label: '批量缩放' },
  { id: 'watermark', label: '批量水印' }
] as const;

export default function ImageBatchPanel({
  snapshot
}: {
  snapshot: ImageSnapshot | null;
}) {
  const [params, setParams] = useSearchParams();
  const operation =
    operations.find((item) => item.id === params.get('operation'))?.id ??
    'compress';
  const mode = params.get('mode');
  const requestedFormat = params.get('format');
  const format: Format =
    requestedFormat === 'png' || requestedFormat === 'webp'
      ? requestedFormat
      : 'jpg';
  const [busy, setBusy] = useState(false);
  const setOption = (key: 'operation' | 'mode' | 'format', value: string) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set(key, value);
        return updated;
      },
      { replace: true }
    );
  };
  const settings = {
    compress: useCompressionSettings(mode === 'png', (value) =>
      setOption('mode', value)
    ),
    convert: useConversionSettings(format, (value) =>
      setOption('format', value)
    ),
    resize: useResizeSettings(),
    watermark: useWatermarkSettings()
  };

  const getCurrentImage =
    snapshot &&
    (async () => {
      const file = snapshot.source.file;
      if (
        operation === 'resize' &&
        snapshot.edits.length === 0 &&
        /\.(?:svg|gif)$/i.test(file.name)
      )
        return file;
      return snapshotFile(snapshot);
    });

  return (
    <div className="iw-batch">
      <div className="iw-task-actions" role="group" aria-label="批量操作">
        {operations.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            disabled={busy}
            aria-pressed={operation === id}
            onClick={() => setOption('operation', id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ImageBatchWorkbench
        {...settings[operation]}
        embedded
        getCurrentImage={getCurrentImage || undefined}
        onBusyChange={setBusy}
      />
    </div>
  );
}
