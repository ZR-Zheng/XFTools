import { Box, FormControlLabel, Radio, RadioGroup } from '@components/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ToolContent from '@components/ToolContent';
import { ToolComponentProps } from '@tools/defineTool';
import { GetGroupsType } from '@components/options/ToolOptions';
import { InitialValuesType } from './types';
import ToolAudioInput from '@components/input/ToolAudioInput';
import ToolFileResult from '@components/result/ToolFileResult';
import TextFieldWithDesc from '@components/options/TextFieldWithDesc';
import { trimAudio } from './service';
import { getFileExtension } from '@utils/file';
import * as Yup from 'yup';

const initialValues: InitialValuesType = {
  startTime: '00:00:00',
  endTime: '00:01:00',
  outputFormat: 'mp3'
};

const clockSeconds = (value: string) =>
  value.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0);
const clockTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor(seconds / 60) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
};

const formatOptions = [
  { label: 'MP3', value: 'mp3' },
  { label: 'AAC', value: 'aac' },
  { label: 'WAV', value: 'wav' }
];

export default function Trim({ title }: ToolComponentProps) {
  const { t } = useTranslation('audio');
  const [input, setInput] = useState<File | null>(null);
  const [result, setResult] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const compute = async (
    optionsValues: InitialValuesType,
    input: File | null
  ) => {
    if (!input) return;
    setLoading(true);
    try {
      const trimmedFile = await trimAudio(input, optionsValues);
      setResult(trimmedFile);
    } catch (err) {
      console.error(`Failed to trim audio: ${err}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getGroups: GetGroupsType<InitialValuesType> | null = ({
    values,
    updateField
  }) => [
    {
      title: t('trim.timeSettings'),
      component: (
        <Box>
          <TextFieldWithDesc
            value={values.startTime}
            onOwnChange={(val) => updateField('startTime', val)}
            description={t('trim.startTimeDescription')}
            label={t('trim.startTime')}
          />
          <Box
            sx={{
              mt: 2
            }}
          >
            <TextFieldWithDesc
              value={values.endTime}
              onOwnChange={(val) => updateField('endTime', val)}
              description={t('trim.endTimeDescription')}
              label={t('trim.endTime')}
            />
          </Box>
        </Box>
      )
    },
    {
      title: t('trim.outputFormat'),
      component: (
        <Box
          sx={{
            mt: 2
          }}
        >
          <RadioGroup
            row
            value={values.outputFormat}
            onChange={(e) =>
              updateField(
                'outputFormat',
                e.target.value as 'mp3' | 'aac' | 'wav'
              )
            }
          >
            {formatOptions.map((opt) => (
              <FormControlLabel
                key={opt.value}
                value={opt.value}
                control={<Radio />}
                label={opt.label}
              />
            ))}
          </RadioGroup>
        </Box>
      )
    }
  ];

  return (
    <ToolContent
      title={title}
      input={input}
      renderCustomInput={(values, setFieldValue) => (
        <ToolAudioInput
          value={input}
          onChange={setInput}
          title={t('trim.inputTitle')}
          trimStart={clockSeconds(values.startTime)}
          trimEnd={clockSeconds(values.endTime)}
          onTrimChange={(start, end) => {
            setFieldValue('startTime', clockTime(start));
            setFieldValue('endTime', clockTime(end));
          }}
        />
      )}
      resultComponent={
        <ToolFileResult
          title={t('trim.resultTitle')}
          loading={loading}
          value={result}
          extension={result ? getFileExtension(result.name) : undefined}
        />
      }
      initialValues={initialValues}
      validationSchema={Yup.object({
        startTime: Yup.string().test(
          'start',
          t('trim.startTimeDescription'),
          (value) =>
            Number.isFinite(clockSeconds(value || '')) &&
            clockSeconds(value || '') >= 0
        ),
        endTime: Yup.string().test(
          'end',
          t('trim.endTimeDescription'),
          (value, context) =>
            Number.isFinite(clockSeconds(value || '')) &&
            clockSeconds(value || '') > clockSeconds(context.parent.startTime)
        )
      })}
      getGroups={getGroups}
      setInput={setInput}
      compute={compute}
      toolInfo={{
        title: t('trim.toolInfo.title', { title }),
        description: t('trim.toolInfo.longDescription')
      }}
    />
  );
}
