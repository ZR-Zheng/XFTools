import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const tool = defineTool('pdf', {
  path: 'export',
  icon: 'tabler:file-export',
  keywords: [
    'pdf',
    'png',
    'epub',
    'ebook',
    'pdf-to-png',
    'pdf-to-epub',
    'PDF转图片',
    'PDF转PNG',
    'PDF转EPUB',
    '导出PDF页面'
  ],
  i18n: {
    name: 'pdf:exportPdf.title',
    description: 'pdf:exportPdf.description',
    shortDescription: 'pdf:exportPdf.shortDescription',
    userTypes: ['generalUsers']
  },
  component: lazy(() => import('./index'))
});
