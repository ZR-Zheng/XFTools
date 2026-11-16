import { useState, useEffect, useRef } from 'react';
import { Box, Button } from '@components/ui';
import {
  PDFViewer,
  I18nPlugin,
  type I18nCapability
} from '@embedpdf/react-pdf-viewer';
import { useTranslation } from 'react-i18next';

export default function PdfEditor() {
  const { t, i18n } = useTranslation('pdf');
  const locale = i18n.language === 'en' ? 'en' : 'zh-CN';
  const viewerLanguage = useRef<Readonly<I18nCapability> | null>(null);
  useEffect(() => {
    viewerLanguage.current?.setLocale(locale);
  }, [locale]);
  const [src, setSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSrc(URL.createObjectURL(file));
  };

  const handleClear = () => {
    setSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src);
    },
    [src]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ p: 1 }}>
        <Button variant="contained" component="label">
          {t('editor.upload')}
          <input
            type="file"
            accept="application/pdf"
            hidden
            onChange={handleUpload}
          />
        </Button>
        <Button
          variant="outlined"
          style={{ marginLeft: '10px' }}
          disabled={!src}
          onClick={handleClear}
        >
          {t('editor.clear')}
        </Button>
      </Box>
      {src && (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <PDFViewer
            key={src}
            config={{
              src,
              theme: { preference: 'system' },
              i18n: { defaultLocale: locale, fallbackLocale: 'en' }
            }}
            onReady={(registry) => {
              viewerLanguage.current =
                registry.getPlugin<I18nPlugin>('i18n')?.provides() || null;
              viewerLanguage.current?.setLocale(locale);
            }}
            style={{ height: '100%' }}
          />
        </Box>
      )}
    </Box>
  );
}
