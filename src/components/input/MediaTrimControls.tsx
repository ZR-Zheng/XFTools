import type { RefObject } from 'react';
import { useWorkbenchText } from '../../i18n/workbench';

export default function MediaTrimControls({
  duration,
  start,
  end,
  onChange,
  media
}: {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  media: RefObject<HTMLMediaElement | null>;
}) {
  const { english } = useWorkbenchText();
  const boundedEnd = Math.min(duration, end);
  const change = (value: number, side: 'start' | 'end') => {
    if (!Number.isFinite(value)) return;
    if (side === 'start')
      onChange(Math.max(0, Math.min(value, boundedEnd - 0.01)), boundedEnd);
    else onChange(start, Math.min(duration, Math.max(start + 0.01, value)));
  };
  return (
    <div className="media-trim-controls">
      <div className="trim-time-fields">
        {(['start', 'end'] as const).map((side) => (
          <label key={side}>
            {side === 'start'
              ? english
                ? 'Start (seconds)'
                : '开始时间（秒）'
              : english
                ? 'End (seconds)'
                : '结束时间（秒）'}
            <input
              type="number"
              min={0}
              max={duration}
              step="0.01"
              value={Number((side === 'start' ? start : boundedEnd).toFixed(3))}
              onChange={(e) => change(e.target.valueAsNumber, side)}
            />
            <input
              type="range"
              aria-label={
                side === 'start'
                  ? english
                    ? 'Selection start'
                    : '选区起点'
                  : english
                    ? 'Selection end'
                    : '选区终点'
              }
              min={0}
              max={duration}
              step="0.01"
              value={side === 'start' ? start : boundedEnd}
              onChange={(e) => change(e.target.valueAsNumber, side)}
            />
          </label>
        ))}
      </div>
      <div className="trim-preview-actions">
        <span>
          {english ? 'Selected' : '已选择'}{' '}
          {Math.max(0, boundedEnd - start).toFixed(2)}s / {duration.toFixed(2)}s
        </span>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            if (!media.current) return;
            media.current.currentTime = start;
            void media.current.play().catch(() => {});
          }}
        >
          {english ? 'Play selection' : '播放选区'}
        </button>
      </div>
    </div>
  );
}
