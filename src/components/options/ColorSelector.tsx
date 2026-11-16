import { uiText } from 'i18n/uiText';
import React, { ChangeEvent } from 'react';
import { Box, Stack, TextField, TextFieldProps } from '@components/ui';

interface ColorSelectorProps {
  value: string;
  onColorChange: (val: string) => void;
  description: string;
}

const ColorSelector: React.FC<ColorSelectorProps & TextFieldProps> = ({
  value = '#ffffff',
  onColorChange,
  description,
  ...props
}) => {
  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    onColorChange(val);
  };

  return (
    <Box
      sx={{
        mb: 3
      }}
    >
      <Stack direction={'row'} spacing={1} sx={{ alignItems: 'end' }}>
        <TextField
          sx={{ backgroundColor: 'background.paper' }}
          value={value}
          onChange={handleColorChange}
          {...props}
          label={uiText(props.label || description)}
        />
        <input
          aria-label={uiText(description)}
          className="color-swatch"
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={handleColorChange}
        />
      </Stack>
    </Box>
  );
};

export default ColorSelector;
