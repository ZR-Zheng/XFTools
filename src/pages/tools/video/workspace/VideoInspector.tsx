import { useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import {
  clamp,
  clipDuration,
  EMPTY_CROP,
  editedSize,
  MIN_CLIP_TIME,
  setCropEdge,
  timeLabel,
  trimEdge,
  type Asset,
  type Clip,
  type CropEdge,
  type Rotation,
  type Soundtrack
} from './timeline';

export const panels = [
  { id: 'clip', title: '片段' },
  { id: 'picture', title: '画面' },
  { id: 'audio', title: '音频' }
] as const;
export type Panel = (typeof panels)[number]['id'];

export function NumberField({
  label,
  value,
  min = 0,
  max,
  step = 0.01,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="vw-field">
      <span>{label}</span>
      <input
        className="ui-input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? Number(value.toFixed(3))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onBlur={() => {
          if (draft && Number.isFinite(Number(draft)))
            onChange(clamp(Number(draft), min, max));
          setDraft(null);
        }}
      />
    </label>
  );
}

function VolumeField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const percentage = Math.round(value * 100);
  return (
    <label className="vw-field vw-volume">
      <span>
        {label} <b aria-hidden="true">{percentage}%</b>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={percentage}
        aria-label={label}
        aria-valuetext={percentage + '%'}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  );
}

interface Props {
  panel: Panel;
  onPanel: (panel: Panel) => void;
  clip?: Clip;
  asset?: Asset;
  duration: number;
  soundtrack: Soundtrack | null;
  audioAsset?: Asset;
  onClip: (clip: Clip) => void;
  onApplyImageDuration?: () => void;
  onSoundtrack: (soundtrack: Soundtrack | null) => void;
  onImportAudio: () => void;
  onClose: () => void;
}

const cropEdges: [CropEdge, string][] = [
  ['left', '左侧（%）'],
  ['top', '顶部（%）'],
  ['right', '右侧（%）'],
  ['bottom', '底部（%）']
];
const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export default function VideoInspector({
  panel,
  onPanel,
  clip,
  asset,
  duration,
  soundtrack,
  audioAsset,
  onClip,
  onApplyImageDuration,
  onSoundtrack,
  onImportAudio,
  onClose
}: Props) {
  const size = asset && clip ? editedSize(asset, clip) : undefined;
  function change(patch: Partial<Clip>) {
    if (clip) onClip({ ...clip, ...patch });
  }
  function editSound(patch: Partial<Soundtrack>) {
    if (soundtrack) onSoundtrack({ ...soundtrack, ...patch });
  }
  return (
    <>
      <header className="vw-pane-header">
        <h2>片段设置</h2>
        <button
          className="vw-icon vw-mobile-only"
          type="button"
          aria-label="关闭片段设置"
          onClick={onClose}
        >
          <Glyph name="close" size={17} />
        </button>
      </header>
      <div
        className="vw-pills vw-inspector-tabs"
        role="group"
        aria-label="设置类别"
      >
        {panels.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={panel === item.id}
            onClick={() => onPanel(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="vw-inspector-body" key={clip?.id}>
        {!clip && panel !== 'audio' && (
          <p className="vw-muted">添加视频或图片后，即可调整片段。</p>
        )}
        {clip && asset?.kind === 'image' && panel === 'clip' && (
          <>
            <p className="vw-inspector-filename" title={asset.file.name}>
              {asset.file.name}
            </p>
            <NumberField
              label="图片停留（秒）"
              value={clipDuration(clip)}
              min={MIN_CLIP_TIME}
              max={asset.duration}
              onChange={(value) => change({ inPoint: 0, outPoint: value })}
            />
            {onApplyImageDuration && (
              <button
                type="button"
                className="secondary-button"
                onClick={onApplyImageDuration}
              >
                应用到所有静态图片
              </button>
            )}
          </>
        )}
        {clip && asset && asset.kind !== 'image' && panel === 'clip' && (
          <>
            <p className="vw-inspector-filename" title={asset.file.name}>
              {asset.file.name}
            </p>
            <div className="vw-field-grid">
              <NumberField
                label="入点（秒）"
                value={clip.inPoint}
                max={asset.duration}
                onChange={(value) =>
                  onClip(trimEdge(clip, asset.duration, 'inPoint', value))
                }
              />
              <NumberField
                label="出点（秒）"
                value={clip.outPoint}
                max={asset.duration}
                onChange={(value) =>
                  onClip(trimEdge(clip, asset.duration, 'outPoint', value))
                }
              />
            </div>
            <label className="vw-field">
              <span>播放速度</span>
              <select
                className="ui-input"
                value={clip.speed}
                onChange={(event) =>
                  change({ speed: Number(event.target.value) })
                }
              >
                {!speeds.includes(clip.speed) && (
                  <option value={clip.speed}>
                    {Number(clip.speed.toFixed(3))}×
                  </option>
                )}
                {speeds.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
            </label>
            <p className="vw-metric">
              <span>片段时长</span>
              <strong>{timeLabel(clipDuration(clip), true)}</strong>
            </p>
          </>
        )}
        {clip && panel === 'picture' && (
          <>
            <label className="vw-field">
              <span>旋转</span>
              <select
                className="ui-input"
                value={clip.rotation}
                onChange={(event) =>
                  change({ rotation: Number(event.target.value) as Rotation })
                }
              >
                {[0, 90, 180, 270].map((rotation) => (
                  <option key={rotation} value={rotation}>
                    {rotation}°
                  </option>
                ))}
              </select>
            </label>
            <div className="vw-field-grid">
              <button
                type="button"
                className="secondary-button"
                aria-pressed={clip.flipX}
                onClick={() => change({ flipX: !clip.flipX })}
              >
                水平翻转
              </button>
              <button
                type="button"
                className="secondary-button"
                aria-pressed={clip.flipY}
                onClick={() => change({ flipY: !clip.flipY })}
              >
                垂直翻转
              </button>
            </div>
            <div className="vw-inspector-subhead">
              <h3>裁切画面</h3>
              <button
                type="button"
                className="vw-text-button"
                disabled={clip.crop === EMPTY_CROP}
                onClick={() => change({ crop: EMPTY_CROP })}
              >
                重置
              </button>
            </div>
            <div className="vw-field-grid">
              {cropEdges.map(([edge, label]) => (
                <NumberField
                  key={edge}
                  label={label}
                  value={clip.crop[edge]}
                  max={95}
                  step={1}
                  onChange={(value) =>
                    change({ crop: setCropEdge(clip, edge, value) })
                  }
                />
              ))}
            </div>
            {size && (
              <p className="vw-metric">
                <span>画面尺寸</span>
                <strong>
                  {size.width} × {size.height}
                </strong>
              </p>
            )}
          </>
        )}
        {panel === 'audio' && (
          <>
            {clip && asset?.kind === 'video' && (
              <VolumeField
                label="片段原声音量"
                value={clip.volume}
                onChange={(volume) => change({ volume })}
              />
            )}
            <div className="vw-inspector-subhead">
              <h3>配乐轨</h3>
              {soundtrack && (
                <button
                  className="vw-text-button"
                  type="button"
                  onClick={() => onSoundtrack(null)}
                >
                  移除
                </button>
              )}
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={onImportAudio}
            >
              <Glyph name="audio" size={16} />{' '}
              {soundtrack ? '更换配乐' : '导入配乐'}
            </button>
            {soundtrack && audioAsset && (
              <>
                <p
                  className="vw-inspector-filename"
                  title={audioAsset.file.name}
                >
                  {audioAsset.file.name}
                </p>
                <VolumeField
                  label="配乐音量"
                  value={soundtrack.volume}
                  onChange={(volume) => editSound({ volume })}
                />
                <NumberField
                  label="配乐放置位置（秒）"
                  value={soundtrack.offset}
                  max={duration}
                  onChange={(offset) => editSound({ offset })}
                />
                <div className="vw-field-grid">
                  <NumberField
                    label="配乐起点（秒）"
                    value={soundtrack.start}
                    max={Math.max(
                      0,
                      soundtrack.end - Math.min(0.05, audioAsset.duration)
                    )}
                    onChange={(start) => editSound({ start })}
                  />
                  <NumberField
                    label="配乐终点（秒）"
                    value={soundtrack.end}
                    min={soundtrack.start + Math.min(0.05, audioAsset.duration)}
                    max={audioAsset.duration}
                    onChange={(end) => editSound({ end })}
                  />
                </div>
                <label className="vw-check">
                  <input
                    type="checkbox"
                    className="ui-check"
                    checked={soundtrack.loop}
                    onChange={(event) =>
                      editSound({ loop: event.target.checked })
                    }
                  />
                  循环至视频结尾
                </label>
                <label className="vw-check">
                  <input
                    type="checkbox"
                    className="ui-check"
                    checked={soundtrack.replace}
                    onChange={(event) =>
                      editSound({ replace: event.target.checked })
                    }
                  />
                  替换整条视频原声
                </label>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
