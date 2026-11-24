import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import Glyph from '@components/workbench/Glyph';
import {
  clamp,
  placeClips,
  timeLabel,
  trimEdge,
  type Asset,
  type Clip,
  type PositionedClip,
  type Soundtrack
} from './timeline';

interface Props {
  entries: PositionedClip[];
  assets: Map<string, Asset>;
  selected?: string;
  soundtrack: Soundtrack | null;
  time: number;
  onSeek: (time: number) => void;
  onSelect: (entry: PositionedClip) => void;
  onTrim: (clip: Clip) => void;
  onMove: (id: string, target: string) => void;
  onSoundtrack: () => void;
  onImport: () => void;
}

type Edge = 'inPoint' | 'outPoint';
export default function VideoTimeline({
  entries,
  assets,
  selected,
  soundtrack,
  time,
  onSeek,
  onSelect,
  onTrim,
  onMove,
  onSoundtrack,
  onImport
}: Props) {
  const [zoom, setZoom] = useState(78);
  const [draft, setDraft] = useState<Clip | null>(null);
  const pending = useRef<Clip>(null);
  const frame = useRef(0);
  const trimming = useRef<{
    edge: Edge;
    clip: Clip;
    x: number;
    duration: number;
  } | null>(null);
  const dragged = useRef<string | null>(null);
  const placed = useMemo(
    () =>
      draft
        ? placeClips(
            entries.map(({ clip }) => (clip.id === draft.id ? draft : clip))
          )
        : entries,
    [entries, draft]
  );
  const total = entries.at(-1)?.end ?? 0;
  const displayed = placed.at(-1)?.end ?? 0;
  const canvasWidth = Math.max(520, Math.ceil(displayed * zoom) + 20);
  const tickStep = Math.max(
    zoom > 95 ? 0.5 : zoom > 45 ? 1 : 2,
    Math.ceil(canvasWidth / zoom / 140) / 2
  );
  const ticks = useMemo(
    () =>
      Array.from(
        { length: Math.floor(canvasWidth / zoom / tickStep) + 1 },
        (_, index) => index * tickStep
      ),
    [canvasWidth, zoom, tickStep]
  );
  const audio = soundtrack ? assets.get(soundtrack.assetId) : undefined;
  const audioDuration = soundtrack
    ? Math.max(
        0,
        soundtrack.loop
          ? displayed - soundtrack.offset
          : Math.min(
              soundtrack.end - soundtrack.start,
              displayed - soundtrack.offset
            )
      )
    : 0;

  function startTrim(
    event: PointerEvent<HTMLButtonElement>,
    clip: Clip,
    edge: Edge
  ) {
    if (event.button !== 0) return;
    const source = assets.get(clip.assetId);
    if (!source) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    trimming.current = {
      edge,
      clip,
      duration: source.duration,
      x: event.clientX
    };
  }

  function adjustTrim(event: PointerEvent<HTMLButtonElement>, commit = false) {
    const gesture = trimming.current;
    if (!gesture) return;
    const { clip, edge, duration, x } = gesture;
    const changed = trimEdge(
      clip,
      duration,
      edge,
      clip[edge] + ((event.clientX - x) * clip.speed) / zoom
    );
    if (commit) {
      cancelTrimFrame();
      trimming.current = null;
      setDraft(null);
      if (changed[edge] !== clip[edge]) onTrim(changed);
    } else {
      pending.current = changed;
      if (!frame.current)
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          setDraft(pending.current);
        });
    }
  }

  function cancelTrimFrame() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    pending.current = null;
  }

  useEffect(() => cancelTrimFrame, []);

  return (
    <section className="vw-timeline" aria-label="编辑时间线">
      <div className="vw-timeline-header">
        <h2>
          时间线 <span>{entries.length} 个片段</span>
        </h2>
        <label className="vw-zoom">
          <Glyph name="search" size={16} /> <span>缩放</span>
          <input
            aria-label="时间线缩放"
            type="range"
            min={25}
            max={180}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="vw-tracks">
        <div className="vw-track-labels" aria-hidden="true">
          <span />
          <span>
            <Glyph name="video" size={17} /> 视频
          </span>
          <span>
            <Glyph name="audio" size={16} /> 配乐
          </span>
        </div>
        <div className="vw-track-scroll">
          <div className="vw-track-content" style={{ width: canvasWidth }}>
            <button
              className="vw-ruler"
              type="button"
              aria-label="定位时间线播放头"
              disabled={!entries.length}
              onClick={(event) => {
                const left = event.currentTarget.getBoundingClientRect().left;
                if (event.detail)
                  onSeek(clamp((event.clientX - left) / zoom, 0, total));
                else onSeek(0);
              }}
            >
              {ticks.map((tick) => (
                <span key={tick} style={{ left: tick * zoom }}>
                  {timeLabel(tick, tickStep < 1)}
                </span>
              ))}
            </button>
            <div className="vw-video-track">
              {!entries.length && (
                <button
                  className="vw-track-empty"
                  type="button"
                  onClick={onImport}
                >
                  <Glyph name="add" size={15} /> 添加视频或图片
                </button>
              )}
              {placed.map((entry) => {
                const { clip } = entry;
                const asset = assets.get(clip.assetId);
                const width = Math.max(1, (entry.end - entry.start) * zoom);
                return (
                  <div
                    className="vw-clip"
                    data-selected={selected === clip.id}
                    key={clip.id}
                    style={{ left: entry.start * zoom, width }}
                    onDragOver={(event) => {
                      if (dragged.current) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!dragged.current) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onMove(dragged.current, clip.id);
                      dragged.current = null;
                    }}
                  >
                    <button
                      className="vw-clip-body"
                      type="button"
                      draggable
                      aria-label={
                        '选中片段 ' +
                        (asset?.file.name ?? '') +
                        ' ' +
                        timeLabel(entry.start, true)
                      }
                      aria-pressed={selected === clip.id}
                      onClick={() => onSelect(entry)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', clip.id);
                        event.dataTransfer.effectAllowed = 'move';
                        dragged.current = clip.id;
                      }}
                      onDragEnd={() => {
                        dragged.current = null;
                      }}
                    >
                      {asset?.thumbnail && (
                        <span
                          aria-hidden="true"
                          className="vw-filmstrip"
                          style={{
                            backgroundImage: 'url(' + asset.thumbnail + ')'
                          }}
                        />
                      )}
                      <strong>{asset?.file.name}</strong>
                      <small>{timeLabel(entry.end - entry.start, true)}</small>
                    </button>
                    {(width >= 28 || trimming.current?.clip.id === clip.id) &&
                      (['inPoint', 'outPoint'] as const).map((edge) => (
                        <button
                          key={edge}
                          className={'vw-trim-handle vw-trim-' + edge}
                          type="button"
                          aria-label={
                            edge === 'inPoint'
                              ? '拖动调整片段入点'
                              : '拖动调整片段出点'
                          }
                          tabIndex={-1}
                          onPointerDown={(event) =>
                            startTrim(event, clip, edge)
                          }
                          onPointerMove={(event) => adjustTrim(event)}
                          onPointerUp={(event) => adjustTrim(event, true)}
                          onPointerCancel={() => {
                            cancelTrimFrame();
                            trimming.current = null;
                            setDraft(null);
                          }}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
            <div className="vw-audio-track">
              {audio && soundtrack && audioDuration > 0 ? (
                <button
                  type="button"
                  className="vw-audio-clip"
                  onClick={onSoundtrack}
                  style={{
                    left: soundtrack.offset * zoom,
                    width: Math.max(1, audioDuration * zoom)
                  }}
                  title={audio.file.name}
                >
                  <Glyph name="audio" size={15} />{' '}
                  <span>{audio.file.name}</span>
                </button>
              ) : (
                <button
                  className="vw-track-empty"
                  type="button"
                  onClick={onSoundtrack}
                >
                  <Glyph name="add" size={15} /> 添加配乐
                </button>
              )}
            </div>
            {entries.length > 0 && (
              <div
                className="vw-playhead"
                aria-hidden="true"
                style={{ left: Math.min(time, displayed) * zoom }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
