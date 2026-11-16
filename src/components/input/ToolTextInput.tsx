import { Box, TextField } from '@components/ui';
import { uiText } from 'i18n/uiText';
import React, { useContext, useRef } from 'react';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import InputHeader from '../InputHeader';
import InputFooter from './InputFooter';
import { useTranslation } from 'react-i18next';
import CodeEditor from '../ui/CodeEditor';
import { ToolPageContext } from '../../tools/page-context';
import { useWorkbenchText } from 'i18n/workbench';

export default function ToolTextInput({
  value,
  onChange,
  title,
  placeholder,
  language
}: {
  title?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  language?: string;
}) {
  const { t } = useTranslation();
  const { experience } = useContext(ToolPageContext);
  const { english } = useWorkbenchText();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => showSnackBar(t('toolTextInput.copied'), 'success'))
      .catch((err) => {
        showSnackBar(t('toolTextInput.copyFailed', { error: err }), 'error');
      });
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          onChange(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  return (
    <Box
      className={
        ['scalar', 'cron'].includes(experience.entry)
          ? 'compact-entry'
          : undefined
      }
    >
      <InputHeader title={title || t('toolTextInput.input')} />
      {language ? (
        <CodeEditor
          language={language}
          value={value}
          onChange={onChange}
          aria-label={title || t('toolTextInput.input')}
        />
      ) : (
        <TextField
          value={value}
          onChange={(event) => onChange(event.target.value)}
          fullWidth
          multiline
          rows={experience.rows}
          placeholder={uiText(
            placeholder ||
              experience.placeholder?.[english ? 1 : 0] ||
              t('toolTextInput.placeholder')
          )}
          slotProps={{
            htmlInput: {
              'data-testid': 'text-input',
              'aria-label': title || t('toolTextInput.input')
            }
          }}
        />
      )}
      {experience.entry === 'cron' && (
        <div className="cron-presets">
          {[
            ['* * * * *', '每分钟', 'Every minute'],
            ['*/5 * * * *', '每 5 分钟', 'Every 5 minutes'],
            ['0 9 * * 1-5', '工作日 9 点', 'Weekdays at 9']
          ].map(([value, zh, en]) => (
            <button
              type="button"
              key={value}
              className="secondary-button"
              onClick={() => onChange(value)}
            >
              {english ? en : zh}
            </button>
          ))}
        </div>
      )}
      <InputFooter
        handleCopy={handleCopy}
        handleImport={handleImportClick}
        handleClear={() => onChange('')}
      />
      <input
        type="file"
        accept="*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </Box>
  );
}
