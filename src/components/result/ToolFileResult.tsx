import { uiText } from 'i18n/uiText';
import { Box, CircularProgress, Typography, useTheme } from '@components/ui';
import React, { useContext } from 'react';
import InputHeader from '../InputHeader';
import greyPattern from '@assets/grey-pattern.png';
import { globalInputHeight } from '../../config/uiConfig';
import ResultFooter from './ResultFooter';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { useTranslation } from 'react-i18next';
import { ToolResultVisibleContext } from '../../tools/page-context';

export default function ToolFileResult({
  title,
  value: resultValue,
  extension,
  loading,
  loadingText
}: {
  title?: string;
  value: File | null;
  extension?: string;
  loading?: boolean;
  loadingText?: string;
}) {
  const { t } = useTranslation();
  const resultVisible = useContext(ToolResultVisibleContext);
  const value = resultVisible ? resultValue : null;
  const [preview, setPreview] = React.useState<string | null>(null);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const theme = useTheme();

  React.useEffect(() => {
    if (value) {
      const objectUrl = URL.createObjectURL(value);
      setPreview(objectUrl);

      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreview(null);
    }
  }, [value]);

  const handleCopy = () => {
    if (value) {
      const blob = new Blob([value], { type: value.type });
      const clipboardItem = new ClipboardItem({ [value.type]: blob });

      navigator.clipboard
        .write([clipboardItem])
        .then(() => showSnackBar(t('toolFileResult.copied'), 'success'))
        .catch((err) => {
          showSnackBar(t('toolFileResult.copyFailed', { error: err }), 'error');
        });
    }
  };

  const handleDownload = () => {
    if (value) {
      let filename: string = value.name;
      if (extension) {
        // Split at the last period to separate filename and extension
        const parts = filename.split('.');
        // If there's more than one part (meaning there was a period)
        if (parts.length > 1) {
          // Remove the last part (the extension) and add the new extension
          parts.pop();
          filename = `${parts.join('.')}.${extension}`;
        } else {
          // No extension exists, just add it
          filename = `${filename}.${extension}`;
        }
      }
      const blob = new Blob([value], { type: value.type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  type SupportedFileType = 'image' | 'video' | 'audio' | 'pdf' | 'unknown';
  // Determine the file type based on MIME type
  const getFileType = (): SupportedFileType => {
    if (!value) return 'unknown';
    if (value.type.startsWith('image/')) return 'image';
    if (value.type.startsWith('video/')) return 'video';
    if (value.type.startsWith('audio/')) return 'audio';
    if (value.type.startsWith('application/pdf')) return 'pdf';
    return 'unknown';
  };

  const fileType = getFileType();

  return (
    <Box>
      <InputHeader title={title || t('toolFileResult.result')} />
      <Box
        className={`file-result-frame ${value || loading ? 'has-result' : 'is-empty'}`}
        sx={{
          width: '100%',
          height: globalInputHeight,
          border: preview ? 0 : 1,
          borderRadius: 2,
          boxShadow: '5',
          bgcolor: 'background.paper'
        }}
      >
        {!value && !loading ? (
          <span>{uiText('Result will appear after processing')}</span>
        ) : loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}
          >
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              {uiText(loadingText || t('toolFileResult.loading'))}
            </Typography>
          </Box>
        ) : (
          preview && (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                backgroundImage:
                  theme.palette.mode === 'dark' ? null : `url(${greyPattern})`
              }}
            >
              {fileType === 'image' && (
                <img
                  src={preview}
                  alt={uiText('Result')}
                  style={{ maxWidth: '100%', maxHeight: globalInputHeight }}
                />
              )}
              {fileType === 'video' && (
                <video
                  src={preview}
                  controls
                  style={{ maxWidth: '100%', maxHeight: globalInputHeight }}
                />
              )}
              {fileType === 'audio' && (
                <audio
                  src={preview}
                  controls
                  style={{ width: '100%', maxWidth: '500px' }}
                />
              )}
              {fileType === 'pdf' && (
                <iframe
                  src={preview}
                  width="100%"
                  height="100%"
                  style={{ maxWidth: '500px' }}
                />
              )}
              {fileType === 'unknown' && (
                <Box sx={{ padding: 2, textAlign: 'center' }}>
                  {uiText(
                    'File processed successfully. Click download to save the result.'
                  )}
                </Box>
              )}
            </Box>
          )
        )}
      </Box>
      {value && (
        <div className="file-result-meta">
          <span>{value.name}</span>
          <span>
            {value.size < 1024 * 1024
              ? `${(value.size / 1024).toFixed(1)} KB`
              : `${(value.size / (1024 * 1024)).toFixed(2)} MB`}
          </span>
        </div>
      )}
      <ResultFooter
        disabled={!value}
        handleCopy={handleCopy}
        handleDownload={handleDownload}
        hideCopy={
          fileType === 'video' || fileType === 'audio' || fileType === 'pdf'
        }
      />
    </Box>
  );
}
