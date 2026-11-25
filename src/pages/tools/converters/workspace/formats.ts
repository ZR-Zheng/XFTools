import { AUDIO_FORMATS } from '../audio-converter/types';

export const audioFormats = {
  ...AUDIO_FORMATS,
  m4a: { codec: 'aac', bitrate: '192k', mimeType: 'audio/mp4' },
  opus: { codec: 'libopus', bitrate: '128k', mimeType: 'audio/ogg' }
} as const;

export type AudioFormat = keyof typeof audioFormats;

export const groups = {
  video: {
    formats: ['mp4', 'webm', 'mov', 'mkv', 'gif', 'mp3', 'm4a', 'wav'],
    extensions: [
      'mp4',
      'webm',
      'mov',
      'mkv',
      'avi',
      'm4v',
      '3gp',
      'mpeg',
      'mpg',
      'ts',
      'gif'
    ]
  },
  audio: {
    formats: ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'flac'],
    extensions: [
      'mp3',
      'm4a',
      'aac',
      'ogg',
      'oga',
      'opus',
      'wav',
      'flac',
      'aiff',
      'aif',
      'webm',
      'wma'
    ]
  },
  image: {
    formats: ['jpg', 'png', 'webp', 'bmp', 'pdf'],
    extensions: [
      'jpg',
      'jpeg',
      'png',
      'webp',
      'bmp',
      'avif',
      'gif',
      'heic',
      'heif'
    ]
  },
  document: {
    formats: ['png', 'jpg', 'txt', 'epub'],
    extensions: ['pdf']
  }
} as const;

export type Group = keyof typeof groups;
export type Format = (typeof groups)[Group]['formats'][number];
export type Preset = 'high' | 'balanced' | 'compact';
export type AdvancedOptions = {
  videoSide?: number;
  frameRate?: number;
  crf?: number;
  videoBitrate?: number;
  encodeSpeed?: 'ultrafast' | 'veryfast' | 'fast';
  fastStart?: boolean;
  mute?: boolean;
  gifSide?: number;
  gifFps?: number;
  gifLoop?: number;
  gifColors?: number;
  gifDither?: 'bayer' | 'sierra2_4a' | 'none';
  start?: number;
  duration?: number;
  audioBitrate?: number;
  sampleRate?: number;
  channels?: number;
  wavDepth?: number;
  flacLevel?: number;
  imageSide?: number;
  quality?: number;
  flatten?: boolean;
  background?: string;
  paper?: 'source' | 'a4' | 'letter';
  margin?: number;
  pdfScale?: number;
  rotation?: number;
  txtBreak?: 'blank' | 'line' | 'formfeed';
  txtCrlf?: boolean;
  txtBom?: boolean;
  epubTitle?: string;
  epubAuthor?: string;
  epubLanguage?: string;
};
export type Settings = {
  group: Group;
  format: Format;
  preset: Preset;
  pages: string;
  advanced?: AdvancedOptions;
};

export const presets = {
  high: {
    quality: 0.95,
    videoSide: 1920,
    crf: 19,
    webmBitrate: '3500k',
    bitrate: '256k',
    imageSide: 0,
    pdfScale: 2,
    gifSide: 720,
    gifFps: 18
  },
  balanced: {
    quality: 0.85,
    videoSide: 1280,
    crf: 24,
    webmBitrate: '2200k',
    bitrate: '192k',
    imageSide: 0,
    pdfScale: 1.5,
    gifSide: 480,
    gifFps: 12
  },
  compact: {
    quality: 0.7,
    videoSide: 854,
    crf: 30,
    webmBitrate: '1000k',
    bitrate: '96k',
    imageSide: 1280,
    pdfScale: 1,
    gifSide: 320,
    gifFps: 8
  }
} as const;

export const fileLimit = 150 * 1024 * 1024;
export const resultLimit = 160 * 1024 * 1024;

export function supportsFormat(group: Group, format: string): format is Format {
  return (groups[group].formats as readonly string[]).includes(format);
}

export function isAudioFormat(format: Format): format is AudioFormat {
  return Object.hasOwn(audioFormats, format);
}

export function settingsError({ format, advanced }: Settings) {
  if (!advanced) return;
  const { start, duration, quality, crf, videoBitrate, margin } = advanced;
  const outside = (
    value: number | undefined,
    min: number,
    max = Infinity,
    integer = false
  ) =>
    value !== undefined &&
    (!Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value)));
  if (outside(start, 0) || outside(duration, 0.001))
    return '截取起点不能为负数，时长至少为 0.001 秒。';
  if (outside(quality, 1, 100, true)) return '图片质量须为 1 到 100 的整数。';
  if (outside(crf, 0, format === 'webm' ? 63 : 51, true))
    return '视频质量超出 CRF 可用范围。';
  if (outside(videoBitrate, 50, 20000, true))
    return '视频码率须为 50 到 20000 kbps。';
  if (outside(margin, 0, 40)) return 'PDF 页边距须在 0 到 40 毫米之间。';
}

export function outputName(file: File, extension: string, suffix = '') {
  return `${file.name.replace(/\.[^.]+$/, '') || file.name}${suffix}.${extension}`;
}
