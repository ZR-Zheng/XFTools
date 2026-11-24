import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const conversionWorkspace = defineTool('converters', {
  path: 'workspace',
  standalone: true,
  loadFullLocale: false,
  icon: 'mdi:swap-horizontal',
  component: lazy(() => import('./index')),
  keywords: [
    '格式转换工作台',
    '格式工厂',
    '批量转格式',
    '批量转换',
    '视频转换',
    '音频转换',
    '提取音频',
    '图片转换',
    '文档转换',
    '视频转 GIF',
    '图片转 PDF',
    'MP4',
    'WebM',
    'MOV',
    'MKV',
    'AVI',
    'MP3',
    'M4A',
    'WAV',
    'FLAC',
    'HEIC',
    'AVIF',
    'WebP',
    'JPG',
    'PNG',
    'BMP',
    'EPUB',
    'PDF 转 TXT',
    'file converter',
    'batch convert',
    'format factory'
  ],
  i18n: {
    name: 'converters:workspace.title',
    description: 'converters:workspace.description',
    shortDescription: 'converters:workspace.shortDescription',
    userTypes: ['generalUsers']
  }
});
