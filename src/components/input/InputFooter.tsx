import { Stack } from '@components/ui';
import { Button } from '@components/ui';
import { PublishIcon } from '@components/ui/icons';
import { ContentPasteIcon } from '@components/ui/icons';
import { ClearIcon } from '@components/ui/icons';
import { useTranslation } from 'react-i18next';

export default function InputFooter({
  handleImport,
  handleCopy,
  handleClear
}: {
  handleImport: () => void;
  handleCopy?: () => void;
  handleClear?: () => void;
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
      <Button onClick={handleImport} startIcon={<PublishIcon />}>
        {t('inputFooter.importFromFile')}
      </Button>
      {handleCopy && (
        <Button onClick={handleCopy} startIcon={<ContentPasteIcon />}>
          {t('inputFooter.copyToClipboard')}
        </Button>
      )}
      {handleClear && (
        <Button onClick={handleClear} startIcon={<ClearIcon />}>
          {t('inputFooter.clear')}
        </Button>
      )}
    </Stack>
  );
}
