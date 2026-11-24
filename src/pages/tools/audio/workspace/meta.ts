import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const audioWorkspace = defineTool('audio', {
  path: 'workspace',
  standalone: true,
  loadFullLocale: false,
  icon: 'mdi:waveform',
  component: lazy(() => import('./index')),
  keywords: [
    '音乐工作台',
    '音乐编辑器',
    '音乐编辑',
    '音频编辑',
    '音频裁剪',
    '音频合并',
    '音频拼接',
    '波形',
    '变速',
    '循环音频',
    '混音',
    '增益',
    '淡入淡出',
    '转格式',
    'MP3',
    'AAC',
    'WAV',
    'FLAC',
    'OGG',
    'audio editor',
    'trim',
    'merge',
    'convert'
  ],
  i18n: {
    name: 'audio:workspace.title',
    description: 'audio:workspace.description',
    shortDescription: 'audio:workspace.shortDescription',
    userTypes: ['generalUsers']
  }
});
