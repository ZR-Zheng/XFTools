import { Box, CircularProgress, TextField, Typography } from '@components/ui';
import React, { useContext } from 'react';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import InputHeader from '../InputHeader';
import ResultFooter from './ResultFooter';
import mime from 'mime';
import { globalInputHeight } from '../../config/uiConfig';
import { useTranslation } from 'react-i18next';
import CodeEditor from '../ui/CodeEditor';
import {
  ToolPageContext,
  ToolSourceContext,
  ToolResultVisibleContext
} from '../../tools/page-context';

export default function ToolTextResult({
  title,
  value: resultValue,
  extension = 'txt',
  loading,
  language
}: {
  title?: string;
  value: string;
  extension?: string;
  keepSpecialCharacters?: boolean;
  loading?: boolean;
  language?: string;
}) {
  const { t } = useTranslation();
  const { experience } = useContext(ToolPageContext);
  const source = useContext(ToolSourceContext);
  const resultVisible = useContext(ToolResultVisibleContext);
  const value =
    !resultVisible ||
    (typeof source === 'string' &&
      !source &&
      experience.layout !== 'comparison')
      ? ''
      : resultValue;
  const compact = ['scalar', 'cron'].includes(experience.entry);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const handleCopy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => showSnackBar(t('toolTextResult.copied'), 'success'))
      .catch((err) => {
        showSnackBar(t('toolTextResult.copyFailed', { error: err }), 'error');
      });
  };
  const handleDownload = () => {
    const filename = `output-xftools.${extension}`;

    const mimeType = mime.getType(extension) || 'text/plain';

    const blob = new Blob([value], {
      type: mimeType
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  return (
    <Box className={compact ? 'compact-result' : undefined}>
      <InputHeader title={title || t('toolTextResult.result')} />
      {loading ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: globalInputHeight
          }}
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            {t('toolTextResult.loading')}
          </Typography>
        </Box>
      ) : language ? (
        <CodeEditor
          value={value}
          language={language}
          options={{ readOnly: true }}
          aria-label={title || t('toolTextResult.result')}
        />
      ) : (
        <TextField
          value={value}
          fullWidth
          multiline
          rows={
            compact
              ? Math.min(8, Math.max(2, value.split('\n').length))
              : experience.rows
          }
          slotProps={{
            htmlInput: {
              'data-testid': 'text-result',
              readOnly: true,
              'aria-label': title || t('toolTextResult.result')
            }
          }}
        />
      )}
      <ResultFooter handleCopy={handleCopy} handleDownload={handleDownload} />
    </Box>
  );
}
