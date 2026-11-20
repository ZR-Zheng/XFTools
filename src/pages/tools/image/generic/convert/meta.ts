import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const tool = defineTool('image-generic', {
  path: 'convert',
  icon: 'material-symbols-light:image-outline-rounded',
  keywords: [
    'jpg',
    'jpeg',
    'webp',
    'png',
    'heic',
    'image converter',
    '图片转JPG',
    '图片转WebP',
    '图片转PNG',
    'JPG转PNG',
    '图像格式转换'
  ],
  i18n: {
    name: 'image:convert.title',
    description: 'image:convert.description',
    shortDescription: 'image:convert.shortDescription',
    userTypes: ['generalUsers']
  },
  component: lazy(() => import('./index'))
});
