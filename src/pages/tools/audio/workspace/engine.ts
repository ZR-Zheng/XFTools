import { loadFFmpeg } from 'lib/ffmpeg';
import { mountMediaSources, withMediaEngine } from 'lib/media-engine';
import {
  AUDIO_FORMATS,
  type AudioFormat
} from '../../converters/audio-converter/types';
import {
  clipDuration,
  projectDuration,
  seconds,
  type Asset,
  type Clip,
  type Project
} from './project';

export interface AudioExportOptions {
  format: AudioFormat;
  sampleRate: '44100' | '48000';
  channels: '1' | '2';
  bitrate: '128k' | '192k' | '256k';
}

export interface Status {
  stage: 'queue' | 'load' | 'encode';
  progress?: number;
}

export async function probeAudio(file: File, signal: AbortSignal) {
  return withMediaEngine(signal, async (ffmpeg) => {
    await loadFFmpeg(ffmpeg);
    const [path] = await mountMediaSources(
      ffmpeg,
      [file],
      '无法挂载本地音频素材。'
    );
    await ffmpeg.ffprobe([
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=duration,codec_type:format=duration',
      '-of',
      'json',
      '-o',
      'info.json',
      path
    ]);
    const text = await ffmpeg.readFile('info.json', 'utf8');
    if (typeof text !== 'string') throw new Error('无法读取音频时长。');
    const info = JSON.parse(text);
    const stream = info.streams?.[0];
    const duration = Number(stream?.duration ?? info.format?.duration);
    if (!stream || !Number.isFinite(duration) || duration <= 0)
      throw new Error('无法读取音频时长。');
    return duration;
  });
}

function tempo(speed: number) {
  const filters: string[] = [];
  while (speed > 2) {
    filters.push('atempo=2');
    speed /= 2;
  }
  while (speed < 0.5) {
    filters.push('atempo=0.5');
    speed *= 2;
  }
  filters.push(`atempo=${seconds(speed)}`);
  return filters.join(',');
}

function renderClip(
  clip: Clip,
  index: number,
  label: string,
  options: AudioExportOptions
) {
  const length = seconds(clipDuration(clip));
  const base = [
    `atrim=start=${seconds(clip.inPoint)}:end=${seconds(clip.outPoint)}`,
    'asetpts=PTS-STARTPTS',
    ...(clip.speed === 1 ? [] : [tempo(clip.speed)]),
    `aresample=${options.sampleRate}`,
    `aformat=sample_fmts=fltp:channel_layouts=${options.channels === '1' ? 'mono' : 'stereo'}`,
    'apad',
    `atrim=duration=${length}`,
    `volume=${clip.gain}dB`
  ];
  if (clip.fadeIn)
    base.push(`afade=t=in:st=0:d=${seconds(Math.min(clip.fadeIn, length))}`);
  if (clip.fadeOut)
    base.push(
      `afade=t=out:st=${seconds(Math.max(0, length - clip.fadeOut))}:d=${seconds(Math.min(clip.fadeOut, length))}`
    );
  return `[${index}:a:0]${base.join(',')}[${label}]`;
}

export async function exportAudio(
  project: Project,
  assets: Map<string, Asset>,
  options: AudioExportOptions,
  signal: AbortSignal,
  onStatus: (status: Status) => void
) {
  return withMediaEngine(
    signal,
    async (ffmpeg) => {
      const clips = [
        ...project.clips,
        ...(project.mix ? [project.mix.clip] : [])
      ];
      const duration = seconds(projectDuration(project));
      const format = AUDIO_FORMATS[options.format];
      const bitrate = options.bitrate;
      const ceiling =
        Math.min(
          384,
          Math.max(
            96,
            ((navigator as Navigator & { deviceMemory?: number })
              .deviceMemory ?? 4) * 48
          )
        ) *
        1024 ** 2;
      if (
        duration *
          (options.format === 'wav'
            ? Number(options.sampleRate) * Number(options.channels) * 2
            : format.bitrate
              ? Number.parseInt(bitrate) * 125
              : 0) >=
        ceiling * 0.97
      )
        throw new Error('预计成片太大，请降低采样率、改用压缩格式或分段导出。');
      onStatus({ stage: 'load' });
      await loadFFmpeg(ffmpeg);
      signal.throwIfAborted();
      const ids = [...new Set(clips.map((clip) => clip.assetId))];
      const paths = await mountMediaSources(
        ffmpeg,
        ids.map((id) => assets.get(id)!.file),
        '无法挂载本地音频素材。'
      );
      const pathMap = new Map(ids.map((id, index) => [id, paths[index]]));
      const inputs = clips.flatMap((clip) => [
        '-i',
        pathMap.get(clip.assetId)!
      ]);
      const filters = clips.map((clip, index) =>
        renderClip(clip, index, `a${index}`, options)
      );
      const main = project.clips.length;
      if (main)
        filters.push(
          `${project.clips.map((_, index) => `[a${index}]`).join('')}concat=n=${main}:v=0:a=1[main]`
        );
      if (project.mix) {
        filters.push(
          `[a${main}]adelay=${Math.round(project.mix.offset * 1000)}:all=1[mix]`
        );
        filters.push(
          main
            ? '[main][mix]amix=inputs=2:duration=longest:normalize=0[sum]'
            : '[mix]anull[sum]'
        );
      } else filters.push('[main]anull[sum]');
      filters.push('[sum]alimiter=limit=0.99:level=0:latency=1[result]');
      const out = `result.${options.format}`;
      const args = [
        ...inputs,
        '-filter_complex_threads',
        '1',
        '-filter_complex',
        filters.join(';'),
        '-map',
        '[result]',
        '-vn',
        '-c:a',
        format.codec,
        '-t',
        String(duration),
        '-fs',
        String(ceiling)
      ];
      if (format.bitrate) args.push('-b:a', bitrate);
      let latest = -1;
      onStatus({ stage: 'encode', progress: 0 });
      ffmpeg.on('progress', ({ time }) => {
        const progress = Math.min(
          99,
          Math.max(0, Math.floor(time / duration / 10_000))
        );
        if (progress > latest) {
          latest = progress;
          onStatus({ stage: 'encode', progress });
        }
      });
      if (await ffmpeg.exec([...args, out]))
        throw new Error('导出失败，请检查素材编码或缩短要导出的范围。');
      await ffmpeg.ffprobe([
        '-v',
        'error',
        '-show_entries',
        'format=size',
        '-of',
        'json',
        '-o',
        'output.json',
        out
      ]);
      const sizeInfo = await ffmpeg.readFile('output.json', 'utf8');
      const size =
        typeof sizeInfo === 'string'
          ? Number(JSON.parse(sizeInfo).format?.size)
          : NaN;
      if (!Number.isFinite(size) || size <= 0)
        throw new Error('导出文件没有可播放的音频。');
      if (size >= ceiling * 0.97)
        throw new Error('成片接近浏览器的大小上限，请降低采样率或分段导出。');
      const bytes = await ffmpeg.readFile(out);
      if (typeof bytes === 'string') throw new Error('读取成片失败。');
      const name =
        assets.get(clips[0].assetId)!.file.name.replace(/\.[^.]+$/, '') ||
        'audio';
      return new File(
        [bytes as Uint8Array<ArrayBuffer>],
        `${name}-edited.${options.format}`,
        { type: format.mimeType }
      );
    },
    () => onStatus({ stage: 'queue' })
  );
}
