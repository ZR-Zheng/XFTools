import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import InputHeader from '../InputHeader';
import InputFooter from './InputFooter';
import {
  BaseFileInputProps,
  createObjectURL,
  revokeObjectURL
} from './file-input-utils';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { useTranslation } from 'react-i18next';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';
interface Props extends BaseFileInputProps {
  children: (props: { preview: string | undefined }) => ReactNode;
  type: 'image' | 'video' | 'audio' | 'pdf';
}
export default function BaseFileInput({
  value,
  onChange,
  accept,
  title,
  children,
  type
}: Props) {
  const { t } = useTranslation();
  const { english } = useWorkbenchText();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [preview, setPreview] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const label = english
    ? type.toUpperCase()
    : { image: '图片', video: '视频', audio: '音频', pdf: 'PDF 文件' }[type];
  useEffect(() => {
    if (!value) {
      setPreview(undefined);
      return;
    }
    const url = createObjectURL(value);
    setPreview(url);
    return () => revokeObjectURL(url);
  }, [value]);
  const accepted = (file: File) =>
    accept.some((item) =>
      item.endsWith('/*')
        ? file.type.startsWith(item.slice(0, -1))
        : item.startsWith('.')
          ? file.name.toLowerCase().endsWith(item.toLowerCase())
          : item === file.type
    );
  const select = (file?: File) => {
    if (!file) return;
    if (accepted(file)) onChange(file);
    else showSnackBar(t('toolMultipleInput.invalidFileType'), 'error');
  };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items || [])]
        .map((item) => item.getAsFile())
        .find((file) => file && accepted(file));
      if (file) {
        event.preventDefault();
        onChange(file);
      }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [onChange, accept]);
  return (
    <div>
      <InputHeader
        title={title || (english ? 'Input ' + label : '输入' + label)}
      />
      <div
        className={`file-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          select(event.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          <div className="file-preview">{children({ preview })}</div>
        ) : (
          <button
            type="button"
            className="file-select-button"
            onClick={() => input.current?.click()}
          >
            <Glyph name={type === 'pdf' ? 'file' : type} size={36} />
            <span>
              {dragging
                ? t('baseFileInput.dropFileHere', { type: label })
                : t('baseFileInput.selectFileDescription', { type: label })}
            </span>
          </button>
        )}
      </div>
      {value && <div className="file-details"><span>{value.name}</span><span>{value.size < 1024 * 1024 ? `${(value.size / 1024).toFixed(1)} KB` : `${(value.size / (1024 * 1024)).toFixed(1)} MB`}</span></div>}
      <InputFooter
        handleImport={() => input.current?.click()}
        handleClear={
          value
            ? () => {
                onChange(null);
                if (input.current) input.current.value = '';
              }
            : undefined
        }
      />
      <input
        ref={input}
        type="file"
        hidden
        accept={accept.join(',')}
        onChange={(event) => select(event.target.files?.[0])}
      />
    </div>
  );
}
