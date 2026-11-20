import { defineTool } from '@tools/defineTool';
import { lazy } from 'react';

export const tool = defineTool('image-generic', {
  i18n: {
    name: 'image:compress.title',
    description: 'image:compress.description',
    shortDescription: 'image:compress.shortDescription',
    userTypes: ['generalUsers']
  },

  path: 'compress',
  icon: 'material-symbols-light:compress-rounded',

  keywords: ['image', 'compress', 'reduce', 'quality', 'png', '压缩 PNG', '图片压缩', '减小体积'],
  component: lazy(() => import('./index'))
});
