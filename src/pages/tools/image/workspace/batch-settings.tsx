import { useCallback, useState } from 'react';
import type { ImageBatchSettings } from '@components/workbench/ImageBatchWorkbench';
import { getImageDimensions } from '@utils/image';
import { getResizeDimensions } from '../generic/resize/resize-dimensions';
import type { InitialValuesType as ResizeOptions } from '../generic/resize/types';
import type { InitialValuesType as WatermarkOptions } from '../generic/watermark/types';

const resizeDefaults: ResizeOptions = {
  resizeMethod: 'pixels',
  dimensionType: 'width',
  width: '800',
  height: '600',
  percentage: '50',
  maintainAspectRatio: true
};

function positiveInteger(value: string) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function useResizeSettings(): ImageBatchSettings {
  const [options, setOptions] = useState(resizeDefaults);
  const {
    resizeMethod,
    dimensionType,
    width,
    height,
    percentage,
    maintainAspectRatio
  } = options;
  const pixels = resizeMethod === 'pixels';
  const valid = pixels
    ? ((maintainAspectRatio && dimensionType === 'height') ||
        positiveInteger(width)) &&
      ((maintainAspectRatio && dimensionType === 'width') ||
        positiveInteger(height))
    : Number.isFinite(Number(percentage)) && Number(percentage) > 0;
  const describeSource: ImageBatchSettings['describeSource'] = (size) => {
    if (!valid) return '';
    const target = getResizeDimensions(size.width, size.height, options);
    return `${target.width} × ${target.height} px`;
  };
  const process = useCallback(
    async (source: File, signal?: AbortSignal) => {
      const { resizeImages } = await import('../generic/resize/service');
      signal?.throwIfAborted();
      const output = (await resizeImages([source], options))?.results[0];
      if (!output) throw new Error('无法调整此图片的尺寸。');
      return { file: output, dimensions: await getImageDimensions(output) };
    },
    [options]
  );

  return {
    settingsTitle: '缩放设置',
    importHint: '支持批量导入 JPG、PNG、WebP、SVG、GIF 等图片',
    action: '调整大小',
    archiveName: 'resized-images.zip',
    processImage: process,
    ready: valid,
    describeSource,
    settings: (
      <>
        <label className="image-batch-field">
          <span>缩放方式</span>
          <select
            value={resizeMethod}
            onChange={(event) =>
              setOptions({
                ...options,
                resizeMethod:
                  event.target.value === 'percentage' ? 'percentage' : 'pixels'
              })
            }
          >
            <option value="pixels">按像素</option>
            <option value="percentage">按百分比</option>
          </select>
        </label>
        {pixels ? (
          <>
            <label className="image-batch-toggle">
              <input
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(event) =>
                  setOptions({
                    ...options,
                    maintainAspectRatio: event.target.checked
                  })
                }
              />
              锁定宽高比
            </label>
            {maintainAspectRatio && (
              <label className="image-batch-field">
                <span>基准尺寸</span>
                <select
                  value={dimensionType}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      dimensionType:
                        event.target.value === 'height' ? 'height' : 'width'
                    })
                  }
                >
                  <option value="width">按宽度</option>
                  <option value="height">按高度</option>
                </select>
              </label>
            )}
            {(!maintainAspectRatio || dimensionType === 'width') && (
              <label className="image-batch-field">
                <span>目标宽度（px）</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={width}
                  onChange={(event) =>
                    setOptions({ ...options, width: event.target.value })
                  }
                />
              </label>
            )}
            {(!maintainAspectRatio || dimensionType === 'height') && (
              <label className="image-batch-field">
                <span>目标高度（px）</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={height}
                  onChange={(event) =>
                    setOptions({ ...options, height: event.target.value })
                  }
                />
              </label>
            )}
          </>
        ) : (
          <label className="image-batch-field">
            <span>缩放百分比</span>
            <input
              type="number"
              min={1}
              step="any"
              value={percentage}
              onChange={(event) =>
                setOptions({ ...options, percentage: event.target.value })
              }
            />
          </label>
        )}
        {!valid && (
          <p className="image-batch-message" role="alert">
            请输入有效的目标尺寸或缩放百分比。
          </p>
        )}
      </>
    )
  };
}

const watermarkDefaults: WatermarkOptions = {
  filename: true,
  watermark: '',
  watermarkOpacity: 0.35,
  fontSize: 32,
  position: 'bottom-right',
  color: '#ffffff'
};

export function useWatermarkSettings(): ImageBatchSettings {
  const [options, setOptions] = useState(watermarkDefaults);
  const update = (values: Partial<WatermarkOptions>) =>
    setOptions({ ...options, ...values });
  const process = useCallback(
    async (source: File, signal?: AbortSignal) => {
      const { watermarkImages } = await import('../generic/watermark/service');
      signal?.throwIfAborted();
      const output = (await watermarkImages([source], options))?.results[0];
      if (!output) throw new Error('无法添加水印，请确认图片格式与水印文字。');
      return { file: output };
    },
    [options]
  );
  return {
    settingsTitle: '水印设置',
    importHint: '支持批量导入 JPG、PNG、WebP 等位图',
    action: '添加水印',
    archiveName: 'watermarked-images.zip',
    processImage: process,
    ready:
      (options.filename || Boolean(options.watermark.trim())) &&
      Number.isInteger(options.fontSize) &&
      options.fontSize >= 8 &&
      options.fontSize <= 512,
    settings: (
      <>
        <label className="image-batch-toggle">
          <input
            type="checkbox"
            checked={options.filename}
            onChange={(event) => update({ filename: event.target.checked })}
          />
          使用文件名作为水印
        </label>
        {!options.filename && (
          <label className="image-batch-field">
            <span>水印文字</span>
            <input
              type="text"
              required
              value={options.watermark}
              onChange={(event) => update({ watermark: event.target.value })}
            />
          </label>
        )}
        <label className="image-batch-field">
          <span>水印位置</span>
          <select
            value={options.position}
            onChange={(event) =>
              update({
                position: event.target.value as WatermarkOptions['position']
              })
            }
          >
            <option value="top-left">左上角</option>
            <option value="top-right">右上角</option>
            <option value="center">居中</option>
            <option value="bottom-left">左下角</option>
            <option value="bottom-right">右下角</option>
          </select>
        </label>
        <label className="image-batch-field">
          <span>文字大小（px）</span>
          <input
            type="number"
            min={8}
            max={512}
            step={1}
            value={options.fontSize || ''}
            onChange={(event) =>
              update({ fontSize: Number(event.target.value) })
            }
          />
        </label>
        <label className="image-batch-field">
          <span>文字颜色</span>
          <input
            type="color"
            value={options.color}
            onChange={(event) => update({ color: event.target.value })}
          />
        </label>
        <label className="image-batch-field">
          <span>
            水印不透明度 {Math.round(options.watermarkOpacity * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(options.watermarkOpacity * 100)}
            onChange={(event) =>
              update({ watermarkOpacity: Number(event.target.value) / 100 })
            }
          />
        </label>
      </>
    )
  };
}
