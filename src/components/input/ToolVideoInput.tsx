import { useRef, useState } from 'react';
import BaseFileInput from './BaseFileInput';
import { BaseFileInputProps } from './file-input-utils';
import MediaTrimControls from './MediaTrimControls';

interface VideoFileInputProps extends Omit<BaseFileInputProps, 'accept'> {
  showTrimControls?: boolean;
  onTrimChange?: (start: number, end: number) => void;
  trimStart?: number;
  trimEnd?: number;
  accept?: string[];
}
export default function ToolVideoInput({
  showTrimControls = false,
  onTrimChange,
  trimStart = 0,
  trimEnd = 100,
  accept = ['video/*', '.mkv'],
  ...props
}: VideoFileInputProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  return (
    <BaseFileInput {...props} type="video" accept={accept}>
      {({ preview }) => (
        <div className={`media-preview ${showTrimControls ? 'with-trim' : ''}`}>
          <video
            ref={video}
            src={preview}
            controls
            preload="metadata"
            onLoadedMetadata={(e) => {
              const length = e.currentTarget.duration;
              if (Number.isFinite(length)) {
                setDuration(length);
                if (showTrimControls) onTrimChange?.(0, length);
              }
            }}
            onTimeUpdate={() => {
              if (
                showTrimControls &&
                video.current &&
                video.current.currentTime >= trimEnd
              )
                video.current.pause();
            }}
          />
          {showTrimControls && duration > 0 && onTrimChange && (
            <MediaTrimControls
              duration={duration}
              start={trimStart}
              end={trimEnd}
              onChange={onTrimChange}
              media={video}
            />
          )}
        </div>
      )}
    </BaseFileInput>
  );
}
