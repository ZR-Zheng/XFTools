import {
  type ExportResult,
  type OutputKind,
  type OutputSettings
} from './advanced-exports';
import { useEffect, useState } from 'react';
import { downloadFile } from '@utils/file';

const formatGroups: { label: [string, string]; options: OutputKind[] }[] = [
  { label: ['保存文档', 'Save document'], options: ['pdf'] },
  { label: ['转换格式', 'Convert format'], options: ['png', 'epub'] },
  {
    label: ['文件处理', 'Process file'],
    options: ['extract', 'compress', 'protect']
  }
];

export function outputLabel(
  kind: OutputKind,
  t: (zh: string, en: string) => string
) {
  const labels: Record<OutputKind, [string, string]> = {
    pdf: ['PDF', 'PDF'],
    png: ['PNG', 'PNG'],
    epub: ['EPUB', 'EPUB'],
    extract: ['提取内嵌图片', 'Extract embedded images'],
    compress: ['压缩 PDF', 'Compress PDF'],
    protect: ['密码保护 PDF', 'Password-protect PDF']
  };
  return t(...labels[kind]);
}

export default function PdfExportOptions({
  settings,
  busy,
  onChange,
  t
}: {
  settings: OutputSettings;
  busy: boolean;
  onChange: (change: Partial<OutputSettings>) => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <>
      <label className="pdf-output-name">
        {t('输出格式与操作', 'Output format and action')}
        <select
          value={settings.kind}
          disabled={busy}
          onChange={(event) =>
            onChange({ kind: event.target.value as OutputKind })
          }
        >
          {formatGroups.map(({ label, options }) => (
            <optgroup key={label[1]} label={t(...label)}>
              {options.map((kind) => (
                <option key={kind} value={kind}>
                  {outputLabel(kind, t)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {settings.kind === 'png' && (
        <>
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
        <label className="pdf-output-name">
          {t('压缩级别', 'Compression level')}
          <select
            value={settings.compressionLevel}
            disabled={busy}
            onChange={(event) =>
              onChange({
                compressionLevel: event.target
                  .value as OutputSettings['compressionLevel']
              })
            }
          >
            <option value="low">
              {t('低 · 保留画质', 'Low · higher quality')}
            </option>
            <option value="medium">
              {t('中 · 平衡', 'Medium · balanced')}
            </option>
            <option value="high">
              {t('高 · 文件更小', 'High · smaller file')}
            </option>
          </select>
        </label>
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
