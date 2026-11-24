import { useEffect, useRef, useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import type { ExportOptions, ImageFormat } from './render-image';
import type { Size } from './session';

export default function ImageExportDialog({
  filename,
  size,
  vector,
  saving,
  error,
  onClose,
  onExport
}: {
  filename: string;
  size: Size;
  vector: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(filename);
  const [format, setFormat] = useState<ImageFormat>(vector ? 'svg' : 'png');
  const [quality, setQuality] = useState(92);
  const [background, setBackground] = useState('#ffffff');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="iw-export-dialog"
      ref={dialog}
      aria-labelledby="iw-export-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(event) => {
        if (!saving && event.currentTarget === event.target) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving) onExport({ name, format, quality, background });
        }}
      >
        <div className="iw-dialog-heading">
          <div>
            <h2 id="iw-export-title">导出图片</h2>
            <p>
              {size.width} × {size.height} px
            </p>
          </div>
          <button
            type="button"
            className="iw-icon-button"
            aria-label="关闭导出"
            disabled={saving}
            onClick={onClose}
          >
            <Glyph name="close" size={19} />
          </button>
        </div>
        <fieldset disabled={saving}>
          <label className="iw-field">
            文件名
            <input
              type="text"
              autoFocus
              value={name}
              maxLength={180}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="iw-field-grid">
            <label className="iw-field">
              导出格式
              <select
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as ImageFormat)
                }
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
                {vector && <option value="svg">SVG（矢量）</option>}
              </select>
            </label>
            {format === 'jpg' && (
              <label className="iw-field">
                背景色
                <input
                  type="color"
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                />
              </label>
            )}
          </div>
          {(format === 'jpg' || format === 'webp') && (
            <label className="iw-slider">
              <span>导出质量</span>
              <output aria-hidden="true">{quality}%</output>
              <input
                type="range"
                min={10}
                max={100}
                aria-label="导出质量"
                value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
              />
            </label>
          )}
          {error && (
            <p className="iw-alert" role="alert">
              {error}
            </p>
          )}
          <div className="iw-settings-actions">
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="iw-primary"
              disabled={!name.trim()}
            >
              <Glyph name="download" size={16} /> 下载图片
            </button>
          </div>
        </fieldset>
        {saving && (
          <p className="iw-status" role="status">
            正在生成图片…
          </p>
        )}
      </form>
    </dialog>
  );
}
