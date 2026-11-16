import { Box } from '@components/ui';
import React, { useState } from 'react';
import * as Yup from 'yup';
import ToolImageInput from '@components/input/ToolImageInput';
import ToolFileResult from '@components/result/ToolFileResult';
import ColorSelector from '@components/options/ColorSelector';
import Color from 'color';
import TextFieldWithDesc from 'components/options/TextFieldWithDesc';
import { applyColorMask, type MaskMode } from './service';
import SimpleRadio from '@components/options/SimpleRadio';
import { useWorkbenchText } from 'i18n/workbench';
import ToolContent from '@components/ToolContent';
import { ToolComponentProps } from '@tools/defineTool';
import { GetGroupsType } from '@components/options/ToolOptions';
import { canvasToBlob } from '@utils/image';

const initialValues = {
  fromColor: 'white',
  similarity: '10',
  backgroundColor: '#ffffff',
  mode: 'transparent' as MaskMode
};

const validationSchema = Yup.object({
  similarity: Yup.number().min(0).max(100).required()
});

export default function CreateTransparent({ title }: ToolComponentProps) {
  const { english } = useWorkbenchText();
  const [input, setInput] = useState<File | null>(null);
  const [result, setResult] = useState<File | null>(null);

  const compute = (optionsValues: typeof initialValues, input: any) => {
    if (!input) return;
    const { fromColor, similarity, backgroundColor, mode } = optionsValues;

    let fromRgb: [number, number, number];
    let bgRgb: [number, number, number];

    try {
      //@ts-ignore
      fromRgb = Color(fromColor).rgb().array();
      //@ts-ignore
      bgRgb = Color(backgroundColor).rgb().array();
    } catch {
      throw new Error(english ? 'Choose a valid color.' : '请选择有效的颜色。');
    }
    const processImage = async (
      file: File,
      fromColor: [number, number, number],
      similarity: number
    ) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx == null) throw new Error('Canvas is not supported.');
      const img = new Image();
      const url = URL.createObjectURL(file);
      try {
        img.src = url;
        await img.decode();
      } finally {
        URL.revokeObjectURL(url);
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      applyColorMask(data, fromColor, similarity, mode, bgRgb);

      ctx.putImageData(imageData, 0, 0);

      const blob = await canvasToBlob(canvas);
      setResult(
        new File(
          [blob],
          file.name.replace(/\.[^.]+$/, '') +
            (mode === 'transparent' ? '-transparent.png' : '-background.png'),
          { type: 'image/png' }
        )
      );
    };

    return processImage(input, fromRgb, Number(similarity));
  };

  const getGroups: GetGroupsType<typeof initialValues> = ({
    values,
    updateField
  }) => [
    {
      title: 'From color and similarity',
      component: (
        <Box>
          <SimpleRadio
            checked={values.mode === 'transparent'}
            onClick={() => updateField('mode', 'transparent')}
            title={
              english ? 'Make matching color transparent' : '将指定颜色变为透明'
            }
          />
          <SimpleRadio
            checked={values.mode === 'replace'}
            onClick={() => updateField('mode', 'replace')}
            title={
              english ? 'Replace with a background color' : '替换为背景颜色'
            }
          />
          <ColorSelector
            value={values.fromColor}
            onColorChange={(val) => updateField('fromColor', val)}
            description={'Replace this color (from color)'}
            slotProps={{
              htmlInput: { 'data-testid': 'color-input' }
            }}
          />
          <TextFieldWithDesc
            value={values.similarity}
            onOwnChange={(val) => updateField('similarity', val)}
            description={
              'Match this % of similar colors of the from color. For example, 10% white will match white and a little bit of gray.'
            }
          />

          {values.mode === 'replace' && (
            <ColorSelector
              value={values.backgroundColor}
              onColorChange={(val) => updateField('backgroundColor', val)}
              description={'Background color for replaced pixels'}
            />
          )}
        </Box>
      )
    }
  ];

  return (
    <ToolContent
      title={title}
      inputComponent={
        <ToolImageInput
          value={input}
          onChange={setInput}
          accept={['image/*']}
          title={'Input image'}
        />
      }
      resultComponent={
        <ToolFileResult
          title={'Transparent PNG'}
          value={result}
          extension={'png'}
        />
      }
      initialValues={initialValues}
      getGroups={getGroups}
      compute={compute}
      input={input}
      validationSchema={validationSchema}
      toolInfo={{
        title: 'Create Transparent PNG',
        description:
          'This tool allows you to make specific colors in an image transparent. You can select the color to replace and adjust the similarity threshold to include similar colors.'
      }}
    />
  );
}
