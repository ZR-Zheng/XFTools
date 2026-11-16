import { useState, useEffect, useRef, useMemo } from 'react';
import {
  PDFViewer,
  I18nPlugin,
  type I18nCapability,
  type PDFViewerConfig
} from '@embedpdf/react-pdf-viewer';
import ToolHeaderActions from '@components/ToolHeaderActions';
import Glyph from '@components/workbench/Glyph';
import useFileDrop from 'hooks/useFileDrop';
import useViewportWorkspace from 'hooks/useViewportWorkspace';
import './pdf-editor.css';
import pdfiumUrl from '@embedpdf/pdfium/pdfium.wasm?url';

export default function PdfEditor() {
  const viewerLanguage = useRef<Readonly<I18nCapability> | null>(null);
  const [source, setSource] = useState<{ url: string; name: string } | null>(
    null
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLElement>(null);
  const height = useViewportWorkspace(frame);
  // A viewport resize must not reconfigure the open document or its edits.
  const viewerConfig = useMemo<PDFViewerConfig>(
    () => ({
      src: source?.url,
      wasmUrl: new URL(pdfiumUrl, window.location.href).href,
      fonts: { ui: null, signature: null },
      theme: { preference: 'light' },
      i18n: { defaultLocale: 'zh-CN', fallbackLocale: 'zh-CN' }
    }),
    [source?.url]
  );
  const { isDragging, dropHandlers, addFiles } = useFileDrop({
    accept: ['application/pdf', '.pdf'],
    onFiles: (files) =>
      setSource({ url: URL.createObjectURL(files[0]), name: files[0].name })
  });
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source]
  );
  const clear = () => {
    setSource(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <section
      ref={frame}
      className={`pdf-document-workbench ${isDragging ? 'is-dragging' : ''}`}
      style={source ? { height } : undefined}
      {...dropHandlers}
    >
      <ToolHeaderActions>
        {source && (
          <span className="tool-source-name" title={source.name}>
            {source.name}
          </span>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          aria-label="选择 PDF 文件"
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          className="primary-button"
          type="button"
          onClick={() => fileInput.current?.click()}
        >
          <Glyph name="upload" size={16} />
          {source ? '更换 PDF' : '上传 PDF'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!source}
          onClick={clear}
        >
          清空输入
        </button>
      </ToolHeaderActions>
      {source ? (
        <div className="pdf-document-viewer">
          <PDFViewer
            key={source.url}
            config={viewerConfig}
            onReady={(registry) => {
              viewerLanguage.current =
                registry.getPlugin<I18nPlugin>('i18n')?.provides() || null;
              viewerLanguage.current?.setLocale('zh-CN');
            }}
            style={{ height: '100%' }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="pdf-document-empty"
          onClick={() => fileInput.current?.click()}
        >
          <Glyph name="file" size={32} />
          <strong>选择 PDF，开始编辑</strong>
          <span>也可将文件拖放到此处，添加批注、签名或表单。</span>
        </button>
      )}
    </section>
  );
}
