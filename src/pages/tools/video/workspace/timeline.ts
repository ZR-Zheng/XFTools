import { sourceCanvas, type CanvasSettings } from './templates';
import type { VideoAnimation, VideoFilter, VideoMask } from './effects';

export type Rotation = 0 | 90 | 180 | 270;
export type CropEdge = 'left' | 'top' | 'right' | 'bottom';

export interface Asset {
  id: string;
  kind: 'video' | 'audio' | 'image' | 'gif';
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
  thumbnail?: string;
}

export interface Clip {
  id: string;
  assetId: string;
  inPoint: number;
  outPoint: number;
  speed: number;
  rotation: Rotation;
  flipX: boolean;
  flipY: boolean;
  crop: Record<CropEdge, number>;
  volume: number;
  mask?: VideoMask;
  animation?: VideoAnimation;
  filter?: VideoFilter;
}

export interface Soundtrack {
  assetId: string;
  offset: number;
  start: number;
  end: number;
  volume: number;
  loop: boolean;
  replace: boolean;
}

export interface Project {
  clips: Clip[];
  soundtrack: Soundtrack | null;
  canvas: CanvasSettings;
}

export interface PositionedClip {
  clip: Clip;
  start: number;
  end: number;
}

export const MIN_CLIP_TIME = 0.05;
export const EMPTY_CROP = { left: 0, top: 0, right: 0, bottom: 0 };

export function createClip(asset: Asset, imageDuration = 0.2): Clip {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    inPoint: 0,
    outPoint: asset.kind === 'image' ? imageDuration : asset.duration,
    speed: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    crop: EMPTY_CROP,
    volume: 1
  };
}

export function createSoundtrack(asset: Asset): Soundtrack {
  return {
    assetId: asset.id,
    offset: 0,
    start: 0,
    end: asset.duration,
    volume: 0.35,
    loop: false,
    replace: false
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function timeLabel(seconds: number, precise = false) {
  const ticks = Math.max(0, Math.round(seconds * 100));
  const minutes = Math.floor(ticks / 6000)
    .toString()
    .padStart(2, '0');
  const whole = Math.floor((ticks / 100) % 60)
    .toString()
    .padStart(2, '0');
  return (
    minutes +
    ':' +
    whole +
    (precise ? '.' + String(ticks % 100).padStart(2, '0') : '')
  );
}

export function clipDuration(clip: Clip) {
  return (clip.outPoint - clip.inPoint) / clip.speed;
}

export function placeClips(clips: readonly Clip[]): PositionedClip[] {
  let time = 0;
  return clips.map((clip) => {
    const start = time;
    time += clipDuration(clip);
    return { clip, start, end: time };
  });
}

export function clipAt(entries: readonly PositionedClip[], time: number) {
  let start = 0;
  let end = entries.length - 1;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (entries[middle].end <= time) start = middle + 1;
    else end = middle;
  }
  return entries[start];
}

export function sourceTime(entry: PositionedClip, time: number) {
  return clamp(
    entry.clip.inPoint + (time - entry.start) * entry.clip.speed,
    entry.clip.inPoint,
    entry.clip.outPoint
  );
}

export function splitClip(entry: PositionedClip, time: number, id: string) {
  const point = sourceTime(entry, time);
  const { clip } = entry;
  if (
    point - clip.inPoint < MIN_CLIP_TIME ||
    clip.outPoint - point < MIN_CLIP_TIME
  )
    return null;
  return [
    { ...clip, outPoint: point },
    { ...clip, id, inPoint: point }
  ] as const;
}

export function trimEdge(
  clip: Clip,
  duration: number,
  edge: 'inPoint' | 'outPoint',
  value: number
): Clip {
  const minimum = Math.min(MIN_CLIP_TIME, duration);
  return {
    ...clip,
    [edge]:
      edge === 'inPoint'
        ? clamp(value, 0, clip.outPoint - minimum)
        : clamp(value, clip.inPoint + minimum, duration)
  };
}

export function setCropEdge(clip: Clip, edge: CropEdge, value: number) {
  const opposite = {
    left: 'right',
    right: 'left',
    top: 'bottom',
    bottom: 'top'
  } as const;
  return {
    ...clip.crop,
    [edge]: clamp(value, 0, 95 - clip.crop[opposite[edge]])
  };
}

export function cropRect(asset: Pick<Asset, 'width' | 'height'>, clip: Clip) {
  const { left, right, top, bottom } = clip.crop;
  const x = Math.min(asset.width - 1, Math.floor((asset.width * left) / 100));
  const y = Math.min(asset.height - 1, Math.floor((asset.height * top) / 100));
  return {
    x,
    y,
    width: Math.max(1, Math.round(asset.width * (1 - right / 100)) - x),
    height: Math.max(1, Math.round(asset.height * (1 - bottom / 100)) - y)
  };
}

export function editedSize(asset: Asset, clip: Clip) {
  const { width, height } = cropRect(asset, clip);
  return clip.rotation % 180
    ? { width: height, height: width }
    : { width, height };
}

export interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

export const EMPTY_HISTORY: History = {
  past: [],
  present: { clips: [], soundtrack: null, canvas: sourceCanvas },
  future: []
};

type Update =
  | { type: 'change'; apply: (project: Project) => Project }
  | { type: 'undo' | 'redo' };

export function historyReducer(history: History, update: Update): History {
  if (update.type === 'undo') {
    const present = history.past.at(-1);
    return present
      ? {
          past: history.past.slice(0, -1),
          present,
          future: [history.present, ...history.future]
        }
      : history;
  }
  if (update.type === 'redo') {
    const [present, ...future] = history.future;
    return present
      ? { past: [...history.past, history.present], present, future }
      : history;
  }
  if (update.type === 'change') {
    const present = update.apply(history.present);
    return present === history.present
      ? history
      : {
          past: [...history.past.slice(-39), history.present],
          present,
          future: []
        };
  }
  return history;
}
