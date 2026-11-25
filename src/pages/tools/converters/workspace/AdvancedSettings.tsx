import {
  audioFormats,
  isAudioFormat,
  presets,
  type AdvancedOptions,
  type Settings
} from './formats';

const dimensions = [
  160, 240, 320, 480, 720, 854, 1080, 1280, 1440, 1920, 2160, 2560, 4096
];
const bitrates = [64, 96, 128, 160, 192, 224, 256, 320];
const options = (values: readonly number[], suffix = '') =>
  values.map((value) => [value, String(value) + suffix] as const);

function Choice<T extends string | number>({
  label,
  value,
  choices,
  baseline,
  onChange
}: {
  label: string;
  value?: T;
  choices: readonly (readonly [T, string])[];
  baseline: string;
  onChange: (value?: T) => void;
}) {
  return (
    <label className="cw-field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) =>
          onChange(choices[event.target.selectedIndex - 1]?.[0])
        }
      >
        <option value="">{baseline}</option>
        {choices.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  value,
  onChange
}: {
  label: string;
  value?: boolean;
  onChange: (value?: boolean) => void;
}) {
  return (
    <label className="cw-advanced-check">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(event) => onChange(event.target.checked || undefined)}
      />
      {label}
    </label>
  );
}

function NumberOption({
  label,
  baseline,
  value,
  min = 0,
  max,
  step,
  onChange
}: {
  label: string;
  baseline: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <label className="cw-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        placeholder={baseline}
        min={min}
        max={max}
        step={step ?? 'any'}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? undefined : event.target.valueAsNumber
          )
        }
      />
    </label>
  );
}

export default function AdvancedSettings({
  settings,
  onChange,
  onReset
}: {
  settings: Settings;
  onChange: (patch: Partial<AdvancedOptions>) => void;
  onReset: () => void;
}) {
  const { group, format, preset, advanced = {} } = settings;
  const defaults = presets[preset];
  const set =
    <K extends keyof AdvancedOptions>(key: K) =>
    (value?: AdvancedOptions[K]) =>
      onChange({ [key]: value });
  const audio = isAudioFormat(format);
  const gif = group === 'video' && format === 'gif';
  const video = group === 'video' && !audio && !gif;
  const lossy = (audio && Boolean(audioFormats[format].bitrate)) || video;
  const usesAudio = audio || (video && !advanced.mute);
  const flatten =
    advanced.flatten ||
    format === 'jpg' ||
    format === 'bmp' ||
    (group === 'image' && format === 'pdf');
  const quality = (
    <NumberOption
      label="图片质量（%）"
      baseline={String(Math.round(defaults.quality * 100))}
      value={advanced.quality}
      min={1}
      max={100}
      step={1}
      onChange={set('quality')}
    />
  );
  const hasOverrides = Object.values(advanced).some(
    (value) => value !== undefined
  );
  return (
    <details className="cw-advanced">
      <summary>详细参数{hasOverrides && <span>已自定义</span>}</summary>
      <div className="cw-advanced-fields">
        {(video || gif || audio) && (
          <>
            <NumberOption
              label="截取起点（秒）"
              baseline="0"
              value={advanced.start}
              onChange={set('start')}
            />
            <NumberOption
              label="截取时长（秒）"
              baseline="至文件结尾"
              value={advanced.duration}
              onChange={set('duration')}
            />
          </>
        )}
        {video && (
          <>
            <Choice
              label="视频长边上限"
              value={advanced.videoSide}
              baseline={defaults.videoSide + ' px（预设）'}
              choices={[[0, '原始尺寸'], ...options(dimensions, ' px')]}
              onChange={set('videoSide')}
            />
            <Choice
              label="视频帧率"
              value={advanced.frameRate}
              baseline="跟随原视频"
              choices={options([12, 15, 24, 25, 30, 48, 50, 60], ' fps')}
              onChange={set('frameRate')}
            />
            <NumberOption
              label="视频质量（CRF）"
              baseline={String(defaults.crf + (format === 'webm' ? 5 : 0))}
              value={advanced.crf}
              min={0}
              max={format === 'webm' ? 63 : 51}
              step={1}
              onChange={set('crf')}
            />
            {format === 'webm' ? (
              <NumberOption
                label="视频码率（kbps）"
                baseline={defaults.webmBitrate.slice(0, -1)}
                value={advanced.videoBitrate}
                min={50}
                max={20000}
                step={1}
                onChange={set('videoBitrate')}
              />
            ) : (
              <Choice
                label="编码速度"
                value={advanced.encodeSpeed}
                baseline="极快"
                choices={[
                  ['veryfast', '较快'],
                  ['fast', '较高压缩效率']
                ]}
                onChange={set('encodeSpeed')}
              />
            )}
            <Check
              label="移除音轨"
              value={advanced.mute}
              onChange={set('mute')}
            />
            {(format === 'mp4' || format === 'mov') && (
              <Check
                label="网页快速播放"
                value={advanced.fastStart}
                onChange={set('fastStart')}
              />
            )}
          </>
        )}
        {gif && (
          <>
            <Choice
              label="GIF 长边上限"
              value={advanced.gifSide}
              baseline={defaults.gifSide + ' px（预设）'}
              choices={options(
                [160, 240, 320, 480, 640, 720, 960, 1280],
                ' px'
              )}
              onChange={set('gifSide')}
            />
            <Choice
              label="GIF 帧率"
              value={advanced.gifFps}
              baseline={defaults.gifFps + ' fps（预设）'}
              choices={options([5, 8, 10, 12, 15, 18, 20, 24, 30], ' fps')}
              onChange={set('gifFps')}
            />
            <Choice
              label="GIF 色数"
              value={advanced.gifColors}
              baseline="256 色"
              choices={options([32, 64, 128], ' 色')}
              onChange={set('gifColors')}
            />
            <Choice
              label="GIF 循环"
              value={advanced.gifLoop}
              baseline="一直循环"
              choices={[
                [-1, '仅播放一次'],
                [1, '播放两次']
              ]}
              onChange={set('gifLoop')}
            />
            <Choice
              label="GIF 抖动"
              value={advanced.gifDither}
              baseline="有序抖动"
              choices={[
                ['sierra2_4a', '误差扩散'],
                ['none', '关闭抖动']
              ]}
              onChange={set('gifDither')}
            />
          </>
        )}
        {usesAudio && (
          <>
            {lossy && (
              <Choice
                label="音频码率"
                value={advanced.audioBitrate}
                baseline={defaults.bitrate.slice(0, -1) + ' kbps（预设）'}
                choices={options(bitrates, ' kbps')}
                onChange={set('audioBitrate')}
              />
            )}
            {format !== 'opus' && format !== 'webm' && (
              <Choice
                label="采样率"
                value={advanced.sampleRate}
                baseline="自动"
                choices={options([32000, 44100, 48000], ' Hz')}
                onChange={set('sampleRate')}
              />
            )}
            <Choice
              label="声道"
              value={advanced.channels}
              baseline="自动"
              choices={[
                [1, '单声道'],
                [2, '立体声']
              ]}
              onChange={set('channels')}
            />
            {format === 'wav' && (
              <Choice
                label="WAV 位深"
                value={advanced.wavDepth}
                baseline="16 位"
                choices={options([24, 32], ' 位')}
                onChange={set('wavDepth')}
              />
            )}
            {format === 'flac' && (
              <Choice
                label="FLAC 压缩级别"
                value={advanced.flacLevel}
                baseline="编码器默认"
                choices={[
                  [0, '0 · 最快'],
                  [5, '5 · 均衡'],
                  [8, '8 · 高压缩']
                ]}
                onChange={set('flacLevel')}
              />
            )}
          </>
        )}
        {group === 'image' && (
          <>
            <Choice
              label="图片长边上限"
              value={advanced.imageSide}
              baseline={
                defaults.imageSide
                  ? defaults.imageSide + ' px（预设）'
                  : '原始尺寸'
              }
              choices={[[0, '保留原始尺寸'], ...options(dimensions, ' px')]}
              onChange={set('imageSide')}
            />
            {(format === 'jpg' || format === 'webp' || format === 'pdf') &&
              quality}
            {(format === 'png' || format === 'webp') && (
              <Check
                label="填充透明区域"
                value={advanced.flatten}
                onChange={set('flatten')}
              />
            )}
            {flatten && (
              <label className="cw-field">
                <span>图片背景色</span>
                <input
                  type="color"
                  value={advanced.background ?? '#ffffff'}
                  onChange={(event) => set('background')(event.target.value)}
                />
              </label>
            )}
            {format === 'pdf' && (
              <>
                <Choice
                  label="PDF 纸张"
                  value={advanced.paper}
                  baseline="匹配图片"
                  choices={[
                    ['a4', 'A4'],
                    ['letter', 'Letter']
                  ]}
                  onChange={set('paper')}
                />
                <NumberOption
                  label="PDF 页边距（毫米）"
                  value={advanced.margin}
                  baseline="0"
                  max={40}
                  onChange={set('margin')}
                />
              </>
            )}
          </>
        )}
        {group === 'document' && (format === 'png' || format === 'jpg') && (
          <>
            <Choice
              label="PDF 渲染倍率"
              value={advanced.pdfScale}
              baseline={defaults.pdfScale + '×（预设）'}
              choices={options([0.75, 1, 1.5, 2, 3, 4], '×')}
              onChange={set('pdfScale')}
            />
            <Choice
              label="页面旋转"
              value={advanced.rotation}
              baseline="保留页面方向"
              choices={options([90, 180, 270], '°')}
              onChange={set('rotation')}
            />
            {format === 'jpg' && quality}
          </>
        )}
        {group === 'document' && format === 'txt' && (
          <>
            <Choice
              label="分页分隔"
              value={advanced.txtBreak}
              baseline="空行"
              choices={[
                ['line', '单次换行'],
                ['formfeed', '换页符']
              ]}
              onChange={set('txtBreak')}
            />
            <Check
              label="使用 Windows 换行"
              value={advanced.txtCrlf}
              onChange={set('txtCrlf')}
            />
            <Check
              label="写入 UTF-8 BOM"
              value={advanced.txtBom}
              onChange={set('txtBom')}
            />
          </>
        )}
        {group === 'document' && format === 'epub' && (
          <>
            <label className="cw-field">
              <span>电子书书名</span>
              <input
                value={advanced.epubTitle ?? ''}
                placeholder="源文件名"
                maxLength={120}
                onChange={(event) =>
                  set('epubTitle')(event.target.value || undefined)
                }
              />
            </label>
            <label className="cw-field">
              <span>电子书作者</span>
              <input
                value={advanced.epubAuthor ?? ''}
                placeholder="Converted by xftools"
                maxLength={120}
                onChange={(event) =>
                  set('epubAuthor')(event.target.value || undefined)
                }
              />
            </label>
            <Choice
              label="电子书语言"
              value={advanced.epubLanguage}
              baseline="英语"
              choices={[
                ['zh-CN', '简体中文'],
                ['zh-TW', '繁体中文'],
                ['ja', '日语'],
                ['ko', '韩语'],
                ['fr', '法语'],
                ['de', '德语'],
                ['es', '西班牙语']
              ]}
              onChange={set('epubLanguage')}
            />
          </>
        )}
      </div>
      {hasOverrides && (
        <button className="cw-button cw-quiet" type="button" onClick={onReset}>
          恢复默认参数
        </button>
      )}
    </details>
  );
}
