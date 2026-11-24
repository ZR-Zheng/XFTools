import { useState } from 'react';
import {
  clipDuration,
  clamp,
  minClip,
  timeText,
  type Asset,
  type Clip,
  type Entry
} from './project';
import type { Lane } from './WaveTimeline';

export type InspectorTab = 'clip' | 'effects' | 'loop';

export function NumberField({
  label,
  value,
  min,
  max,
  step = 0.001,
  onChange,
  disabled
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string>();
  return (
    <label className="aw-field">
      <span>{label}</span>
      <input
        className="ui-input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={draft ?? Number(value.toFixed(3))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onBlur={() => {
          if (draft?.trim() && Number.isFinite(Number(draft)))
            onChange(clamp(Number(draft), min, max));
          setDraft(undefined);
        }}
      />
    </label>
  );
}

const tabs = [
  { id: 'clip', title: '片段' },
  { id: 'effects', title: '处理' },
  { id: 'loop', title: '循环' }
] as const;
const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export default function AudioInspector({
  selected,
  asset,
  lane,
  tab,
  onTab,
  onChange,
  onOffset,
  onRepeat
}: {
  selected?: Entry;
  asset?: Asset;
  lane: Lane;
  tab: InspectorTab;
  onTab: (next: InspectorTab) => void;
  onChange: (clip: Clip) => void;
  onOffset: (value: number) => void;
  onRepeat: (count: number) => void;
}) {
  const [repeat, setRepeat] = useState(2);
  const clip = selected?.clip;
  const duration = clip ? clipDuration(clip) : 0;
  function change(patch: Partial<Clip>) {
    if (!clip) return;
    const next = { ...clip, ...patch };
    if (
      Object.keys(patch).every(
        (key) => next[key as keyof Clip] === clip[key as keyof Clip]
      )
    )
      return;
    const length = clipDuration(next);
    onChange({
      ...next,
      fadeIn: Math.min(length, next.fadeIn),
      fadeOut: Math.min(length, next.fadeOut)
    });
  }

  return (
    <>
      <div className="aw-tabs" role="group" aria-label="音频编辑模式">
        {tabs.map(({ id, title }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => onTab(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {!clip || !asset ? (
        <p className="aw-muted">导入并选中片段后即可调整。</p>
      ) : (
        <div className="aw-inspector-body" key={clip.id}>
          <div className="aw-file-summary">
            <strong title={asset.file.name}>{asset.file.name}</strong>
            <span>
              {lane === 'main' ? '剪辑轨' : '混音轨'} · {timeText(duration)}
            </span>
          </div>
          {tab === 'clip' && (
            <>
              <div className="aw-pair">
                <NumberField
                  label="开始时间（秒）"
                  value={clip.inPoint}
                  min={0}
                  max={Math.max(
                    0,
                    clip.outPoint -
                      Math.min(asset.duration, minClip * clip.speed)
                  )}
                  onChange={(inPoint) => change({ inPoint })}
                />
                <NumberField
                  label="结束时间（秒）"
                  value={clip.outPoint}
                  min={Math.min(
                    asset.duration,
                    clip.inPoint + minClip * clip.speed
                  )}
                  max={asset.duration}
                  onChange={(outPoint) => change({ outPoint })}
                />
              </div>
              {lane === 'mix' && (
                <NumberField
                  label="混音起点（秒）"
                  value={selected.start}
                  min={0}
                  max={86_400}
                  onChange={onOffset}
                />
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => change({ inPoint: 0, outPoint: asset.duration })}
              >
                恢复完整片段
              </button>
            </>
          )}
          {tab === 'effects' && (
            <>
              <label className="aw-field">
                <span>播放速度</span>
                <select
                  className="ui-input"
                  value={clip.speed}
                  onChange={(event) =>
                    change({ speed: Number(event.target.value) })
                  }
                >
                  {speeds.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}×
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="增益（dB）"
                value={clip.gain}
                min={-36}
                max={12}
                step={0.5}
                onChange={(gain) => change({ gain })}
              />
              <div className="aw-pair">
                <NumberField
                  label="淡入（秒）"
                  value={clip.fadeIn}
                  min={0}
                  max={duration}
                  onChange={(fadeIn) => change({ fadeIn })}
                />
                <NumberField
                  label="淡出（秒）"
                  value={clip.fadeOut}
                  min={0}
                  max={duration}
                  onChange={(fadeOut) => change({ fadeOut })}
                />
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  change({ speed: 1, gain: 0, fadeIn: 0, fadeOut: 0 })
                }
              >
                重置处理
              </button>
            </>
          )}
          {tab === 'loop' && (
            <>
              <NumberField
                label="总播放次数"
                value={repeat}
                min={2}
                max={100}
                step={1}
                onChange={(count) => setRepeat(Math.round(count))}
                disabled={lane === 'mix'}
              />
              <button
                type="button"
                className="primary-button"
                disabled={lane === 'mix'}
                onClick={() => onRepeat(repeat)}
              >
                应用循环
              </button>
              <p className="aw-muted">
                {lane === 'main'
                  ? '在当前片段后追加副本。'
                  : '选中剪辑轨片段即可追加循环。'}
              </p>
            </>
          )}
          {!asset.playable && (
            <p className="aw-muted">
              当前浏览器无法试听此编码，仍可编辑和导出。
            </p>
          )}
          {asset.playable && !asset.peaks && (
            <p className="aw-muted">此素材可正常试听和导出，波形暂不可用。</p>
          )}
        </div>
      )}
    </>
  );
}
