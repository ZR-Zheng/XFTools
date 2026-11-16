import { Box, Typography, Slider } from '@components/ui';
import React, { useState, useMemo } from 'react';
import * as Yup from 'yup';
import ToolFileResult from '@components/result/ToolFileResult';
import ToolContent from '@components/ToolContent';
import { ToolComponentProps } from '@tools/defineTool';
import { GetGroupsType } from '@components/options/ToolOptions';
import ToolVideoInput from '@components/input/ToolVideoInput';
import ToolAudioInput from '@components/input/ToolAudioInput';
import SimpleRadio from '@components/options/SimpleRadio';
import SelectWithDesc from '@components/options/SelectWithDesc';
import TextFieldWithDesc from '@components/options/TextFieldWithDesc';
import { useTranslation } from 'react-i18next';
import { addAudioToVideo } from './service';
import { AudioMode, initialValuesType } from './types';

const initialValues: initialValuesType = {
  mode: 'replace',
  volume: 100,
  loop: true,
  startTime: '00:00:00',
  endTime: '00:00:00',
  timingMode: 'default'
};

const validationSchema = Yup.object({
  mode: Yup.string().oneOf(['replace', 'mix']).required(),
  volume: Yup.number().min(0).max(200).required(),
  loop: Yup.boolean().required(),
  timingMode: Yup.string()
    .oneOf(['default', 'start', 'end', 'startEnd'])
    .required(),
  startTime: Yup.string()
    .matches(/^\d{2}:\d{2}:\d{2}$/)
    .required(),
  endTime: Yup.string()
    .matches(/^\d{2}:\d{2}:\d{2}$/)
    .required()
});

const modeOptions: { value: AudioMode; label: string }[] = [
  { value: 'replace', label: 'replace' },
  { value: 'mix', label: 'mix' }
];

const durationModeOptions = [
  { value: 'default', label: 'addAudio.timingDefault' },
  { value: 'start', label: 'addAudio.timingStart' },
  { value: 'end', label: 'addAudio.timingEnd' },
  { value: 'startEnd', label: 'addAudio.timingStartEnd' }
] as const;

export default function AddAudio({ title }: ToolComponentProps) {
  const { t } = useTranslation('video');
  const [videoInput, setVideoInput] = useState<File | null>(null);
  const [audioInput, setAudioInput] = useState<File | null>(null);
  const [result, setResult] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useMemo(
    () =>
      videoInput && audioInput
        ? { video: videoInput, audio: audioInput }
        : null,
    [videoInput, audioInput]
  );

  // core compute function
  const compute = async (
    video: File,
    audio: File,
    options: initialValuesType
  ) => {
    if (!video || !audio) return;
    try {
      setLoading(true);
      const outputFile = await addAudioToVideo(video, audio, options);
      setResult(outputFile);
    } catch (err) {
      console.error('Error adding audio to video:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getGroups: GetGroupsType<typeof initialValues> = ({
    values,
    updateField
  }) => [
    {
      title: t('addAudio.audioFile'),
      component: (
        <ToolAudioInput
          value={audioInput}
          onChange={(file) => setAudioInput(file)}
          title={t('addAudio.audioInputTitle')}
        />
      )
    },
    {
      title: t('addAudio.mode'),
      component: (
        <Box>
          {modeOptions.map((option) => (
            <SimpleRadio
              key={option.value}
              title={
                option.value === 'replace'
                  ? t('addAudio.modeReplace')
                  : t('addAudio.modeMix')
              }
              checked={values.mode === option.value}
              onClick={() => {
                updateField('mode', option.value);
              }}
            />
          ))}
          <Typography
            sx={{
              mt: 3,
              mb: 1,
              fontSize: 22
            }}
          >
            {t('addAudio.loopOption')}
          </Typography>
          <SimpleRadio
            title={t('addAudio.loop')}
            checked={values.loop === true}
            onClick={() => {
              updateField('loop', true);
            }}
          />
          <SimpleRadio
            title={t('addAudio.noLoop')}
            checked={values.loop === false}
            onClick={() => {
              updateField('loop', false);
            }}
          />
        </Box>
      )
    },
    {
      title: t('addAudio.volume'),
      component: (
        <Box>
          <Slider
            aria-label={t('addAudio.volume')}
            value={values.volume}
            onChange={(_, value) => {
              const vol = Array.isArray(value) ? value[0] : value;
              updateField('volume', vol);
            }}
            min={0}
            max={200}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ mt: 1 }}
          />
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 14
            }}
          >
            {values.volume}%
          </Typography>

          <Typography
            sx={{
              mt: 2,
              mb: 1,
              fontSize: 22
            }}
          >
            {t('addAudio.timing')}
          </Typography>
          <SelectWithDesc
            selected={values.timingMode}
            options={durationModeOptions.map((opt) => ({
              label: t(opt.label),
              value: opt.value
            }))}
            onChange={(value) => {
              updateField('timingMode', value);
              if (value === 'default') {
                updateField('startTime', '00:00:00');
                updateField('endTime', '00:00:00');
              }
            }}
            description={t('addAudio.timingModeDesc')}
          />
          {(values.timingMode === 'start' ||
            values.timingMode === 'startEnd') && (
            <Box
              sx={{
                mt: 1
              }}
            >
              <TextFieldWithDesc
                value={values.startTime}
                onOwnChange={(val) => {
                  updateField('startTime', val);
                }}
                label={t('addAudio.startTime')}
                description={t('addAudio.startTimeDesc')}
              />
            </Box>
          )}
          {(values.timingMode === 'end' ||
            values.timingMode === 'startEnd') && (
            <Box
              sx={{
                mt: 1
              }}
            >
              <TextFieldWithDesc
                value={values.endTime}
                onOwnChange={(val) => {
                  updateField('endTime', val);
                }}
                label={t('addAudio.endTime')}
                description={t('addAudio.endTimeDesc')}
              />
            </Box>
          )}
        </Box>
      )
    }
  ];

  return (
    <ToolContent
      title={title}
      input={input}
      inputComponent={
        <ToolVideoInput
          value={videoInput}
          onChange={setVideoInput}
          title={t('addAudio.videoInputTitle')}
        />
      }
      resultComponent={
        <ToolFileResult
          title={t('addAudio.resultTitle')}
          value={result}
          extension="mp4"
          loading={loading}
          loadingText={t('addAudio.loadingText')}
        />
      }
      initialValues={initialValues}
      getGroups={getGroups}
      compute={(values) => compute(videoInput!, audioInput!, values)}
      validationSchema={validationSchema}
    />
  );
}
