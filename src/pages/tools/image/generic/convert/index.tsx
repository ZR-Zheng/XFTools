import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ImageBatchWorkbench from '@components/workbench/ImageBatchWorkbench';
import { convertImage, type ConversionOptions } from './service';

const formats = [
  { value: 'jpg', label: 'JPG', note: '通用照片' },
  { value: 'webp', label: 'WebP', note: '网页图片' },
  { value: 'png', label: 'PNG', note: '无损透明' }
] as const;
type Format = (typeof formats)[number]['value'];

export default function ImageConverter() {
  const [params, setParams] = useSearchParams();
  const format =
    formats.find((item) => item.value === params.get('format'))?.value ?? 'jpg';
  const [qualities, setQualities] = useState({ jpg: 85, webp: 100 });
  const [background, setBackground] = useState('#ffffff');
  const [keepTransparency, setKeepTransparency] = useState(true);
  const [colorKey, setColorKey] = useState(false);
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [similarity, setSimilarity] = useState(10);
  const fillBackground =
    format === 'jpg' || (format === 'webp' && !keepTransparency);

  function chooseFormat(value: Format) {
    setParams({ format: value }, { replace: true });
  }

  const process = useCallback(
    async (file: File) => {
      const options: ConversionOptions =
        format === 'png'
          ? {
              format,
              transparent: colorKey ? { color: targetColor, similarity } : null
            }
          : {
              format,
              quality: qualities[format],
              background: fillBackground ? background : null
            };
      return { file: await convertImage(file, options) };
    },
    [
      format,
      colorKey,
      targetColor,
      similarity,
      qualities,
      fillBackground,
      background
    ]
  );

  return (
    <ImageBatchWorkbench
      settingsTitle="转换设置"
      importHint="支持批量导入 JPG、PNG、WebP、HEIC 等图片"
      action="转换"
      archiveName="converted-images.zip"
      processImage={process}
      settings={
        <>
          <fieldset className="image-batch-choices">
            <legend>输出格式</legend>
            <div className="image-batch-choice-row">
              {formats.map((item) => (
                <label className="image-batch-choice" key={item.value}>
                  <input
                    type="radio"
                    name="image-format"
                    value={item.value}
                    checked={format === item.value}
                    onChange={() => chooseFormat(item.value)}
                    aria-label={item.label}
                  />
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </label>
              ))}
            </div>
          </fieldset>
          {format !== 'png' && (
            <label className="image-batch-field">
              <span>
                画质 <span aria-hidden="true">{qualities[format]}%</span>
              </span>
              <input
                type="range"
                aria-label="画质"
                aria-valuetext={qualities[format] + '%'}
                min={1}
                max={100}
                value={qualities[format]}
                onChange={(event) =>
                  setQualities({
                    ...qualities,
                    [format]: Number(event.target.value)
                  })
                }
              />
              <small>画质越高，通常文件也越大。</small>
            </label>
          )}
          {format === 'webp' && (
            <label className="image-batch-toggle">
              <input
                className="ui-check"
                type="checkbox"
                checked={keepTransparency}
                onChange={(event) => setKeepTransparency(event.target.checked)}
              />
              保留透明区域
            </label>
          )}
          {fillBackground && (
            <label className="image-batch-field">
              <span>透明区域的底色</span>
              <span className="image-batch-color">
                <span aria-hidden="true">{background.toUpperCase()}</span>
                <input
                  type="color"
                  aria-label="透明区域的底色"
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                />
              </span>
              <small>导出时用所选颜色填充透明区域。</small>
            </label>
          )}
          {format === 'png' && (
            <>
              <p className="image-batch-message">
                PNG 使用无损编码，并保留原图的透明区域。
              </p>
              <label className="image-batch-toggle">
                <input
                  className="ui-check"
                  type="checkbox"
                  checked={colorKey}
                  onChange={(event) => setColorKey(event.target.checked)}
                />
                将指定颜色设为透明
              </label>
              {colorKey && (
                <>
                  <label className="image-batch-field">
                    <span>目标颜色</span>
                    <span className="image-batch-color">
                      <span aria-hidden="true">
                        {targetColor.toUpperCase()}
                      </span>
                      <input
                        data-testid="color-input"
                        type="color"
                        value={targetColor}
                        aria-label="目标颜色"
                        onChange={(event) => setTargetColor(event.target.value)}
                      />
                    </span>
                  </label>
                  <label className="image-batch-field">
                    <span>
                      颜色容差 <span aria-hidden="true">{similarity}%</span>
                    </span>
                    <input
                      type="range"
                      aria-label="颜色容差"
                      aria-valuetext={similarity + '%'}
                      min={0}
                      max={100}
                      value={similarity}
                      onChange={(event) =>
                        setSimilarity(Number(event.target.value))
                      }
                    />
                    <small>提高容差可去除更多相近颜色。</small>
                  </label>
                </>
              )}
            </>
          )}
        </>
      }
    />
  );
}
