import { uiText } from 'i18n/uiText';
import { Box, TextField, TextFieldProps } from '@components/ui';
import React from 'react';
import { useWorkbenchText } from 'i18n/workbench';
import { fieldLabel } from './field-labels';

type OwnProps = {
  description?: string;
  value: string | number;
  onOwnChange: (value: string) => void;
  placeholder?: string;
};
const TextFieldWithDesc = ({
  description,
  value,
  onOwnChange,
  placeholder,
  ...props
}: TextFieldProps & OwnProps) => {
  const { english } = useWorkbenchText();
  const label = uiText(
    props.label || props.title || fieldLabel(description, props.name, english)
  );
  return (
    <Box
      className="option-field"
      sx={{
        mb: 2
      }}
    >
      <TextField
        placeholder={uiText(placeholder)}
        sx={{ backgroundColor: 'background.paper' }}
        value={value}
        onChange={(event) => onOwnChange(event.target.value)}
        {...props}
        label={label}
      />
      {description && uiText(description) !== label && (
        <details className="option-field-help">
          <summary aria-label={`${label} · ${english ? 'Help' : '说明'}`}>
            ?
          </summary>
          <p>{uiText(description)}</p>
        </details>
      )}
    </Box>
  );
};

export default TextFieldWithDesc;
