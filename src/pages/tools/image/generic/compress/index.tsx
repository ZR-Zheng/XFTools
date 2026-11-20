import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ImageBatchWorkbench from '@components/workbench/ImageBatchWorkbench';
import { getImageDimensions } from '@utils/image';
import { compressImage } from './service';

const modes = [
  { value: 'standard', label: '通用', detail: '控制体积' },
  { value: 'png', label: 'PNG 专用', detail: '保留尺寸' }
] as const;

export default function ImageCompressor() {
  const [params, setParams] = useSearchParams();
  const png = params.get('mode') === 'png';
  const [standardQuality, setStandardQuality] = useState(80);
  const [pngQuality, setPngQuality] = useState('60');
  const [maxMB, setMaxMB] = useState('1');
  const [maxKB, setMaxKB] = useState('0');
  const [dithering, setDithering] = useState(false);

  const ready = png
    ? maxKB !== '' &&
      Number.isFinite(Number(maxKB)) &&
      Number(maxKB) >= 0 &&
      Number.isInteger(Number(pngQuality)) &&
      Number(pngQuality) >= 1 &&
      Number(pngQuality) <= 100
    : Number.isFinite(Number(maxMB)) && Number(maxMB) >= 0.1;

  const process = useCallback(
    async (source: File) => {
      if (png) {
        if (
          source.type !== 'image/png' &&
          (source.type || !/\.png$/i.test(source.name))
        ) {
          throw new Error('PNG 专用模式只处理 PNG 图片。');
        }
        const { compressPng } = await import('../../png/compress-png/service');
        const result = await compressPng(source, {
          quality: Number(pngQuality),
          dithering,
          maxOutputSizeInKB: Number(maxKB)
        });
        const detail = result.keptOriginal
          ? '已保留更小的原图'
          : result.colors + ' 色调色板';
        return {
          file: result.file,
          detail: result.targetReached ? detail : detail + ' · 未达到目标体积'
        };
      }

      const file = await compressImage(source, {
        maxFileSizeInMB: Number(maxMB),
        quality: standardQuality
      });
      const percent = source.size
        ? ((1 - file.size / source.size) * 100).toFixed(1)
        : '0';
      const detail =
        file === source ? '已保留更小的原图' : '节省 ' + percent + '%';
      return {
        file,
        dimensions:
          file === source ? undefined : await getImageDimensions(file),
        detail:
          file.size <= Number(maxMB) * 1024 * 1024
            ? detail
            : detail + ' · 未达到目标体积'
      };
    },
    [png, pngQuality, dithering, maxKB, maxMB, standardQuality]
  );

  return (
    <ImageBatchWorkbench
      settingsTitle="压缩设置"
      importHint={
        png ? '可批量导入 PNG 图片' : '可批量导入 JPG、PNG、WebP 等图片'
      }
      action="压缩"
      archiveName={png ? 'compressed-pngs.zip' : 'compressed-images.zip'}
      processImage={process}
      ready={ready}
      settings={
        <>
          <fieldset className="image-batch-choices">
            <legend>压缩方式</legend>
            <div className="image-batch-choice-row">
              {modes.map((mode) => (
                <label className="image-batch-choice" key={mode.value}>
                  <input
                    type="radio"
                    name="compression-mode"
                    checked={png === (mode.value === 'png')}
                    aria-label={mode.label}
                    onChange={() =>
                      setParams({ mode: mode.value }, { replace: true })
                    }
                  />
                  <strong>{mode.label}</strong>
                  <small>{mode.detail}</small>
                </label>
              ))}
            </div>
          </fieldset>
          {png ? (
            <>
              <label className="image-batch-field">
                <span>保色程度（1–100）</span>
                <input
                  className="ui-input"
                  type="number"
                  name="quality"
                  min={1}
                  max={100}
                  step={1}
                  value={pngQuality}
                  onChange={(event) => setPngQuality(event.target.value)}
                />
                <small>降低数值可减少 PNG 色板的颜色数。</small>
              </label>
              <label className="image-batch-field">
                <span>目标体积（KB）</span>
                <input
                  className="ui-input"
                  type="number"
                  name="maxOutputSizeInKB"
                  min={0}
                  step="any"
                  value={maxKB}
                  onChange={(event) => setMaxKB(event.target.value)}
                />
                <small>设为 0 时按保色程度压缩。输出保持原图尺寸。</small>
              </label>
              <label className="image-batch-toggle">
                <input
                  className="ui-check"
                  type="checkbox"
                  checked={dithering}
                  onChange={(event) => setDithering(event.target.checked)}
                />
                使用抖动改善渐变
              </label>
            </>
          ) : (
            <>
              <label className="image-batch-field">
                <span>目标体积（MB）</span>
                <input
                  className="ui-input"
                  type="number"
                  min={0.1}
                  step="any"
                  value={maxMB}
                  onChange={(event) => setMaxMB(event.target.value)}
                />
                <small>针对每张图片。较大图片的最长边最多 1920 px。</small>
              </label>
              <label className="image-batch-field">
                <span>
                  起始画质 <span aria-hidden="true">{standardQuality}%</span>
                </span>
                <input
                  type="range"
                  aria-label="起始画质"
                  aria-valuetext={standardQuality + '%'}
                  min={10}
                  max={100}
                  value={standardQuality}
                  onChange={(event) =>
                    setStandardQuality(Number(event.target.value))
                  }
                />
              </label>
            </>
          )}
          {!ready && (
            <p className="tool-inline-error" role="alert">
              {png
                ? '保色程度须为 1 至 100 的整数，目标体积须大于或等于 0。'
                : '目标体积须大于或等于 0.1 MB。'}
            </p>
          )}
        </>
      }
    />
  );
}
