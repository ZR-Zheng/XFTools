import { useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolTextInput from '@components/input/ToolTextInput';
import ToolTextResult from '@components/result/ToolTextResult';
import Glyph from '@components/workbench/Glyph';
import { CustomSnackBarContext } from 'contexts/CustomSnackBarContext';
import { containsOnlyDigits } from '@utils/string';
import { humanTimeValidation } from '@utils/time';
import { convertDaysToHours } from '../convert-days-to-hours/service';
import { convertHoursToDays } from '../convert-hours-to-days/service';
import { convertSecondsToTime } from '../convert-seconds-to-time/service';
import { convertTimetoSeconds } from '../convert-time-to-seconds/service';
import { convertTimeToDecimal } from '../convert-time-to-decimal/service';
import './duration-workbench.css';

const modes = [
  {
    id: 'days-to-hours',
    label: '天 → 小时',
    from: '天数',
    to: '小时',
    kind: 'days',
    sample: '1.5',
    batch: '1.5\n2\n7'
  },
  {
    id: 'hours-to-days',
    label: '小时 → 天',
    from: '小时数',
    to: '天',
    kind: 'hours',
    sample: '36',
    batch: '36\n48\n72'
  },
  {
    id: 'seconds-to-time',
    label: '秒 → 时:分:秒',
    from: '秒数',
    to: '时:分:秒',
    kind: 'seconds',
    sample: '5400',
    batch: '5400\n86401\n360000'
  },
  {
    id: 'time-to-seconds',
    label: '时:分:秒 → 秒',
    from: '时长',
    to: '秒',
    kind: 'clock',
    sample: '01:30:00',
    batch: '01:30:00\n24:00:01\n100:00:00'
  },
  {
    id: 'time-to-decimal',
    label: '时:分:秒 → 小数小时',
    from: '时长',
    to: '小时（小数）',
    kind: 'clock',
    sample: '01:30:00',
    batch: '01:30:00\n00:45:00\n02:10:15'
  }
] as const;
type Mode = (typeof modes)[number];
type Values = Partial<Record<Mode['kind'], string>>;

function convertLine(
  line: string,
  mode: Mode,
  precision: string,
  option: boolean
): string | null {
  const value = line.trim();
  if (!value) return '';
  if (mode.kind !== 'clock' && !containsOnlyDigits(value.split(/\s+/)[0]))
    return null;
  try {
    switch (mode.id) {
      case 'days-to-hours':
        return convertDaysToHours(value, option);
      case 'hours-to-days':
        return convertHoursToDays(value, precision, option);
      case 'seconds-to-time':
        return convertSecondsToTime(value, option) || null;
      case 'time-to-seconds':
        return convertTimetoSeconds(value);
      case 'time-to-decimal':
        return humanTimeValidation(value).isValid
          ? convertTimeToDecimal(value, { decimalPlaces: precision })
          : null;
    }
  } catch {
    return null;
  }
}

export default function DurationConverter() {
  const [params, setParams] = useSearchParams();
  const mode = modes.find((item) => item.id === params.get('mode')) ?? modes[0];
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [batch, setBatch] = useState(false);
  const [singleValues, setSingleValues] = useState<Values>({});
  const [batchValues, setBatchValues] = useState<Values>({});
  const [precisions, setPrecisions] = useState<
    Partial<Record<Mode['id'], string>>
  >({});
  const [showUnits, setShowUnits] = useState(false);
  const [padTime, setPadTime] = useState(false);
  const precision = precisions[mode.id] ?? '6';
  const needsPrecision =
    mode.id === 'hours-to-days' || mode.id === 'time-to-decimal';
  const precisionValid =
    !needsPrecision || (/^\d+$/.test(precision) && Number(precision) <= 100);
  const withUnit = mode.id === 'days-to-hours' || mode.id === 'hours-to-days';
  const value = batch
    ? (batchValues[mode.kind] ?? singleValues[mode.kind] ?? '')
    : (singleValues[mode.kind] ?? '');
  const option = mode.id === 'seconds-to-time' ? padTime : showUnits;
  const results = precisionValid
    ? value.split(/\r?\n/).map((line) => {
        const result = convertLine(line, mode, precision, option);
        return result !== null && /NaN|Infinity/.test(result) ? null : result;
      })
    : [];
  const invalid = results.flatMap((result, index) =>
    result === null ? [index + 1] : []
  );
  const output = results.join('\n');

  function updateValue(next: string) {
    const setValues = batch ? setBatchValues : setSingleValues;
    setValues((previous) => ({ ...previous, [mode.kind]: next }));
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(output);
      showSnackBar('已复制结果', 'success');
    } catch {
      showSnackBar('无法复制，请选中结果手动复制。', 'error');
    }
  }

  return (
    <div className="duration-workbench">
      <section
        className="duration-settings tool-panel"
        aria-label="时长换算设置"
      >
        <label className="duration-field">
          <span>换算方向</span>
          <select
            className="ui-input"
            value={mode.id}
            onChange={(event) =>
              setParams({ mode: event.target.value }, { replace: true })
            }
          >
            {modes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="duration-mode" role="group" aria-label="输入方式">
          <button
            type="button"
            aria-pressed={!batch}
            onClick={() => setBatch(false)}
          >
            单项
          </button>
          <button
            type="button"
            aria-pressed={batch}
            onClick={() => setBatch(true)}
          >
            批量
          </button>
        </div>
        {needsPrecision && (
          <label className="duration-field duration-precision">
            <span>小数位数</span>
            <input
              className="ui-input"
              type="number"
              min={0}
              max={100}
              step={1}
              value={precision}
              aria-invalid={!precisionValid}
              onChange={(event) =>
                setPrecisions({ ...precisions, [mode.id]: event.target.value })
              }
            />
          </label>
        )}
        {withUnit && (
          <label className="duration-toggle">
            <input
              type="checkbox"
              className="ui-check"
              checked={showUnits}
              onChange={(event) => setShowUnits(event.target.checked)}
            />
            添加单位后缀
          </label>
        )}
        {mode.id === 'seconds-to-time' && (
          <label className="duration-toggle">
            <input
              type="checkbox"
              className="ui-check"
              checked={padTime}
              onChange={(event) => setPadTime(event.target.checked)}
            />
            数字补零
          </label>
        )}
      </section>
      <div className="duration-panes">
        <section className="tool-panel duration-input">
          <div className="duration-panel-heading">
            <h2>输入</h2>
            <button
              type="button"
              className="duration-text-button"
              onClick={() => updateValue(batch ? mode.batch : mode.sample)}
            >
              <Glyph name="sparkle" size={15} /> 载入示例
            </button>
          </div>
          {batch ? (
            <ToolTextInput
              title={mode.from}
              placeholder={'每行输入一项，例如：\n' + mode.batch}
              value={value}
              onChange={updateValue}
            />
          ) : (
            <label className="duration-field">
              <span>{mode.from}</span>
              <input
                className="ui-input"
                type="text"
                inputMode={mode.kind === 'clock' ? 'text' : 'decimal'}
                value={value}
                placeholder={'例如：' + mode.sample}
                onChange={(event) => updateValue(event.target.value)}
              />
            </label>
          )}
          {!precisionValid && (
            <p className="duration-error" role="alert">
              小数位数须为 0 至 100 的整数。
            </p>
          )}
          {invalid.length > 0 && (
            <p className="duration-error" role="alert">
              {batch
                ? '第 ' + invalid.join('、') + ' 行格式有误。'
                : '输入格式有误。'}
              {' 例如：' + mode.sample}
            </p>
          )}
        </section>
        <section className="tool-panel duration-result">
          <div className="duration-panel-heading">
            <h2>换算结果</h2>
          </div>
          {batch ? (
            <ToolTextResult title={mode.to} value={output} />
          ) : (
            <>
              <div className="duration-value">
                <span>{mode.to}</span>
                <output aria-label="换算结果">{output || '—'}</output>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={!output}
                onClick={() => void copyResult()}
              >
                <Glyph name="copy" size={16} /> 复制结果
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
