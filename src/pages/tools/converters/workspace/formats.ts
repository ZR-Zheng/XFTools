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
export type Settings = {
  group: Group;
  format: Format;
  preset: Preset;
  pages: string;
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

export function outputName(file: File, extension: string, suffix = '') {
  return `${file.name.replace(/\.[^.]+$/, '') || file.name}${suffix}.${extension}`;
}
