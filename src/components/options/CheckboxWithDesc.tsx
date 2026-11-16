import { uiText } from 'i18n/uiText';
import React from 'react';
import { Box, Checkbox, FormControlLabel } from '@components/ui';
import { useWorkbenchText } from '../../i18n/workbench';

const CheckboxWithDesc = ({
  title,
  description,
  checked,
  onChange,
  disabled
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => {
  const { english } = useWorkbenchText();
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  };

  return (
    <Box
      className="option-check"
      sx={{
        mb: 2
      }}
    >
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
          />
        }
        label={title}
      />
      {description && (
        <details className="option-field-help">
          <summary aria-label={`${title} · ${english ? 'Help' : '说明'}`}>
            ?
          </summary>
          <p>{uiText(description)}</p>
        </details>
      )}
    </Box>
  );
};

export default CheckboxWithDesc;
