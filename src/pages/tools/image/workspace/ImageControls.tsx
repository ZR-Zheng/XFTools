import { useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import { getResizeDimensions } from '../generic/resize/resize-dimensions';
import {
  maxCanvasSide,
  type DraftEdit,
  type ImageTool,
  type Size,
  type WatermarkPosition
} from './session';

const tools: { id: ImageTool; label: string; icon: string }[] = [
  { id: 'crop', label: '裁剪', icon: 'grid' },
  { id: 'rotate', label: '旋转', icon: 'redo' },
  { id: 'resize', label: '尺寸', icon: 'external' },
  { id: 'extend', label: '画布扩展', icon: 'frame' },
  { id: 'color', label: '调色', icon: 'palette' },
  { id: 'mask', label: '替色与透明', icon: 'palette' },
  { id: 'opacity', label: '不透明度', icon: 'sun' },
  { id: 'watermark', label: '水印', icon: 'text' }
];

function NumberField({
  label,
  value,
  min,
  max,
  change
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  change: (next: number) => void;
}) {
  return (
    <label className="iw-field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value === 0 && min > 0 ? '' : value}
        onChange={(event) => change(Number(event.target.value))}
      />
    </label>
  );
}

function Slide({
  label,
  value,
  min = 0,
  max = 100,
  unit = '%',
  change
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  change: (next: number) => void;
}) {
  return (
    <label className="iw-slider">
      <span>{label}</span>
      <output aria-hidden="true">
        {value}
        {unit}
      </output>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => change(Number(event.target.value))}
      />
    </label>
  );
}

function ResizeFields({
  draft,
  size,
  onDraft
}: {
  draft: Extract<DraftEdit, { type: 'resize' }>;
  size: Size;
  onDraft: (edit: DraftEdit) => void;
}) {
  const [linked, setLinked] = useState(true);
  const change = (key: 'width' | 'height', value: number) => {
    const next = { ...draft, [key]: value };
    onDraft({
      type: 'resize',
      ...getResizeDimensions(size.width, size.height, {
        resizeMethod: 'pixels',
        percentage: '100',
        dimensionType: key,
        width: String(next.width),
        height: String(next.height),
        maintainAspectRatio: linked
      })
    });
  };
  return (
    <>
      <div className="iw-field-grid">
        <NumberField
          label="宽度（px）"
          value={draft.width}
          min={1}
          max={maxCanvasSide}
          change={(value) => change('width', value)}
        />
        <NumberField
          label="高度（px）"
          value={draft.height}
          min={1}
          max={maxCanvasSide}
          change={(value) => change('height', value)}
        />
      </div>
      <label className="iw-check">
        <input
          type="checkbox"
          checked={linked}
          onChange={(event) => setLinked(event.target.checked)}
        />
        锁定宽高比
      </label>
    </>
  );
}

function Settings({
  draft,
  size,
  onDraft
}: {
  draft: DraftEdit;
  size: Size;
  onDraft: (edit: DraftEdit) => void;
}) {
  switch (draft.type) {
    case 'crop': {
      const change = (key: 'x' | 'y' | 'width' | 'height', value: number) => {
        const rect = { ...draft.rect, [key]: value };
        if (draft.circle && (key === 'width' || key === 'height'))
          rect.width = rect.height = value;
        onDraft({ ...draft, rect });
      };
      return (
        <>
          <label className="iw-field">
            裁剪形状
            <select
              value={draft.circle ? 'circle' : 'rectangle'}
              onChange={(event) => {
                const circle = event.target.value === 'circle';
                const { rect } = draft;
                const side = Math.max(
                  1,
                  Math.min(rect.width, rect.height, size.width, size.height)
                );
                onDraft({
                  ...draft,
                  circle,
                  rect: circle
                    ? {
                        x: Math.min(Math.max(0, rect.x), size.width - side),
                        y: Math.min(Math.max(0, rect.y), size.height - side),
                        width: side,
                        height: side
                      }
                    : rect
                });
              }}
            >
              <option value="rectangle">矩形</option>
              <option value="circle">圆形</option>
            </select>
          </label>
          <div className="iw-field-grid">
            <NumberField
              label="横向起点（px）"
              value={draft.rect.x}
              min={0}
              max={size.width - 1}
              change={(value) => change('x', value)}
            />
            <NumberField
              label="纵向起点（px）"
              value={draft.rect.y}
              min={0}
              max={size.height - 1}
              change={(value) => change('y', value)}
            />
            <NumberField
              label="裁剪宽度（px）"
              value={draft.rect.width}
              min={1}
              max={size.width}
              change={(value) => change('width', value)}
            />
            <NumberField
              label="裁剪高度（px）"
              value={draft.rect.height}
              min={1}
              max={size.height}
              change={(value) => change('height', value)}
            />
          </div>
        </>
      );
    }
    case 'rotate': {
      const rotate = (change: number) => {
        const angle =
          ((((draft.angle + change + 180) % 360) + 360) % 360) - 180;
        onDraft({ ...draft, angle });
      };
      return (
        <>
          <div className="iw-field-grid">
            <button type="button" onClick={() => rotate(-90)}>
              左转 90°
            </button>
            <button type="button" onClick={() => rotate(90)}>
              右转 90°
            </button>
            <button
              type="button"
              aria-pressed={draft.flipX}
              onClick={() => onDraft({ ...draft, flipX: !draft.flipX })}
            >
              水平翻转
            </button>
            <button
              type="button"
              aria-pressed={draft.flipY}
              onClick={() => onDraft({ ...draft, flipY: !draft.flipY })}
            >
              垂直翻转
            </button>
          </div>
          <Slide
            label="旋转角度"
            value={draft.angle}
            min={-180}
            max={180}
            unit="°"
            change={(angle) => onDraft({ ...draft, angle })}
          />
        </>
      );
    }
    case 'resize':
      return <ResizeFields draft={draft} size={size} onDraft={onDraft} />;
    case 'extend': {
      const positions = [
        '左上',
        '上中',
        '右上',
        '左中',
        '居中',
        '右中',
        '左下',
        '下中',
        '右下'
      ];
      return (
        <>
          <div className="iw-field-grid">
            <NumberField
              label="画布宽度（px）"
              value={draft.width}
              min={1}
              max={maxCanvasSide}
              change={(width) => onDraft({ ...draft, width })}
            />
            <NumberField
              label="画布高度（px）"
              value={draft.height}
              min={1}
              max={maxCanvasSide}
              change={(height) => onDraft({ ...draft, height })}
            />
          </div>
          <Slide
            label="前景缩放"
            value={draft.scale}
            min={10}
            change={(scale) => onDraft({ ...draft, scale })}
          />
          <p className="iw-task-hint">
            要单独缩小主体，可先去背景，再扩展画布。
          </p>
          <div className="iw-field-grid iw-expand-options">
            <div className="iw-field">
              图片位置
              <div
                className="iw-anchor-grid"
                role="group"
                aria-label="图片位置"
              >
                {positions.map((position, anchor) => (
                  <button
                    key={position}
                    type="button"
                    title={position}
                    aria-label={position}
                    aria-pressed={draft.anchor === anchor}
                    onClick={() => onDraft({ ...draft, anchor })}
                  >
                    <span aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="iw-field">
                背景填充
                <select
                  value={draft.fill}
                  onChange={(event) =>
                    onDraft({
                      ...draft,
                      fill: event.target.value as typeof draft.fill
                    })
                  }
                >
                  <option value="transparent">透明</option>
                  <option value="solid">纯色</option>
                  <option value="blur">原图模糊</option>
                </select>
              </label>
              {draft.fill === 'solid' && (
                <label className="iw-field">
                  画布背景色
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(event) =>
                      onDraft({ ...draft, color: event.target.value })
                    }
                  />
                </label>
              )}
            </div>
          </div>
        </>
      );
    }
    case 'color':
      return (
        <>
          <Slide
            label="亮度"
            value={draft.brightness}
            max={200}
            change={(brightness) => onDraft({ ...draft, brightness })}
          />
          <Slide
            label="对比度"
            value={draft.contrast}
            max={200}
            change={(contrast) => onDraft({ ...draft, contrast })}
          />
          <Slide
            label="饱和度"
            value={draft.saturation}
            max={200}
            change={(saturation) => onDraft({ ...draft, saturation })}
          />
        </>
      );
    case 'mask': {
      const update = (change: Partial<typeof draft>) =>
        onDraft({ ...draft, enabled: true, ...change });
      return (
        <>
          <label className="iw-field">
            颜色处理
            <select
              value={draft.mode}
              onChange={(event) =>
                update({
                  mode:
                    event.target.value === 'replace' ? 'replace' : 'transparent'
                })
              }
            >
              <option value="transparent">将指定颜色设为透明</option>
              <option value="replace">替换为背景颜色</option>
            </select>
          </label>
          <div className="iw-field-grid">
            <label className="iw-field">
              原始颜色
              <input
                type="color"
                value={draft.from}
                onChange={(event) => update({ from: event.target.value })}
              />
            </label>
            {draft.mode === 'replace' && (
              <label className="iw-field">
                替换颜色
                <input
                  type="color"
                  value={draft.to}
                  onChange={(event) => update({ to: event.target.value })}
                />
              </label>
            )}
          </div>
          <Slide
            label="颜色容差"
            value={draft.tolerance}
            change={(tolerance) => update({ tolerance })}
          />
          <label className="iw-toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
            预览颜色处理
          </label>
        </>
      );
    }
    case 'opacity': {
      const update = (change: Partial<typeof draft>) =>
        onDraft({ ...draft, ...change });
      const areaFields = [
        { key: 'x', label: '横向起点（px）', min: 0, max: size.width - 1 },
        { key: 'y', label: '纵向起点（px）', min: 0, max: size.height - 1 },
        { key: 'width', label: '区域宽度（px）', min: 1, max: size.width },
        { key: 'height', label: '区域高度（px）', min: 1, max: size.height }
      ] as const;
      return (
        <>
          <label className="iw-field">
            不透明度方式
            <select
              value={draft.mode}
              onChange={(event) =>
                update({ mode: event.target.value as typeof draft.mode })
              }
            >
              <option value="solid">整体</option>
              <option value="linear">从左到右渐变</option>
              <option value="radial-in">径向渐变（内侧较透明）</option>
              <option value="radial-out">径向渐变（外侧较透明）</option>
            </select>
          </label>
          <Slide
            label="图片不透明度"
            value={draft.percent}
            change={(percent) => update({ percent })}
          />
          {draft.mode !== 'solid' && (
            <div className="iw-field-grid">
              {areaFields.map(({ key, label, min, max }) => (
                <NumberField
                  key={key}
                  label={label}
                  min={min}
                  max={max}
                  value={draft.area[key]}
                  change={(value) =>
                    update({ area: { ...draft.area, [key]: value } })
                  }
                />
              ))}
            </div>
          )}
          <label className="iw-toggle">
            <input
              type="checkbox"
              checked={draft.background !== null}
              onChange={(event) =>
                update({ background: event.target.checked ? '#ffffff' : null })
              }
            />
            填充背景色
          </label>
          {draft.background && (
            <label className="iw-field">
              背景颜色
              <input
                type="color"
                value={draft.background}
                onChange={(event) => update({ background: event.target.value })}
              />
            </label>
          )}
        </>
      );
    }
    case 'watermark':
      return (
        <>
          <label className="iw-field">
            水印文字
            <input
              type="text"
              maxLength={150}
              value={draft.text}
              onChange={(event) =>
                onDraft({ ...draft, text: event.target.value })
              }
            />
          </label>
          <div className="iw-field-grid">
            <label className="iw-field">
              水印位置
              <select
                aria-label="水印位置"
                value={draft.position}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    position: event.target.value as WatermarkPosition
                  })
                }
              >
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="center">居中</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
              </select>
            </label>
            <label className="iw-field">
              文字颜色
              <input
                type="color"
                value={draft.color}
                onChange={(event) =>
                  onDraft({ ...draft, color: event.target.value })
                }
              />
            </label>
          </div>
          <Slide
            label="文字大小"
            value={draft.size}
            min={2}
            max={35}
            change={(size) => onDraft({ ...draft, size })}
          />
          <Slide
            label="水印不透明度"
            value={draft.percent}
            change={(percent) => onDraft({ ...draft, percent })}
          />
        </>
      );
  }
}

export default function ImageControls({
  tool,
  draft,
  size,
  dirty,
  invalid,
  busy,
  onTool,
  onDraft,
  onApply,
  onDiscard
}: {
  tool: ImageTool;
  draft: DraftEdit | null;
  size: Size | null;
  dirty: boolean;
  invalid: boolean;
  busy: boolean;
  onTool: (tool: ImageTool) => void;
  onDraft: (draft: DraftEdit) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const title = tools.find((item) => item.id === tool)?.label;
  return (
    <div aria-label="编辑工具">
      <div className="iw-tools" role="group" aria-label="选择编辑工具">
        {tools.map(({ id, label, icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={tool === id}
            disabled={busy}
            onClick={() => onTool(id)}
          >
            <Glyph name={icon} size={18} /> {label}
          </button>
        ))}
      </div>
      {draft && size && (
        <div className="iw-settings">
          <h2>{title}</h2>
          <fieldset disabled={busy}>
            <Settings draft={draft} size={size} onDraft={onDraft} />
            {invalid && (
              <p className="iw-alert" role="alert">
                {tool === 'crop' || tool === 'opacity'
                  ? '区域须在当前图片内。'
                  : '请输入有效尺寸。单边最多 8192 像素，总像素数最多 2400 万。'}
              </p>
            )}
            <div className="iw-settings-actions">
              <button type="button" disabled={!dirty} onClick={onDiscard}>
                取消调整
              </button>
              <button
                type="button"
                className="iw-primary"
                disabled={!dirty || invalid}
                onClick={onApply}
              >
                应用
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
