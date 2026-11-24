import { toolAliases } from './tool-aliases';

type LaunchAction = { label: string; to: string };

function action(label: string, legacy: keyof typeof toolAliases): LaunchAction {
  const { path, query } = toolAliases[legacy];
  return { label, to: `/${path}?${query}` };
}

export const launchActions: Partial<Record<string, LaunchAction[]>> = {
  'converters/workspace': [
    { label: '视频转码', to: '/converters/workspace?group=video&format=mp4' },
    action('音频转换', 'converters/audio-converter')
  ],
  'pdf/workspace': [
    action('合并 PDF', 'pdf/merge-pdf'),
    action('拆分 PDF', 'pdf/split-pdf'),
    action('批注', 'pdf/editor')
  ],
  'image/workspace': [
    action('裁剪', 'image-generic/crop'),
    { label: '画布扩展', to: '/image/workspace?tool=extend' },
    action('批量缩放', 'image-generic/resize'),
    action('去背景', 'image-generic/remove-background')
  ],
  'video/workspace': [
    action('剪辑视频', 'video/trim'),
    action('制作动图', 'gif/images-to-gif'),
    action('提取音轨', 'audio/extract-audio')
  ],
  'audio/workspace': [
    action('裁剪音频', 'audio/trim'),
    action('调节速度', 'audio/change-speed'),
    action('循环音频', 'audio/loop')
  ],
  'time/calculator': [
    action('日期差', 'time/time-between-dates'),
    action('时长换算', 'time/convert-duration'),
    action('时间戳', 'time/convert-unix-to-date')
  ]
};
