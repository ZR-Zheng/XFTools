export type Framing = 'contain' | 'cover';

export const videoTemplates = [
  {
    id: 'landscape',
    title: '横屏视频',
    label: '16:9',
    width: 16,
    height: 9,
    description: '适合演示、教程和横屏成片',
    format: 'mp4',
    framing: 'contain',
    stillDuration: 2
  },
  {
    id: 'short',
    title: '竖屏短视频',
    label: '9:16',
    width: 9,
    height: 16,
    description: '适合手机全屏播放',
    format: 'mp4',
    framing: 'cover',
    stillDuration: 2
  },
  {
    id: 'square',
    title: '方形视频',
    label: '1:1',
    width: 1,
    height: 1,
    description: '适合信息流和产品展示',
    format: 'mp4',
    framing: 'cover',
    stillDuration: 2
  },
  {
    id: 'portrait',
    title: '竖版图文',
    label: '4:5',
    width: 4,
    height: 5,
    description: '适合由照片或插图组成的视频',
    format: 'mp4',
    framing: 'contain',
    stillDuration: 3
  },
  {
    id: 'gif',
    title: '方形动图',
    label: '1:1',
    width: 1,
    height: 1,
    description: '适合表情包和图片轮播',
    format: 'gif',
    framing: 'contain',
    stillDuration: 0.2
  }
] as const;

export type TemplateId = (typeof videoTemplates)[number]['id'];
export type CanvasSettings = {
  template: TemplateId | 'source' | 'jianying';
  framing: Framing;
  dimensions?: { width: number; height: number };
  frameRate?: number;
};
export const sourceCanvas: CanvasSettings = {
  template: 'source',
  framing: 'contain'
};

export function getTemplate(id: CanvasSettings['template']) {
  return videoTemplates.find((template) => template.id === id);
}
