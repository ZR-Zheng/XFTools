import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const tool = defineTool('time', {
  path: 'convert-duration',
  icon: 'fluent-mdl2:date-time',
  keywords: [
    'duration',
    'days',
    'hours',
    'seconds',
    'decimal hours',
    'HH:MM:SS',
    '天转小时',
    '小时转天',
    '秒转时间',
    '时间转秒',
    '时间转小数'
  ],
  i18n: {
    name: 'time:convertDuration.title',
    description: 'time:convertDuration.description',
    shortDescription: 'time:convertDuration.shortDescription',
    userTypes: ['generalUsers']
  },
  component: lazy(() => import('./index'))
});
