import { uiText } from 'i18n/uiText';
import { Box, Radio } from '@components/ui';
import { Typography } from '@components/ui';
import React from 'react';
import { globalDescriptionFontSize } from '../../config/uiConfig';

interface SimpleRadioProps {
  title: string;
  description?: string;
  checked: boolean;
  onClick: () => void;
}

const SimpleRadio: React.FC<SimpleRadioProps> = ({
  onClick,
  title,
  description,
  checked
}) => {
  return (
    <Box>
      <label className="ui-choice">
        <Radio checked={checked} onChange={onClick} />
        <span>{uiText(title)}</span>
      </label>
      {description && (
        <Typography
          sx={{
            ml: 2,
            fontSize: globalDescriptionFontSize
          }}
        >
          {uiText(description)}
        </Typography>
      )}
    </Box>
  );
};

export default SimpleRadio;
