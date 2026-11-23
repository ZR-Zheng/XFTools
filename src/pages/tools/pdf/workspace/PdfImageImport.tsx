import { useRef, useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import type { InitialValuesType } from '../convert-to-pdf/types';

const accept =
  'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif';

export default function PdfImageImport({
  busy,
  onClose,
  onImport,
  t
}: {
  busy: boolean;
  onClose: () => void;
  onImport: (files: File[], options: InitialValuesType) => void;
  t: (zh: string, en: string) => string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [options, setOptions] = useState<InitialValuesType>({
    pageType: 'a4',
    orientation: 'portrait',
    scale: 95
  });
  const add = (incoming: File[]) =>
    setFiles((old) => [
      ...old,
      ...incoming.map((file) => ({ id: crypto.randomUUID(), file }))
    ]);
  const move = (index: number, shift: -1 | 1) =>
    setFiles((old) => {
      const next = [...old];
      [next[index], next[index + shift]] = [next[index + shift], next[index]];
      return next;
    });
  return (
    <aside
      className="pdf-output pdf-image-panel"
      id="pdf-image-panel"
      aria-label={t('图片转 PDF', 'Images to PDF')}
    >
      <div className="pdf-output-heading">
        <h3>{t('图片转 PDF', 'Images to PDF')}</h3>
        <button
          type="button"
          className="pdf-icon-button"
          aria-label={t('关闭图片转换', 'Close image conversion')}
          onClick={onClose}
        >
          <Glyph name="close" size={17} />
        </button>
      </div>
      <div
        className="pdf-image-drop"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          event.stopPropagation();
          if (!busy) add(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple
          className="pdf-file-input"
          aria-label={t('选择图片文件', 'Choose image files')}
          tabIndex={-1}
          disabled={busy}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <Glyph name="image" size={17} />
          {t('添加图片', 'Add images')}
        </button>
      </div>
      {files.length > 0 && (
        <ol className="pdf-image-files">
          {files.map(({ file, id }, index) => (
            <li key={id}>
              <span title={file.name}>{file.name}</span>
              <button
                type="button"
                aria-label={`${t('上移', 'Move up')} ${file.name}`}
                disabled={busy || !index}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${t('下移', 'Move down')} ${file.name}`}
                disabled={busy || index + 1 === files.length}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`${t('移除', 'Remove')} ${file.name}`}
                disabled={busy}
                onClick={() =>
                  setFiles((old) => old.filter((item) => item.id !== id))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      <label className="pdf-output-name">
        {t('页面大小', 'Page size')}
        <select
          disabled={busy}
          value={options.pageType}
          onChange={(event) =>
            setOptions({
              ...options,
              pageType: event.target.value as InitialValuesType['pageType']
            })
          }
        >
          <option value="a4">A4</option>
          <option value="full">{t('按原图尺寸', 'Match image size')}</option>
        </select>
      </label>
      {options.pageType === 'a4' && (
        <>
          <label className="pdf-output-name">
            {t('方向', 'Orientation')}
            <select
              disabled={busy}
              value={options.orientation}
              onChange={(event) =>
                setOptions({
                  ...options,
                  orientation: event.target
                    .value as InitialValuesType['orientation']
                })
              }
            >
              <option value="portrait">{t('纵向', 'Portrait')}</option>
              <option value="landscape">{t('横向', 'Landscape')}</option>
            </select>
          </label>
          <label className="pdf-output-name">
            {t('图片占比 (%)', 'Image scale (%)')}
            <input
              type="number"
              min={10}
              max={100}
              disabled={busy}
              value={options.scale}
              onChange={(event) =>
                setOptions({ ...options, scale: Number(event.target.value) })
              }
            />
          </label>
        </>
      )}
      <button
        type="button"
        className="pdf-primary pdf-export"
        disabled={
          busy ||
          !files.length ||
          (options.pageType === 'a4' &&
            !(options.scale >= 10 && options.scale <= 100))
        }
        onClick={() =>
          onImport(
            files.map(({ file }) => file),
            options
          )
        }
      >
        {t('生成并加入工作台', 'Add as PDF')}
      </button>
    </aside>
  );
}
