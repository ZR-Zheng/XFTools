import { useContext, useEffect, useRef, useState } from 'react';
import { useWorkbenchText } from 'i18n/workbench';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import useFileDrop from '../../hooks/useFileDrop';
import InputHeader from '../InputHeader';
import InputFooter from './InputFooter';
import Glyph from '../workbench/Glyph';
export interface MultiFileValue {
  file: File;
  order: number;
  preview?: string;
}
export interface MultiFileInputProps {
  accept: string[];
  title?: string;
  type: 'image' | 'audio' | 'video' | 'pdf';
  value: MultiFileValue[];
  onChange: (files: MultiFileValue[]) => void;
}
export default function MultiFileInput({
  accept,
  title,
  type,
  value,
  onChange
}: MultiFileInputProps) {
  const { english } = useWorkbenchText();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;
  const ownedUrls = useRef(new Set<string>());
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      ownedUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  const update = (files: MultiFileValue[]) =>
    onChange(files.map((item, order) => ({ ...item, order })));
  const release = (item: MultiFileValue) => {
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
      ownedUrls.current.delete(item.preview);
    }
  };
  const { isDragging, dropHandlers, addFiles } = useFileDrop({
    accept,
    onFiles: async (files) => {
      setImporting(true);
      try {
        const added: MultiFileValue[] = [];
        for (const original of files) {
          let file = original;
          if (
            type === 'image' &&
            (/\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/.test(file.type))
          ) {
            const { heicTo } = await import('heic-to');
            const blob = await heicTo({ blob: file, type: 'image/jpeg' });
            file = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg'
            });
          }
          if (!active.current) return;
          const preview =
            type === 'pdf' ? undefined : URL.createObjectURL(file);
          if (preview) ownedUrls.current.add(preview);
          added.push({ file, order: 0, preview });
        }
        if (active.current) update([...latest.current, ...added]);
      } catch (error) {
        if (active.current)
          showSnackBar(
            english
              ? 'Could not import the file. Try another format.'
              : '无法导入文件，请尝试其他格式。',
            'error'
          );
      } finally {
        if (active.current) setImporting(false);
      }
    }
  });
  const move = (index: number, delta: number) => {
    const files = [...value];
    [files[index], files[index + delta]] = [files[index + delta], files[index]];
    update(files);
  };
  return (
    <div>
      <InputHeader title={title || (english ? 'Input files' : '输入文件')} />
      <div
        className={`multi-file-dropzone ${isDragging ? 'dragging' : ''}`}
        {...dropHandlers}
        aria-busy={importing}
      >
        {value.length ? (
          <ol className="multi-file-list">
            {value.map((item, index) => (
              <li key={`${item.file.name}-${item.file.size}-${index}`}>
                <span className="file-order">{index + 1}</span>
                <div className="multi-file-preview">
                  {type === 'image' && item.preview ? (
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      loading="lazy"
                    />
                  ) : (
                    <Glyph name={type === 'pdf' ? 'file' : type} size={28} />
                  )}
                </div>
                <div className="multi-file-copy">
                  <span title={item.file.name}>{item.file.name}</span>
                  <small>{(item.file.size / 1024).toFixed(1)} KB</small>
                  {type === 'audio' && item.preview && (
                    <audio
                      controls
                      preload="metadata"
                      src={item.preview}
                      aria-label={item.file.name}
                    />
                  )}
                  {type === 'video' && item.preview && (
                    <video
                      controls
                      preload="metadata"
                      src={item.preview}
                      aria-label={item.file.name}
                    />
                  )}
                </div>
                <div className="file-list-actions">
                  {value.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${english ? 'Move up' : '上移'} ${item.file.name}`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <Glyph
                          name="arrow"
                          size={17}
                          style={{ transform: 'rotate(-90deg)' }}
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${english ? 'Move down' : '下移'} ${item.file.name}`}
                        disabled={index === value.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <Glyph
                          name="arrow"
                          size={17}
                          style={{ transform: 'rotate(90deg)' }}
                        />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${english ? 'Remove' : '移除'} ${item.file.name}`}
                    onClick={() => {
                      release(item);
                      update(value.filter((_, i) => i !== index));
                    }}
                  >
                    <Glyph name="close" size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <button
            type="button"
            className="file-select-button"
            onClick={() => input.current?.click()}
            disabled={importing}
          >
            <Glyph name={type === 'pdf' ? 'file' : type} size={36} />
            <span>
              {isDragging
                ? english
                  ? 'Drop files here'
                  : '松开以导入文件'
                : importing
                  ? english
                    ? 'Importing…'
                    : '正在导入…'
                  : english
                    ? 'Choose files, or drag them here'
                    : '选择文件，或将文件拖到这里'}
            </span>
            <small className="file-types">
              {english ? 'Multiple files supported' : '支持一次导入多个文件'}
            </small>
          </button>
        )}
      </div>
      {value.length > 1 && (
        <p className="file-order-hint">
          {english
            ? 'Files are processed from top to bottom. Use the arrows to change their order.'
            : '文件将按从上到下的顺序处理，可使用箭头调整顺序。'}
        </p>
      )}
      <InputFooter
        handleImport={() => input.current?.click()}
        handleClear={
          value.length
            ? () => {
                value.forEach(release);
                update([]);
              }
            : undefined
        }
      />
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={accept.join(',')}
        disabled={importing}
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
