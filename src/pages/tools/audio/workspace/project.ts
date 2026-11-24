export interface Asset {
  id: string;
  file: File;
  url: string;
  duration: number;
  playable: boolean;
  peaks?: Float32Array;
}

export interface Clip {
  id: string;
  assetId: string;
  inPoint: number;
  outPoint: number;
  speed: number;
  gain: number;
  fadeIn: number;
  fadeOut: number;
}

export interface Project {
  clips: Clip[];
  mix: { clip: Clip; offset: number } | null;
}

export type Range = { start: number; end: number };
export type Entry = Range & { clip: Clip };
export const minClip = 0.02;
export const emptyProject: Project = { clips: [], mix: null };
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const seconds = (n: number) => Number(n.toFixed(6));

export function newClip(asset: Asset): Clip {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    inPoint: 0,
    outPoint: asset.duration,
    speed: 1,
    gain: 0,
    fadeIn: 0,
    fadeOut: 0
  };
}

export function clipDuration(clip: Clip) {
  return (clip.outPoint - clip.inPoint) / clip.speed;
}

export function placeAudio(clips: readonly Clip[]): Entry[] {
  let end = 0;
  return clips.map((clip) => {
    const start = end;
    end += clipDuration(clip);
    return { clip, start, end };
  });
}

export function projectDuration(project: Project) {
  const main = project.clips.reduce((end, clip) => end + clipDuration(clip), 0);
  return Math.max(
    main,
    project.mix ? project.mix.offset + clipDuration(project.mix.clip) : 0
  );
}

export function timeText(value: number, precise = true) {
  const ms = Math.max(0, Math.round(value * 1000));
  const whole = Math.floor(ms / 1000);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}${precise ? '.' + String(ms % 1000).padStart(3, '0') : ''}`;
}

export function sliceAudio(
  entry: Entry,
  start: number,
  end: number,
  id = entry.clip.id
): Clip | undefined {
  const { clip } = entry;
  const from = Math.max(start, entry.start);
  const to = Math.min(end, entry.end);
  if (to - from < minClip - 1e-7) return;
  return {
    ...clip,
    id,
    inPoint: clamp(
      clip.inPoint + (from - entry.start) * clip.speed,
      clip.inPoint,
      clip.outPoint
    ),
    outPoint: clamp(
      clip.inPoint + (to - entry.start) * clip.speed,
      clip.inPoint,
      clip.outPoint
    ),
    fadeIn: from <= entry.start ? Math.min(clip.fadeIn, to - from) : 0,
    fadeOut: to >= entry.end ? Math.min(clip.fadeOut, to - from) : 0
  };
}

export function editRange(
  clips: readonly Clip[],
  range: Range,
  keep: boolean
): Clip[] {
  return placeAudio(clips).flatMap((entry) => {
    if (entry.end <= range.start || entry.start >= range.end)
      return keep ? [] : [entry.clip];
    if (keep) return sliceAudio(entry, range.start, range.end) ?? [];
    const left = sliceAudio(entry, entry.start, range.start);
    const right = sliceAudio(
      entry,
      range.end,
      entry.end,
      left ? crypto.randomUUID() : entry.clip.id
    );
    return [left, right].filter((part): part is Clip => !!part);
  });
}

export function clipGain(clip: Clip, elapsed: number) {
  const remaining = clipDuration(clip) - elapsed;
  return (
    10 ** (clip.gain / 20) *
    (clip.fadeIn ? clamp(elapsed / clip.fadeIn, 0, 1) : 1) *
    (clip.fadeOut ? clamp(remaining / clip.fadeOut, 0, 1) : 1)
  );
}

export type History = { past: Project[]; present: Project; future: Project[] };
export const emptyHistory: History = {
  past: [],
  present: emptyProject,
  future: []
};
export function stepHistory(
  history: History,
  action: Project | 'undo' | 'redo'
): History {
  if (action === 'undo') {
    const prior = history.past.at(-1);
    return prior
      ? {
          past: history.past.slice(0, -1),
          present: prior,
          future: [history.present, ...history.future]
        }
      : history;
  }
  if (action === 'redo') {
    const [next, ...future] = history.future;
    return next
      ? { past: [...history.past, history.present], present: next, future }
      : history;
  }
  return action === history.present
    ? history
    : {
        past: [...history.past.slice(-39), history.present],
        present: action,
        future: []
      };
}
