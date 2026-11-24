import { lazy } from 'react';
import { defineTool } from '@tools/defineTool';

export const chartBoard = defineTool('charts', {
  path: 'board',
  standalone: true,
  loadFullLocale: false,
  icon: 'mdi:chart-line',
  component: lazy(() => import('./index')),
  keywords: [
    'LineChartAssistant',
    '统计图',
    '图表',
    '折线图',
    '柱状图',
    '饼图',
    '象形图',
    '数据可视化'
  ],
  i18n: {
    name: 'translation:chartBoard.title',
    description: 'translation:chartBoard.description',
    shortDescription: 'translation:chartBoard.shortDescription',
    userTypes: ['generalUsers']
  }
});
