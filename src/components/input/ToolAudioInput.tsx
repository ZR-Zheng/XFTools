import { useEffect, useRef, useState } from 'react';
import BaseFileInput from './BaseFileInput';
import { BaseFileInputProps } from './file-input-utils';
import { AUDIO_FORMATS } from 'pages/tools/converters/audio-converter/types';
import MediaTrimControls from './MediaTrimControls';
import { useWorkbenchText } from '../../i18n/workbench';

interface AudioFileInputProps extends Omit<BaseFileInputProps, 'accept'> {
  accept?: string[];
  trimStart?: number;
  trimEnd?: number;
  onTrimChange?: (start: number, end: number) => void;
}
const AUDIO_ACCEPT_TYPES = [
  'audio/*',
  ...Object.keys(AUDIO_FORMATS).map((format) => `.${format}`)
];
function Waveform({ file }: { file: File | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { english } = useWorkbenchText();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (
      !file ||
      file.size > 100 * 1024 * 1024 ||
      typeof AudioContext === 'undefined'
    )
      return;
    let active = true;
    const context = new AudioContext();
    void file
      .arrayBuffer()
      .then((data) => context.decodeAudioData(data))
      .then((audio) => {
        if (!active || !canvas.current) return;
        const element = canvas.current,
          paint = element.getContext('2d');
        if (!paint) return;
        const data = audio.getChannelData(0),
          step = Math.max(1, Math.floor(data.length / element.width));
        paint.clearRect(0, 0, element.width, element.height);
        paint.fillStyle = '#5b82ec';
        for (let x = 0; x < element.width; x += 3) {
          let peak = 0;
          for (
            let j = x * step;
            j < Math.min(data.length, (x + 3) * step);
            j += Math.max(1, Math.floor(step / 30))
          )
            peak = Math.max(peak, Math.abs(data[j]));
          const height = Math.max(2, peak * element.height);
          paint.fillRect(x, (element.height - height) / 2, 2, height);
        }
        setReady(true);
      })
      .catch(() => {})
      .finally(() => {
        void context.close().catch(() => {});
      });
    return () => {
      active = false;
    };
  }, [file]);
  return (
    <canvas
      className={`audio-waveform ${ready ? 'ready' : ''}`}
      ref={canvas}
      width={900}
      height={70}
      role="img"
      aria-label={english ? 'Audio waveform' : '音频波形'}
    />
  );
}
export default function ToolAudioInput({
  accept = AUDIO_ACCEPT_TYPES,
  trimStart = 0,
  trimEnd = 0,
  onTrimChange,
  ...props
}: AudioFileInputProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  return (
    <BaseFileInput {...props} type="audio" accept={accept}>
      {({ preview }) => (
        <div className="media-preview audio-preview">
          <Waveform file={props.value} />
          <audio
            ref={audio}
            src={preview}
            controls
            preload="metadata"
            onLoadedMetadata={(e) => {
              const length = e.currentTarget.duration;
              if (Number.isFinite(length)) {
                setDuration(length);
                onTrimChange?.(0, length);
              }
            }}
            onTimeUpdate={() => {
              if (
                onTrimChange &&
                audio.current &&
                audio.current.currentTime >= trimEnd
              )
                audio.current.pause();
            }}
          />
          {onTrimChange && duration > 0 && (
            <MediaTrimControls
              duration={duration}
              start={trimStart}
              end={trimEnd}
              onChange={onTrimChange}
              media={audio}
            />
          )}
        </div>
      )}
    </BaseFileInput>
  );
}
