import { assetKind, importAsset } from './media';
import {
  createClip,
  createSoundtrack,
  editedSize,
  timeLabel,
  type Asset,
  type Clip,
  type Project,
  type Rotation
} from './timeline';
import { sourceCanvas } from './templates';

type JsonObject = Record<string, unknown>;
type DraftMaterial = {
  id: string;
  name: string;
  path: string;
  kind: 'visual' | 'audio';
};
type DraftSegment = {
  materialId: string;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  speed: number;
  volume: number;
  rotation: Rotation;
  flipX: boolean;
  flipY: boolean;
};
export interface JianyingDraft {
  name: string;
  dimensions?: { width: number; height: number };
  frameRate?: number;
  materials: DraftMaterial[];
  clips: DraftSegment[];
  soundtrack?: DraftSegment;
  notes: string[];
}

const object = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
const items = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.map(object) : [];
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export const basename = (path: string) => path.split(/[/\\]/).at(-1) ?? '';
const seconds = (value: unknown) => num(value) / 1_000_000;
const tolerance = 0.001;

export function parseJianyingDraft(
  text: string,
  fallbackName: string
): JianyingDraft {
  let data: JsonObject;
  try {
    data = object(JSON.parse(text.replace(/^\uFEFF/, '')));
  } catch {
    throw new Error(
      '无法读取这份草稿。若剪映草稿已加密，请选择同文件夹里的明文 template.json 或备份文件。'
    );
  }
  if (
    !Array.isArray(data.tracks) ||
    !data.materials ||
    typeof data.materials !== 'object'
  )
    throw new Error(
      '没有找到剪映草稿的素材和轨道。请选择 draft_content.json、template.json 或明文备份。'
    );

  const materials = object(data.materials);
  const available = new Map<string, DraftMaterial>();
  for (const [key, kind] of [
    ['videos', 'visual'],
    ['audios', 'audio']
  ] as const) {
    for (const material of items(materials[key])) {
      const id = string(material.id);
      if (!id) continue;
      const path =
        string(material.path) || string(material.local_material_path);
      const name =
        basename(path) ||
        string(material.material_name) ||
        string(material.name) ||
        id;
      available.set(id, { id, name, path, kind });
    }
  }

  const notes = new Set<string>();
  const tracks = items(data.tracks).filter(
    (track) => items(track.segments).length
  );
  const videos = tracks.filter((track) => track.type === 'video');
  const audio = tracks.filter(
    (track) => track.type === 'audio' && track.mute !== true
  );
  if (!videos[0]) throw new Error('草稿中没有可导入的视频主轨。');
  if (videos.length > 1) notes.add('只导入主视频轨。叠加轨和画中画未导入。');
  if (tracks.some((track) => track.type !== 'video' && track.type !== 'audio'))
    notes.add('文字、字幕、贴纸和其他辅助轨道未导入。');
  if (audio.flatMap((track) => items(track.segments)).length > 1)
    notes.add('配乐轨只导入第一个音频片段。');
  if (
    [
      'transitions',
      'effects',
      'video_effects',
      'audio_effects',
      'animations',
      'masks',
      'audio_fades'
    ].some((key) => items(materials[key]).length)
  )
    notes.add('转场、特效、动画、蒙版和淡入淡出未导入。');

  function segment(
    value: JsonObject,
    kind: DraftMaterial['kind'],
    muted = false
  ): DraftSegment {
    const materialId = string(value.material_id);
    if (available.get(materialId)?.kind !== kind)
      throw new Error('草稿引用了缺失的素材记录。');
    const target = object(value.target_timerange);
    const source = object(value.source_timerange);
    const start = seconds(target.start);
    const duration = seconds(target.duration);
    const inPoint = seconds(source.start);
    const length = seconds(source.duration) || duration * num(value.speed, 1);
    if (start < 0 || inPoint < 0 || duration <= 0 || length <= 0)
      throw new Error('草稿中的片段时间无效。');
    const speed = length / duration;
    if (kind === 'visual' && (speed < 0.249 || speed > 4.001))
      throw new Error('草稿有超过工作台范围的倍速片段，支持 0.25–4 倍。');
    const clip = object(value.clip);
    const flip = object(clip.flip);
    const transform = object(clip.transform);
    const scale = object(clip.scale ?? transform.scale);
    const angle = ((num(clip.rotation) % 360) + 360) % 360;
    const rotation = [0, 90, 180, 270].find(
      (candidate) => Math.abs(candidate - angle) < 0.001
    ) as Rotation | undefined;
    if (
      rotation === undefined ||
      num(clip.alpha, 1) !== 1 ||
      num(scale.x, 1) !== 1 ||
      num(scale.y, 1) !== 1 ||
      num(transform.x) !== 0 ||
      num(transform.y) !== 0 ||
      items(value.common_keyframes).length ||
      items(value.keyframe_refs).length ||
      value.reverse === true
    )
      notes.add('自定义位置、缩放、透明度、任意角度旋转、关键帧或倒放未导入。');
    if (kind === 'audio' && Math.abs(speed - 1) > tolerance)
      notes.add('配乐以原速导入，并保留草稿中的时间线起点。');
    const volume = num(value.volume, 1);
    if (volume > 1) notes.add('超过 100% 的音量按 100% 导入。');
    return {
      materialId,
      start,
      duration,
      inPoint,
      outPoint: inPoint + length,
      speed: Math.min(4, Math.max(0.25, speed)),
      volume: muted ? 0 : Math.min(1, Math.max(0, volume)),
      rotation: rotation ?? 0,
      flipX: flip.horizontal === true,
      flipY: flip.vertical === true
    };
  }

  const clips = items(videos[0].segments)
    .map((entry) =>
      segment(
        entry,
        'visual',
        videos[0].mute === true || object(data.config).video_mute === true
      )
    )
    .sort((a, b) => a.start - b.start);
  let end = 0;
  for (const clip of clips) {
    if (end - clip.start > tolerance)
      throw new Error('主轨有重叠片段，当前时间线无法按原序导入。');
    if (clip.start - end > tolerance) notes.add('主轨间隙保留为空白片段。');
    end = clip.start + clip.duration;
  }
  const firstAudio = items(audio[0]?.segments).sort(
    (a, b) =>
      seconds(object(a.target_timerange).start) -
      seconds(object(b.target_timerange).start)
  )[0];
  const soundtrack = firstAudio ? segment(firstAudio, 'audio') : undefined;
  const referenced = new Set(
    [...clips, ...(soundtrack ? [soundtrack] : [])].map(
      (entry) => entry.materialId
    )
  );
  const canvas = object(data.canvas_config);
  const width = num(canvas.width);
  const height = num(canvas.height);
  const fps = num(data.fps, num(canvas.fps));
  const frameRate = fps >= 1 && fps <= 60 ? fps : undefined;
  if (fps && !frameRate)
    notes.add('超出 1–60 帧/秒范围的草稿按 30 帧/秒导出。');
  const dimensions =
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0
      ? { width, height }
      : undefined;
  return {
    name: string(data.name) || fallbackName,
    dimensions,
    frameRate,
    clips,
    soundtrack,
    materials: [...referenced].map((id) => available.get(id)!),
    notes: [...notes]
  };
}

export function acceptsDraftAsset(material: DraftMaterial, file: File) {
  const kind = assetKind(file);
  return (
    kind !== undefined &&
    (material.kind === 'audio' ? kind === 'audio' : kind !== 'audio')
  );
}

export function matchDraftAssets(draft: JianyingDraft, files: readonly File[]) {
  const byName = new Map<string, File[]>();
  for (const file of files) {
    const key = file.name.toLowerCase();
    const matches = byName.get(key) ?? [];
    matches.push(file);
    byName.set(key, matches);
  }
  const matches = new Map<string, File>();
  for (const material of draft.materials) {
    const candidates = byName
      .get(material.name.toLowerCase())
      ?.filter((file) => acceptsDraftAsset(material, file));
    if (candidates?.length === 1) matches.set(material.id, candidates[0]);
  }
  return matches;
}

async function createBlank(duration: number, signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2;
  const context = canvas.getContext('2d')!;
  context.fillRect(0, 0, 2, 2);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve)
  );
  if (!blob) throw new Error('无法生成草稿间隙的空白画面。');
  const asset = await importAsset(
    new File([blob], '空白画面.png', { type: blob.type }),
    'image',
    signal
  );
  return { ...asset, duration: Math.max(asset.duration, duration) };
}

export async function buildJianyingProject(
  draft: JianyingDraft,
  files: ReadonlyMap<string, File>,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void
) {
  const staged = new Map<File, Asset>();
  const assetsById = new Map<string, Asset>();
  let blank: Asset | undefined;
  try {
    for (const material of draft.materials) {
      signal.throwIfAborted();
      const file = files.get(material.id);
      if (!file || !acceptsDraftAsset(material, file))
        throw new Error('请关联素材 ' + material.name + '。');
      let asset = staged.get(file);
      if (!asset) {
        asset = await importAsset(file, assetKind(file)!, signal);
        staged.set(file, asset);
      }
      assetsById.set(material.id, asset);
      onProgress(assetsById.size, draft.materials.length);
    }

    const clips: Clip[] = [];
    let position = 0;
    for (const entry of draft.clips) {
      const asset = assetsById.get(entry.materialId)!;
      const gap = entry.start - position;
      if (gap > tolerance) {
        blank ??= await createBlank(gap, signal);
        blank.duration = Math.max(blank.duration, gap);
        clips.push(createClip(blank, gap));
      }
      if (asset.kind === 'image')
        asset.duration = Math.max(asset.duration, entry.outPoint);
      if (
        asset.duration + 0.05 < entry.outPoint ||
        asset.duration <= entry.inPoint
      )
        throw new Error(
          `${asset.file.name} 太短。草稿需要 ${timeLabel(entry.outPoint, true)} 处的画面。`
        );
      const outPoint = Math.min(asset.duration, entry.outPoint);
      const speed = (outPoint - entry.inPoint) / entry.duration;
      clips.push({
        ...createClip(asset),
        inPoint: entry.inPoint,
        outPoint,
        speed: Math.min(4, Math.max(0.25, speed)),
        volume: entry.volume,
        rotation: entry.rotation,
        flipX: entry.flipX,
        flipY: entry.flipY
      });
      position = entry.start + entry.duration;
    }
    let soundtrack = null;
    if (draft.soundtrack) {
      const entry = draft.soundtrack;
      const asset = assetsById.get(entry.materialId)!;
      if (
        asset.duration + 0.05 < entry.outPoint ||
        asset.duration <= entry.inPoint
      )
        throw new Error(`${asset.file.name} 太短，无法套用配乐区间。`);
      soundtrack = {
        ...createSoundtrack(asset),
        start: entry.inPoint,
        end: Math.min(
          asset.duration,
          entry.outPoint,
          entry.inPoint + entry.duration
        ),
        offset: entry.start,
        volume: entry.volume
      };
    }
    signal.throwIfAborted();
    const firstMaterial = assetsById.get(draft.clips[0].materialId)!;
    const firstVisual =
      blank && clips[0].assetId === blank.id ? clips[1] : undefined;
    const dimensions =
      draft.dimensions ??
      (firstVisual ? editedSize(firstMaterial, firstVisual) : undefined);
    const project: Project = {
      clips,
      soundtrack,
      canvas:
        dimensions || draft.frameRate
          ? {
              template: 'jianying',
              framing: 'contain',
              dimensions,
              frameRate: draft.frameRate
            }
          : sourceCanvas
    };
    return { project, assets: [...staged.values(), ...(blank ? [blank] : [])] };
  } catch (error) {
    for (const asset of staged.values()) URL.revokeObjectURL(asset.url);
    if (blank) URL.revokeObjectURL(blank.url);
    throw error;
  }
}
