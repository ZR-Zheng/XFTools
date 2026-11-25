import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
import { loadFFmpeg } from 'lib/ffmpeg';
import { getFileExtension } from '@utils/file';
import { loadStill } from './media';
import type { VideoMask } from './effects';
import { appendClipEffects, colorFilter, maskPng } from './export-effects';
import {
  cropRect,
  placeClips,
  clipDuration,
  type Asset,
  type Project
} from './timeline';
import { outputSize, type ExportOptions } from './export-settings';

interface Input {
  asset: Asset;
  index: number;
  filename: string;
  hasAudio: boolean;
}

interface MaskInput {
  index: number;
  filename: string;
}

export interface ExportProgress {
  stage: 'queue' | 'load' | 'prepare' | 'encode';
  percent?: number;
}

const audioFormat =
  'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
const crf = { high: 18, balanced: 23, small: 31 };
const mimeTypes = {
  mp4: 'video/mp4',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  wav: 'audio/wav'
};
const sec = (value: number) => Number(value.toFixed(6));
const MiB = 1024 * 1024;

function outputBudget() {
  const ram = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return Math.min(512, Math.max(96, (ram ?? 4) * 64)) * MiB;
}

function longExportError(budget: number) {
  return new Error(
    `成片接近当前浏览器的 ${budget / MiB} MB 导出上限。请降低分辨率、提高压缩率或分段导出。`
  );
}

function tempo(speed: number) {
  if (speed < 0.5) return 'atempo=0.5,atempo=' + sec(speed * 2);
  if (speed > 2) return 'atempo=2,atempo=' + sec(speed / 2);
  return 'atempo=' + sec(speed);
}

function filters(
  project: Project,
  assets: Map<string, Input>,
  options: ExportOptions,
  masks: Map<VideoMask, MaskInput>
) {
  const video = options.format === 'mp4' || options.format === 'gif';
  const gif = options.format === 'gif';
  const audio = !gif;
  const fps = gif
    ? options.gifFps
    : project.canvas.template === 'jianying'
      ? (project.canvas.frameRate ?? 30)
      : 30;
  const entries = placeClips(project.clips);
  const duration = entries.at(-1)!.end;
  const first = project.clips[0];
  const { width, height } = outputSize(
    assets.get(first.assetId)!.asset,
    first,
    options,
    project.canvas
  );
  const fill = project.canvas.framing === 'cover';
  const soundtrack = project.soundtrack;
  const backed = !!(soundtrack && soundtrack.offset < duration && audio);
  const graph: string[] = [];
  const tracks: string[] = [];
  for (const [index, clip] of project.clips.entries()) {
    const input = assets.get(clip.assetId)!;
    const start = sec(clip.inPoint);
    const end = sec(clip.outPoint);
    const length = sec(clipDuration(clip));
    if (video) {
      const rect = cropRect(input.asset, clip);
      const alphaEffects = !!(clip.mask || clip.animation);
      const alpha = gif || alphaEffects;
      const timing = [
        'trim=start=' + start + ':end=' + end,
        'setpts=(PTS-STARTPTS)/' + sec(clip.speed)
      ];
      // GIF cuts can land between source timestamps. Hold the active frame before trimming.
      const transform =
        input.asset.kind === 'gif' ? ['fps=100', ...timing] : timing;
      const rounding = length < 1 / fps ? ':round=up' : '';
      // Drop frames before resizing and rotating, especially for looping still images.
      transform.push('fps=' + fps + rounding);
      if (alpha) transform.push('format=rgba');
      transform.push(
        'crop=' +
          rect.width +
          ':' +
          rect.height +
          ':' +
          rect.x +
          ':' +
          rect.y +
          ':exact=1'
      );
      if (clip.rotation === 90) transform.push('transpose=clock');
      if (clip.rotation === 270) transform.push('transpose=cclock');
      if (clip.rotation === 180) transform.push('hflip,vflip');
      if (clip.flipX) transform.push('hflip');
      if (clip.flipY) transform.push('vflip');
      transform.push(
        'scale=' +
          width +
          ':' +
          height +
          ':force_original_aspect_ratio=' +
          (fill ? 'increase' : 'decrease') +
          (gif ? '' : ':force_divisible_by=2'),
        fill
          ? `crop=${width}:${height}:(iw-ow)/2:(ih-oh)/2:exact=1`
          : `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2${alpha ? ':color=black@0' : ''}`,
        'setsar=1'
      );
      const color = colorFilter(clip);
      if (color) transform.push(color);
      transform.push(alpha ? 'format=rgba' : 'format=yuv420p');
      const track = `[v${index}]`;
      const layer = alphaEffects ? `[layer${index}]` : track;
      graph.push(`[${input.index}:v:0]${transform.join(',')}${layer}`);
      if (alphaEffects) {
        const result = appendClipEffects(
          graph,
          layer,
          clip,
          index,
          { width, height, fps, transparent: gif },
          clip.mask && masks.get(clip.mask)?.index
        );
        graph.push(`${result}format=${gif ? 'rgba' : 'yuv420p'}${track}`);
      }
      tracks.push(track);
    }
    if (audio) {
      const sound =
        input.hasAudio && clip.volume > 0 && !(backed && soundtrack?.replace)
          ? '[' +
            input.index +
            ':a:0]atrim=start=' +
            start +
            ':end=' +
            end +
            ',asetpts=PTS-STARTPTS,' +
            tempo(clip.speed) +
            ',volume=' +
            clip.volume +
            ',' +
            audioFormat +
            ',apad'
          : 'anullsrc=r=48000:cl=stereo';
      graph.push(sound + ',atrim=duration=' + length + '[a' + index + ']');
      tracks.push('[a' + index + ']');
    }
  }

  graph.push(
    tracks.join('') +
      'concat=n=' +
      entries.length +
      ':v=' +
      Number(video) +
      ':a=' +
      Number(audio) +
      (video ? '[video]' : '') +
      (audio ? (backed ? '[original]' : '[audio]') : '')
  );
  if (backed && soundtrack) {
    const input = assets.get(soundtrack.assetId)!;
    const loop = soundtrack.loop
      ? ',aloop=loop=-1:size=' +
        Math.max(1, Math.round((soundtrack.end - soundtrack.start) * 48000))
      : '';
    graph.push(
      '[' +
        input.index +
        ':a:0]atrim=start=' +
        sec(soundtrack.start) +
        ':end=' +
        sec(soundtrack.end) +
        ',asetpts=PTS-STARTPTS,' +
        audioFormat +
        loop +
        ',volume=' +
        soundtrack.volume +
        ',adelay=' +
        Math.round(soundtrack.offset * 1000) +
        ':all=1,apad,atrim=duration=' +
        sec(duration) +
        '[music]',
      '[original][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[audio]'
    );
  }
  return { graph: graph.join(';'), duration };
}

async function imageBlob(asset: Asset, signal: AbortSignal) {
  if (asset.file.type === 'image/png') return asset.file;
  const image = await loadStill(asset.url, signal);
  const canvas = document.createElement('canvas');
  canvas.width = asset.width;
  canvas.height = asset.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  image.removeAttribute('src');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve)
  );
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('无法读取图片 ' + asset.file.name + '。');
  return blob;
}

export async function exportVideo(
  project: Project,
  assets: Map<string, Asset>,
  options: ExportOptions,
  signal: AbortSignal,
  progress: (status: ExportProgress) => void
) {
  const render = () => renderVideo(project, assets, options, signal, progress);
  if (!navigator.locks) return render();
  progress({ stage: 'queue' });
  return navigator.locks.request('xftools-video-export', { signal }, render);
}

async function renderVideo(
  project: Project,
  assets: Map<string, Asset>,
  options: ExportOptions,
  signal: AbortSignal,
  progress: (status: ExportProgress) => void
) {
  signal.throwIfAborted();
  const first = project.clips[0];
  if (!first) throw new Error('请先导入视频或图片。');
  const firstAsset = assets.get(first.assetId);
  if (!firstAsset) throw new Error('素材已失效，请重新导入。');
  const { width, height } = outputSize(
    firstAsset,
    first,
    options,
    project.canvas
  );
  if (options.format === 'mp4') {
    if (width > 8192 || height > 8192 || width * height > 7680 * 4320)
      throw new Error(
        '成片尺寸超出浏览器可处理的范围。请先选择较低的输出分辨率。'
      );
  }
  const budget = outputBudget();
  const ffmpeg = new FFmpeg();
  const cancel = () => ffmpeg.terminate();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    progress({ stage: 'load' });
    await loadFFmpeg(ffmpeg);
    signal.throwIfAborted();
    progress({ stage: 'prepare' });
    const videoIds = project.clips.map((clip) => clip.assetId);
    const ids = [...new Set(videoIds)];
    if (
      project.soundtrack &&
      options.format !== 'gif' &&
      project.soundtrack.offset < placeClips(project.clips).at(-1)!.end
    ) {
      ids.push(project.soundtrack.assetId);
    }
    const inputs = new Map<string, Input>();
    const blobs = [];
    for (const [index, id] of ids.entries()) {
      signal.throwIfAborted();
      const asset = assets.get(id);
      if (!asset) throw new Error('素材已失效，请重新导入。');
      const extension =
        asset.kind === 'image'
          ? 'png'
          : getFileExtension(asset.file.name).replace(/[^a-z0-9]/g, '');
      const filename = 'source-' + index + (extension ? '.' + extension : '');
      blobs.push({
        name: filename,
        data:
          asset.kind === 'image' ? await imageBlob(asset, signal) : asset.file
      });
      inputs.set(id, {
        asset,
        index,
        filename: '/sources/' + filename,
        hasAudio: asset.kind === 'audio'
      });
    }
    const masks = new Map<VideoMask, MaskInput>();
    if (options.format === 'mp4' || options.format === 'gif') {
      for (const { mask } of project.clips) {
        if (!mask || masks.has(mask)) continue;
        signal.throwIfAborted();
        const index = inputs.size + masks.size;
        const name = `mask-${index}.png`;
        blobs.push({ name, data: await maskPng(mask, width, height) });
        masks.set(mask, { index, filename: '/sources/' + name });
      }
    }
    signal.throwIfAborted();
    await ffmpeg.createDir('/sources');
    if (!(await ffmpeg.mount(FFFSType.WORKERFS, { blobs }, '/sources')))
      throw new Error('当前导出引擎无法挂载素材，请刷新页面后重试。');

    for (const input of inputs.values()) {
      signal.throwIfAborted();
      const { asset, index, filename } = input;
      if (asset.kind === 'video' && options.format !== 'gif') {
        const probe = 'streams-' + index + '.json';
        await ffmpeg.ffprobe([
          '-v',
          'error',
          '-show_entries',
          'stream=codec_type',
          '-of',
          'json',
          '-o',
          probe,
          filename
        ]);
        const contents = await ffmpeg.readFile(probe, 'utf8');
        const streams: { codec_type?: string }[] =
          typeof contents === 'string' && contents.trim()
            ? (JSON.parse(contents).streams ?? [])
            : [];
        if (!streams.some((stream) => stream.codec_type === 'video'))
          throw new Error('无法分析素材 ' + asset.file.name + '。');
        input.hasAudio = streams.some(
          (stream) => stream.codec_type === 'audio'
        );
        await ffmpeg.deleteFile(probe);
      }
    }
    const { graph, duration } = filters(project, inputs, options, masks);
    const output = 'result.' + options.format;
    const inputArgs = [...inputs.values()].flatMap(({ asset, filename }) => {
      if (asset.kind === 'image') {
        const sourceEnd = Math.max(
          ...project.clips
            .filter((clip) => clip.assetId === asset.id)
            .map((clip) => clip.outPoint)
        );
        return [
          '-f',
          'image2',
          '-framerate',
          '100',
          '-loop',
          '1',
          '-t',
          String(sec(sourceEnd)),
          '-i',
          filename
        ];
      }
      return ['-i', filename];
    });
    for (const { filename } of masks.values()) inputArgs.push('-i', filename);
    const gif = options.format === 'gif';
    const args = [...inputArgs];
    const palette = 'palette.png';
    if (gif) args.push('-i', palette);
    const finalGraph = gif
      ? `${graph};[video][${inputs.size + masks.size}:v]paletteuse[gif]`
      : graph;
    args.push(
      '-filter_complex_threads',
      '1',
      '-filter_complex',
      finalGraph,
      '-t',
      String(sec(duration))
    );
    if (options.format === 'mp4') {
      args.push(
        '-map',
        '[video]',
        '-map',
        '[audio]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        String(crf[options.quality]),
        '-threads',
        '1',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart'
      );
    } else if (options.format === 'gif') {
      args.push('-map', '[gif]', '-loop', '0');
    } else {
      const codec = { mp3: 'libmp3lame', aac: 'aac', wav: 'pcm_s16le' };
      args.push('-map', '[audio]', '-c:a', codec[options.format]);
      if (options.format !== 'wav') args.push('-b:a', '192k');
    }
    let previous = 0;
    let palettePass = gif;
    progress({ stage: 'encode', percent: 0 });
    ffmpeg.on('progress', ({ time }) => {
      const ratio = Math.max(0, Math.min(1, time / 1000000 / duration));
      const percent = Math.min(
        98,
        Math.max(
          previous,
          Math.round(
            gif ? (palettePass ? ratio * 40 : 40 + ratio * 60) : ratio * 100
          )
        )
      );
      previous = percent;
      progress({ stage: 'encode', percent });
    });
    if (gif) {
      // Re-read the input for encoding instead of queuing every decoded frame until palettegen ends.
      const code = await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex_threads',
        '1',
        '-filter_complex',
        `${graph};[video]palettegen[palette]`,
        '-map',
        '[palette]',
        '-frames:v',
        '1',
        palette
      ]);
      if (code !== 0)
        throw new Error('无法生成 GIF 调色板，请尝试降低尺寸或缩短片段。');
      signal.throwIfAborted();
      palettePass = false;
      previous = 40;
      progress({ stage: 'encode', percent: previous });
    }
    if ((await ffmpeg.exec([...args, '-fs', String(budget), output])) !== 0) {
      throw new Error('导出失败。请尝试降低分辨率或使用较短的素材。');
    }
    // Check the limit before transferring the MEMFS result and creating its Blob.
    const info = 'export-info.json';
    await ffmpeg.ffprobe([
      '-v',
      'error',
      '-show_entries',
      'format=size',
      '-of',
      'json',
      '-o',
      info,
      output
    ]);
    const metadata = await ffmpeg.readFile(info, 'utf8');
    const size =
      typeof metadata === 'string' && metadata.trim()
        ? Number(JSON.parse(metadata).format?.size)
        : 0;
    if (size >= budget * 0.98) throw longExportError(budget);
    const bytes = await ffmpeg.readFile(output);
    if (typeof bytes === 'string' || !bytes.length)
      throw new Error('导出文件为空。');
    if (bytes.byteLength >= budget * 0.98) throw longExportError(budget);
    const base =
      assets.get(project.clips[0].assetId)!.file.name.replace(/\.[^.]+$/, '') ||
      'video';
    return new File(
      [bytes as Uint8Array<ArrayBuffer>],
      base + '-edited.' + options.format,
      { type: mimeTypes[options.format] }
    );
  } finally {
    signal.removeEventListener('abort', cancel);
    ffmpeg.terminate();
  }
}
