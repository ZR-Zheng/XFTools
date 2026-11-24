import {
  type ExportResult,
  type OutputKind,
  type OutputSettings
} from './advanced-exports';
import { useEffect, useState } from 'react';
import { downloadFile } from '@utils/file';
import { compressionPresets } from '../compress-pdf/types';

export function outputLabel(
  kind: OutputKind,
  t: (zh: string, en: string) => string
) {
  const labels: Record<OutputKind, [string, string]> = {
    pdf: ['保存 PDF', 'Save PDF'],
    png: ['PDF 转图片', 'PDF to images'],
    epub: ['PDF 转 EPUB', 'PDF to EPUB'],
    extract: ['提取内嵌图片', 'Extract embedded images'],
    compress: ['PDF 压缩', 'Compress PDF'],
    protect: ['密码保护 PDF', 'Password-protect PDF']
  };
  return t(...labels[kind]);
}

export default function PdfExportOptions({
  settings,
  showPngRanges,
  busy,
  onChange,
  t
}: {
  settings: OutputSettings;
  showPngRanges: boolean;
  busy: boolean;
  onChange: (change: Partial<OutputSettings>) => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <>
      {settings.kind === 'png' && (
        <>
          {showPngRanges && (
            <label className="pdf-output-name">
              {t('导出页码', 'Page ranges to render')}
              <input
                type="text"
                placeholder="1, 3-5"
                value={settings.ranges}
                disabled={busy}
                onChange={(event) => onChange({ ranges: event.target.value })}
              />
            </label>
          )}
          <label className="pdf-output-name">
            {t('渲染倍率', 'Render scale')}
            <select
              value={settings.scale}
              disabled={busy}
              onChange={(event) =>
                onChange({ scale: Number(event.target.value) })
              }
            >
              {[0.75, 1, 1.5, 2, 3].map((scale) => (
                <option key={scale} value={scale}>
                  {scale}×
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {settings.kind === 'epub' && (
        <p className="pdf-help">
          {t(
            '提取 PDF 中可选中的文字。纯扫描件需要先做 OCR。',
            'Extract selectable text. Image-only scans need OCR first.'
          )}
        </p>
      )}
      {settings.kind === 'compress' && (
        <>
          <label className="pdf-output-name">
            {t('压缩级别', 'Compression level')}
            <select
              value={settings.compressionLevel}
              disabled={busy}
              onChange={(event) => {
                const compressionLevel = event.target
                  .value as OutputSettings['compressionLevel'];
                const preset =
                  compressionLevel === 'lossless' ||
                  compressionLevel === 'custom'
                    ? {}
                    : compressionPresets[compressionLevel];
                onChange({ compressionLevel, ...preset });
              }}
            >
              <option value="lossless">
                {t('无损 · 仅优化文档结构', 'Lossless · optimize structure')}
              </option>
              <option value="low">
                {t('低 · 保留画质', 'Low · higher quality')}
              </option>
              <option value="medium">
                {t('中 · 平衡', 'Medium · balanced')}
              </option>
              <option value="high">
                {t('高 · 文件更小', 'High · smaller file')}
              </option>
              {settings.compressionLevel === 'custom' && (
                <option value="custom">{t('自定义', 'Custom')}</option>
              )}
            </select>
          </label>
          {settings.compressionLevel !== 'lossless' && (
            <details className="pdf-compression-settings">
              <summary>
                {t('图片压缩设置', 'Image compression settings')}
              </summary>
              <label className="pdf-output-name">
                {t('图片编码', 'Image encoding')}
                <select
                  value={settings.imageEncoding}
                  disabled={busy}
                  onChange={(event) =>
                    onChange({
                      imageEncoding: event.target
                        .value as OutputSettings['imageEncoding']
                    })
                  }
                >
                  <option value="auto">
                    {t('自动（JPEG 或无损）', 'Auto (JPEG or lossless)')}
                  </option>
                  <option value="jpeg">
                    {t('JPEG · 兼容优先', 'JPEG · compatibility')}
                  </option>
                  <option value="jp2">
                    {t('JPEG 2000 · 高效编码', 'JPEG 2000 · efficient')}
                  </option>
                </select>
              </label>
              <label className="pdf-output-name">
                {t('图片最长边', 'Maximum image dimension')}
                <select
                  value={settings.maxSide}
                  disabled={busy}
                  onChange={(event) =>
                    onChange({
                      maxSide: Number(event.target.value),
                      compressionLevel: 'custom'
                    })
                  }
                >
                  <option value={0}>
                    {t('保持原尺寸', 'Keep original dimensions')}
                  </option>
                  {[600, 900, 1200, 1600, 1900, 2400, 2800, 3600].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value} px
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="pdf-output-name">
                <span>
                  {t('图片质量', 'Image quality')}{' '}
                  <output>{settings.imageQuality}%</output>
                </span>
                <input
                  type="range"
                  aria-label={t('图片质量', 'Image quality')}
                  min={35}
                  max={100}
                  value={settings.imageQuality}
                  disabled={busy}
                  onChange={(event) =>
                    onChange({
                      imageQuality: Number(event.target.value),
                      compressionLevel: 'custom'
                    })
                  }
                />
              </label>
              <label className="pdf-bookmarks">
                <input
                  type="checkbox"
                  checked={settings.grayscale}
                  disabled={busy}
                  onChange={(event) =>
                    onChange({ grayscale: event.target.checked })
                  }
                />
                <span>
                  {t(
                    '将压缩的图片转为灰度',
                    'Convert recompressed images to grayscale'
                  )}
                </span>
              </label>
            </details>
          )}
        </>
      )}
      {settings.kind === 'protect' && (
        <>
          <label className="pdf-output-name">
            {t('打开密码', 'Open password')}
            <input
              type="password"
              autoComplete="new-password"
              value={settings.password}
              disabled={busy}
              onChange={(event) => onChange({ password: event.target.value })}
            />
          </label>
          <label className="pdf-output-name">
            {t('确认密码', 'Confirm password')}
            <input
              type="password"
              autoComplete="new-password"
              value={settings.confirmPassword}
              disabled={busy}
              onChange={(event) =>
                onChange({ confirmPassword: event.target.value })
              }
            />
          </label>
          {settings.confirmPassword &&
            settings.confirmPassword !== settings.password && (
              <p className="pdf-form-note" role="alert">
                {t('两次输入的密码不一致。', 'The passwords do not match.')}
              </p>
            )}
        </>
      )}
    </>
  );
}

function ImageDownload({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const href = URL.createObjectURL(file);
    setUrl(href);
    return () => URL.revokeObjectURL(href);
  }, [file]);
  return (
    <li>
      {url && <img src={url} alt="" loading="lazy" />}
      <button type="button" onClick={() => downloadFile(file)}>
        {file.name}
      </button>
    </li>
  );
}

export function PdfResultItems({
  result,
  t
}: {
  result: ExportResult;
  t: (zh: string, en: string) => string;
}) {
  const [count, setCount] = useState(12);
  const items = result.items ?? [];
  return (
    <>
      <ul className="pdf-output-items">
        {items.slice(Math.max(0, count - 12), count).map((file) => (
          <ImageDownload key={file.name} file={file} />
        ))}
      </ul>
      {items.length > 12 && (
        <nav
          className="pdf-pagination"
          aria-label={t('图片结果分页', 'Image result pages')}
        >
          <button
            type="button"
            disabled={count <= 12}
            onClick={() => setCount(count - 12)}
          >
            {t('上一组', 'Previous')}
          </button>
          <span>
            {count - 11}–{Math.min(count, items.length)} / {items.length}
          </span>
          <button
            type="button"
            disabled={count >= items.length}
            onClick={() => setCount(count + 12)}
          >
            {t('下一组', 'Next')}
          </button>
        </nav>
      )}
    </>
  );
}
