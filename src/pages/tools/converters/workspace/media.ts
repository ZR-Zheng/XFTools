import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { loadFFmpeg } from 'lib/ffmpeg';
import { mountMediaSources, withMediaEngine } from 'lib/media-engine';
import {
  audioFormats,
  isAudioFormat,
  outputName,
  presets,
  resultLimit,
  type Settings
} from './formats';

type Stream = {
  codec_type: string;
  width?: number;
  height?: number;
  disposition?: { attached_pic?: number };
};
type Probe = {
  streams?: Stream[];
  format?: { duration?: string; size?: string };
};

async function probe(ffmpeg: FFmpeg, path: string): Promise<Probe | null> {
  const report = 'probe.json';
  await ffmpeg.ffprobe([
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,width,height:stream_disposition=attached_pic:format=duration,size',
    '-of',
    'json',
    '-o',
    report,
    path
  ]);
  // The bundled ffprobe can return -1 even after writing valid JSON.
  const json = await ffmpeg.readFile(report, 'utf8').catch(() => null);
  if (typeof json !== 'string') return null;
  await ffmpeg.deleteFile(report);
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const videoTypes = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  gif: 'image/gif'
};

function fitVideo(side: number) {
  return `scale=w='min(iw,${side})':h='min(ih,${side})':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1`;
}

export async function convertMedia(
  file: File,
  settings: Settings,
  signal: AbortSignal,
  onProgress: (progress: number, waiting?: boolean) => void
) {
  return withMediaEngine(
    signal,
    async (ffmpeg) => {
      onProgress(0);
      await loadFFmpeg(ffmpeg);
      const [source] = await mountMediaSources(
        ffmpeg,
        [file],
        '无法打开本地媒体文件。'
      );
      const info = await probe(ffmpeg, source);
      if (!info?.streams?.length)
        throw new Error('无法读取媒体文件。请确认文件完好且编码受支持。');
      const { format, preset } = settings;
      const options = presets[preset];
      const audio = isAudioFormat(format);
      const stream = info.streams.find((stream) =>
        audio
          ? stream.codec_type === 'audio'
          : stream.codec_type === 'video' && !stream.disposition?.attached_pic
      );
      if (!stream)
        throw new Error(
          audio ? '此文件没有音轨。' : '此文件没有可转换的视频画面。'
        );
      if (
        !audio &&
        ((stream.width ?? 0) * (stream.height ?? 0) > 9_000_000 ||
          Math.max(stream.width ?? 0, stream.height ?? 0) > 4096)
      )
        throw new Error('视频画面超过浏览器转换上限，请先缩小至 4K 或以下。');

      const duration = Number(info.format?.duration);
      if (format === 'gif' && (!Number.isFinite(duration) || duration > 90))
        throw new Error(
          'GIF 转换支持时长可读取且不超过 90 秒的素材。可以先在视频编辑器裁剪。'
        );

      const target = `converted.${format}`;
      const input = ['-hide_banner', '-loglevel', 'error', '-i', source];
      const mapping = audio
        ? ['-map', '0:a:0', '-vn']
        : ['-map', '0:V:0', '-map', '0:a:0?'];
      const common = [
        '-map_metadata',
        '-1',
        '-fs',
        String(resultLimit),
        target
      ];
      let mimeType: string;
      let progressStart = 6;
      let progressSpan = 91;
      const progress = ({ time }: { time: number }) => {
        if (duration > 0)
          onProgress(
            progressStart +
              Math.min(1, Math.max(0, time / 1e6 / duration)) * progressSpan
          );
      };
      ffmpeg.on('progress', progress);
      let code: number;
      if (audio) {
        const spec = audioFormats[format];
        mimeType = spec.mimeType;
        code = await ffmpeg.exec([
          ...input,
          ...mapping,
          '-c:a',
          spec.codec,
          ...(spec.bitrate ? ['-b:a', options.bitrate] : []),
          ...(format === 'opus' ? ['-ar', '48000'] : []),
          ...common
        ]);
      } else if (format === 'gif') {
        mimeType = videoTypes.gif;
        const filter = `fps=${options.gifFps},${fitVideo(options.gifSide)}`;
        progressSpan = 33;
        const palette = await ffmpeg.exec([
          ...input,
          '-map',
          '0:V:0',
          '-vf',
          `${filter},palettegen=stats_mode=diff`,
          '-frames:v',
          '1',
          '-update',
          '1',
          'palette.png'
        ]);
        if (palette) throw new Error('无法生成 GIF 调色板，请检查视频编码。');
        progressStart = 40;
        progressSpan = 57;
        onProgress(progressStart);
        code = await ffmpeg.exec([
          ...input,
          '-i',
          'palette.png',
          '-filter_complex',
          `[0:V:0]${filter}[frames];[frames][1:v]paletteuse=dither=bayer`,
          '-an',
          '-loop',
          '0',
          ...common
        ]);
      } else {
        if (
          format !== 'mp4' &&
          format !== 'webm' &&
          format !== 'mov' &&
          format !== 'mkv'
        )
          throw new Error('所选格式无法接收视频文件。');
        mimeType = videoTypes[format];
        const codecs =
          format === 'webm'
            ? [
                '-c:v',
                'libvpx',
                '-deadline',
                'realtime',
                '-cpu-used',
                '6',
                '-threads:v',
                '1',
                '-b:v',
                options.webmBitrate,
                '-crf',
                String(options.crf + 5),
                '-c:a',
                'libopus'
              ]
            : [
                '-c:v',
                'libx264',
                '-preset',
                'ultrafast',
                '-crf',
                String(options.crf),
                '-c:a',
                'aac'
              ];
        code = await ffmpeg.exec([
          ...input,
          ...mapping,
          '-vf',
          fitVideo(options.videoSide),
          '-pix_fmt',
          'yuv420p',
          ...codecs,
          '-b:a',
          options.bitrate,
          ...common
        ]);
      }
      ffmpeg.off('progress', progress);
      signal.throwIfAborted();
      if (code)
        throw new Error('转换失败，请确认媒体编码受支持，或试用其他输出格式。');
      const result = await probe(ffmpeg, target);
      const size = Number(result?.format?.size);
      if (!Number.isFinite(size) || size <= 0 || !result?.streams?.length)
        throw new Error('转换未生成可读取的文件。');
      if (size >= resultLimit * 0.98)
        throw new Error(
          '输出接近浏览器内存上限，请选择小体积预设、压缩格式或分段转换。'
        );
      const bytes = await ffmpeg.readFile(target);
      if (typeof bytes === 'string') throw new Error('无法读取转换结果。');
      const output =
        bytes.buffer instanceof ArrayBuffer
          ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          : new Uint8Array(bytes);
      return new File([output], outputName(file, format), {
        type: mimeType
      });
    },
    () => onProgress(0, true)
  );
}
