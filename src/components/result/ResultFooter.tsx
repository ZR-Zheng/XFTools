import { uiText } from 'i18n/uiText';
import { Stack } from '@components/ui';
import { Button } from '@components/ui';
import { DownloadIcon } from '@components/ui/icons';
import { ContentPasteIcon } from '@components/ui/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ResultFooter({
  handleDownload,
  handleCopy,
  disabled,
  hideCopy,
  downloadLabel
}: {
  handleDownload: () => void;
  handleCopy?: () => void;
  disabled?: boolean;
  hideCopy?: boolean;
  downloadLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Stack
      direction={'row'}
      spacing={2}
      sx={{
        mt: 1
      }}
    >
      <Button
        disabled={disabled}
        onClick={handleDownload}
        startIcon={<DownloadIcon />}
      >
        {uiText(downloadLabel || t('resultFooter.download'))}
      </Button>
      {!hideCopy && (
        <Button
          disabled={disabled}
          onClick={handleCopy}
          startIcon={<ContentPasteIcon />}
        >
          {t('resultFooter.copy')}
        </Button>
      )}
    </Stack>
  );
}
