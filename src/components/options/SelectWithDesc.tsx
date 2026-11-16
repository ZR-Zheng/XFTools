import { uiText } from 'i18n/uiText';
import React from 'react';
import { Box, MenuItem, Select, SelectChangeEvent } from '@components/ui';

interface Option<T extends string | boolean> {
  label: string;
  value: T;
}

const SelectWithDesc = <T extends string | boolean>({
  selected,
  options,
  onChange,
  description
}: {
  selected: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  description: string;
}) => {
  const handleChange = (event: SelectChangeEvent<T>) => {
    const newValue =
      typeof selected === 'boolean'
        ? event.target.value === 'true'
        : event.target.value;
    onChange(newValue as T);
  };

  return (
    <Box
      className="option-select"
      sx={{
        mb: 2
      }}
    >
      <Select
        label={uiText(description)}
        displayEmpty
        value={selected}
        onChange={handleChange}
      >
        {options.map((option) => (
          <MenuItem key={option.label} value={option.value.toString()}>
            {uiText(option.label)}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
};

export default SelectWithDesc;
