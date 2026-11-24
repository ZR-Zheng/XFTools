import { memo, useEffect, useRef, useState, type PointerEvent } from 'react';
import Glyph from '@components/workbench/Glyph';
import { clamp, timeText, type Asset, type Entry, type Range } from './project';

export type Lane = 'main' | 'mix';

const Wave = memo(function Wave({
  asset,
  entry
}: {
  asset: Asset;
  entry: Entry;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { inPoint, outPoint } = entry.clip;
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const { width, height } = context.canvas;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = '#2e67c6';
    const peaks = asset.peaks;
    if (!peaks) {
      context.globalAlpha = 0.45;
      context.fillStyle = '#2e67c6';
      context.fillRect(0, height / 2, width, 1);
      context.globalAlpha = 1;
      return;
    }
    context.beginPath();
    const count = peaks.length / 2;
    const first = (inPoint / asset.duration) * count;
    const length = ((outPoint - inPoint) / asset.duration) * count;
    for (let x = 0; x < width; x++) {
      const from = Math.min(
        count - 1,
        Math.floor(first + (length * x) / width)
      );
      const to = Math.min(
        count,
        Math.max(from + 1, Math.ceil(first + (length * (x + 1)) / width))
      );
      let min = 0,
        max = 0;
      for (let index = from; index < to; index++) {
        min = Math.min(min, peaks[index * 2]);
        max = Math.max(max, peaks[index * 2 + 1]);
      }
      context.moveTo(x + 0.5, height * (0.5 - max * 0.48));
      context.lineTo(x + 0.5, height * (0.5 - min * 0.48) + 1);
    }
    context.stroke();
  }, [asset, inPoint, outPoint]);
  return (
    <canvas
      ref={canvas}
      width={640}
      height={56}
      className={'audio-waveform' + (asset.peaks ? ' ready' : '')}
      aria-label={
        asset.peaks
          ? `${asset.file.name} 的音频波形`
          : `${asset.file.name}，波形未生成`
      }
    />
  );
});

interface Props {
  entries: Entry[];
  mix?: Entry;
  assets: Map<string, Asset>;
  duration: number;
  position: number;
  range: Range | null;
  lane: Lane;
  selected?: string;
  onSelect: (lane: Lane, position: number, range: Range | null) => void;
  onClip: (entry: Entry, lane: Lane) => void;
  onMove: (id: string, target: string) => void;
  onImport: () => void;
  onMix: () => void;
}

export default function WaveTimeline({
  entries,
  mix,
  assets,
  duration,
  position,
  range,
  lane,
  selected,
  onSelect,
  onClip,
  onMove,
  onImport,
  onMix
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<(Range & { lane: Lane }) | null>(null);
  const gesture = useRef<{ time: number; x: number; lane: Lane }>(null);
  const dragged = useRef('');
  const scale = duration || 12;
  const percent = (value: number) => `${clamp(value / scale, 0, 1) * 100}%`;
  const marker = draft ?? (range && { ...range, lane });
  const timeAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration;
  };

  function drawLane(kind: Lane, items: Entry[]) {
    return (
      <div
        className={`aw-lane aw-lane-${kind}`}
        aria-label={kind === 'main' ? '剪辑轨波形' : '混音轨波形'}
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            !items.length ||
            (event.target as HTMLElement).closest('button')
          )
            return;
          gesture.current = {
            x: event.clientX,
            time: timeAt(event),
            lane: kind
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (
            !start ||
            start.lane !== kind ||
            Math.abs(event.clientX - start.x) < 4
          )
            return;
          const to = timeAt(event);
          setDraft({
            start: Math.min(start.time, to),
            end: Math.max(start.time, to),
            lane: kind
          });
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          if (!start || start.lane !== kind) return;
          gesture.current = null;
          setDraft(null);
          const to = timeAt(event);
          const range =
            Math.abs(event.clientX - start.x) < 4
              ? null
              : {
                  start: Math.min(start.time, to),
                  end: Math.max(start.time, to)
                };
          onSelect(kind, range?.start ?? to, range);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDraft(null);
        }}
      >
        {items.map((entry) => {
          const asset = assets.get(entry.clip.assetId)!;
          return (
            <div
              className="aw-region"
              key={entry.clip.id}
              data-selected={entry.clip.id === selected}
              style={{
                left: percent(entry.start),
                width: percent(entry.end - entry.start)
              }}
              onDragOver={(event) => {
                if (kind === 'main' && dragged.current) event.preventDefault();
              }}
              onDrop={(event) => {
                if (!dragged.current || kind !== 'main') return;
                event.preventDefault();
                event.stopPropagation();
                onMove(dragged.current, entry.clip.id);
                dragged.current = '';
              }}
            >
              <button
                type="button"
                className="aw-region-title"
                draggable={kind === 'main'}
                aria-label={`选中 ${asset.file.name} ${timeText(entry.start)}`}
                aria-pressed={entry.clip.id === selected}
                title={asset.file.name}
                onClick={() => onClip(entry, kind)}
                onDragStart={(event) => {
                  dragged.current = entry.clip.id;
                  event.dataTransfer.setData('text/plain', entry.clip.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  dragged.current = '';
                }}
              >
                <span>{asset.file.name}</span>
                <small>{timeText(entry.end - entry.start)}</small>
              </button>
              <Wave asset={asset} entry={entry} />
            </div>
          );
        })}
        {!items.length && (
          <button
            type="button"
            className="aw-track-add"
            onClick={kind === 'main' ? onImport : onMix}
          >
            <Glyph name="add" size={16} />{' '}
            {kind === 'main' ? '添加音频' : '添加混音素材'}
          </button>
        )}
        {marker?.lane === kind && (
          <div
            className="aw-range"
            style={{
              left: percent(marker.start),
              width: percent(marker.end - marker.start)
            }}
          />
        )}
      </div>
    );
  }

  return (
    <section className="aw-timeline" aria-label="波形时间线">
      <div className="aw-timeline-head">
        <h2>时间线</h2>
        <label className="aw-zoom">
          缩放
          <select
            className="ui-input"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value="1">适合窗口</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
            <option value="8">8×</option>
          </select>
        </label>
      </div>
      <div className="aw-tracks">
        <aside className="aw-lane-labels" aria-hidden="true">
          <span />
          <span className="aw-main-label">
            <Glyph name="audio" size={15} />
            剪辑轨
          </span>
          <span className="aw-mix-label">
            <Glyph name="audio" size={15} />
            混音轨
          </span>
        </aside>
        <div className="aw-track-scroll">
          <div className="aw-track-content" style={{ width: `${zoom * 100}%` }}>
            <div className="aw-ruler" aria-hidden="true">
              {Array.from({ length: 5 * zoom + 1 }, (_, index) => (
                <span
                  key={index}
                  style={{ left: `${(index / (5 * zoom)) * 100}%` }}
                >
                  {timeText((scale * index) / (5 * zoom), scale < 10)}
                </span>
              ))}
            </div>
            {drawLane('main', entries)}
            {drawLane('mix', mix ? [mix] : [])}
            {duration > 0 && (
              <div
                className="aw-playhead"
                aria-hidden="true"
                style={{ left: percent(position) }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
