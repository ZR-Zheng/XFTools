import { uiText } from 'i18n/uiText';
import { Box, TextField, TextFieldProps } from '@mui/material';
import Typography from '@mui/material/Typography';
import React from 'react';

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
  return (
    <Box
      sx={{
        mb: 3
      }}
    >
      <TextField
        placeholder={uiText(placeholder)}
        sx={{ backgroundColor: 'background.paper' }}
        value={value}
        onChange={(event) => onOwnChange(event.target.value)}
        {...props}
        label={uiText(props.label)}
      />
      {description && (
        <Typography
          sx={{
            fontSize: 12,
            mt: 1
          }}
        >
          {uiText(description)}
        </Typography>
      )}
    </Box>
  );
};

export default TextFieldWithDesc;
