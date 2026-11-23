import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PDFViewer,
  type PDFViewerConfig,
  type PluginRegistry,
  type AnnotationPlugin,
  type DocumentManagerPlugin,
  type ExportPlugin
} from '@embedpdf/react-pdf-viewer';
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

const documentId = 'xftools-working-copy';

export default function PdfAdvancedEditor({
  file,
  onApply,
  onClose,
  t
}: {
  file: File;
  onApply: (file: File) => Promise<void>;
  onClose: () => void;
  t: (zh: string, en: string) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const registry = useRef<PluginRegistry | null>(null);
  const unsubscribe = useRef<(() => void)[]>([]);
  const [url, setUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const blobUrl = URL.createObjectURL(file);
    setUrl(blobUrl);
    dialog.current?.showModal();
    return () => {
      unsubscribe.current.forEach((dispose) => dispose());
      URL.revokeObjectURL(blobUrl);
    };
  }, [file]);
  const config = useMemo<PDFViewerConfig>(
    () => ({
      wasmUrl: new URL(wasmUrl, window.location.href).href,
      fonts: { ui: null, signature: null },
      fontFallback: null,
      i18n: { defaultLocale: 'zh-CN', fallbackLocale: 'zh-CN' },
      theme: { preference: 'light' },
      tabBar: 'never',
      disabledCategories: [
        'document-open',
        'document-close',
        'document-download',
        'document-print',
        'document-security'
      ],
      documentManager: {
        maxDocuments: 1,
        initialDocuments: [
          { url, documentId, name: file.name, mode: 'full-fetch' }
        ]
      }
    }),
    [url, file.name]
  );

  const handleReady = (next: PluginRegistry) => {
    unsubscribe.current.forEach((dispose) => dispose());
    registry.current = next;
    const manager = next
      .getPlugin<DocumentManagerPlugin>('document-manager')
      ?.provides();
    if (!manager) {
      setError(
        t('无法初始化高级编辑器。', 'The advanced editor could not initialize.')
      );
      return;
    }
    const update = () => setReady(Boolean(manager.getDocument(documentId)));
    unsubscribe.current = [
      manager.onDocumentOpened(update),
      manager.onDocumentClosed(update),
      manager.onDocumentError(() => {
        setError(
          t('无法打开当前工作副本。', 'The working copy could not be opened.')
        );
      })
    ];
    update();
  };
  const apply = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError('');
    try {
      const exporter = registry.current
        ?.getPlugin<ExportPlugin>('export')
        ?.provides();
      if (!exporter)
        throw new Error(
          t('无法保存高级编辑结果。', 'The advanced edit could not be saved.')
        );
      await registry.current
        ?.getPlugin<AnnotationPlugin>('annotation')
        ?.provides()
        ?.commit()
        .toPromise();
      const bytes = await exporter
        .forDocument(documentId)
        .saveAsCopy()
        .toPromise();
      await onApply(new File([bytes], file.name, { type: 'application/pdf' }));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('保存失败，请重试。', 'Could not save. Try again.')
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <dialog
      className="pdf-advanced-dialog"
      ref={dialog}
      aria-labelledby="pdf-advanced-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <header>
        <h2 id="pdf-advanced-title">
          {t('高级 PDF 编辑', 'Advanced PDF editing')}
        </h2>
        <button type="button" disabled={saving} onClick={onClose}>
          {t('关闭', 'Close')}
        </button>
        <button
          type="button"
          className="pdf-primary"
          disabled={!ready || saving}
          onClick={() => void apply()}
        >
          {t('应用并返回工作台', 'Apply to workspace')}
        </button>
      </header>
      {error && (
        <p className="pdf-error" role="alert">
          {error}
        </p>
      )}
      <div className="pdf-advanced-viewer" inert={saving}>
        {url && (
          <PDFViewer
            config={config}
            style={{ height: '100%' }}
            onReady={handleReady}
          />
        )}
      </div>
    </dialog>
  );
}
