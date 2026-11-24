import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const calculator = defineTool('time', {
  path: 'calculator',
  icon: 'mdi:calculator-variant-outline',
  alternativeCategories: ['converters'],
  keywords: [
    '日期与时间计算器',
    '日期时间计算器',
    '计算器',
    '算式',
    '四则运算',
    '百分比',
    '年龄计算',
    '日期差',
    '日期推算',
    '工作日',
    '星期',
    '闰年',
    '日期间隔',
    '时长',
    '时长加减',
    '时长换算',
    '天转小时',
    '小时转天',
    '秒转时间',
    '时间转秒',
    '时间转小数',
    '时间戳',
    'Unix',
    'Discord',
    'Cron',
    '截断时间',
    'calculator',
    'date difference',
    'duration',
    'HH:MM:SS'
  ],
  i18n: {
    name: 'time:calculator.title',
    description: 'time:calculator.description',
    shortDescription: 'time:calculator.shortDescription',
    userTypes: ['generalUsers', 'developers']
  },
  component: lazy(() => import('./index'))
});
