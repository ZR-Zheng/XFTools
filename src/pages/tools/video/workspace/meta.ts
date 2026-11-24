import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const videoWorkspace = defineTool('video', {
  path: 'workspace',
  standalone: true,
  loadFullLocale: false,
  alternativeCategories: ['audio', 'gif'],
  icon: 'mdi:movie-edit-outline',
  component: lazy(() => import('./index')),
  keywords: [
    '视频工作台',
    '视频剪辑器',
    '视频剪辑',
    '剪切视频',
    '修剪视频',
    '视频拼接',
    '合并视频',
    '视频变速',
    '视频旋转',
    '视频翻转',
    '裁切画面',
    '循环视频',
    '视频压缩',
    '视频缩放',
    '加配乐',
    '添加音频',
    '提取音频',
    '视频转 GIF',
    'GIF 编辑',
    'GIF 变速',
    '图片转 GIF',
    '制作动图',
    '时间线',
    'MP4',
    'video editor',
    'trim',
    'merge',
    'rotate',
    'flip',
    'crop',
    'resize',
    'compress',
    'extract audio'
  ],
  i18n: {
    name: 'video:workspace.title',
    description: 'video:workspace.description',
    shortDescription: 'video:workspace.shortDescription',
    userTypes: ['generalUsers']
  }
});
