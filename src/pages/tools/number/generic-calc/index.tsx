import { useState } from 'react';
import Qty from 'js-quantities';
import type { ToolComponentProps } from '@tools/defineTool';
import type { GenericCalcType } from './data/types';
import { dataTableLookup } from 'datatables';
import { useWorkbenchText } from 'i18n/workbench';
import { uiText } from 'i18n/uiText';
import { cableOutputs, solveCalculation } from './solver';
import './calculator.css';
import ToolHeaderActions from '@components/ToolHeaderActions';

interface InputValue {
  value: string;
  unit: string;
}
const format = (value: number) =>
  Number.isFinite(value) ? Number(value.toPrecision(12)).toString() : '—';
const units: Record<string, string[]> = {
  volt: ['volt', 'mV', 'kV'],
  V: ['V', 'mV', 'kV'],
  ampere: ['ampere', 'mA', 'kA'],
  A: ['A', 'mA', 'kA'],
  ohm: ['ohm', 'kohm', 'Mohm'],
  meter: ['meter', 'cm', 'mm', 'ft', 'inch'],
  mm: ['mm', 'cm', 'meter', 'inch'],
  mm2: ['mm2', 'cm2', 'm2', 'inch2'],
  mm3: ['mm3', 'cm3', 'm3', 'liter'],
  'ohm*m': ['ohm*m', 'nohm*m', 'uohm*m'],
  'pound-force': ['pound-force', 'N', 'kN']
};
const formulaLabels: Record<string, string> = {
  'ohms-law': 'V = I × R',
  'area-sphere': 'A = 4πr²',
  'volume-sphere': 'V = 4πr³ / 3',
  'cable-voltage-drop': 'ΔV = 2ρLI / A',
  'slackline-tension': 'T = W × √(S² + (L/2)²) / (2S)'
};

function initialInputs(data: GenericCalcType) {
  const values = Object.fromEntries(
    data.variables.map((variable) => [
      variable.name,
      {
        value: variable.default === undefined ? '' : String(variable.default),
        unit: variable.unit
      }
    ])
  );
  data.presets?.forEach((preset) => {
    if (preset.default === '<custom>') return;
    const row = dataTableLookup(preset.source, preset.default);
    Object.entries(preset.bind).forEach(([name, column]) => {
      values[name] = {
        value: String(row[column]),
        unit: preset.source.columns[column].unit || values[name].unit
      };
    });
  });
  return values;
}

export default async function makeTool(data: GenericCalcType) {
  return function Calculator({ title }: ToolComponentProps) {
    const { english } = useWorkbenchText();
    const t = (zh: string, en: string) => (english ? en : zh);
    const defaultTarget =
      data.variables.find((variable) => variable.default === undefined)?.name ||
      data.variables[0].name;
    const [target, setTarget] = useState(defaultTarget);
    const [values, setValues] = useState<Record<string, InputValue>>(() =>
      initialInputs(data)
    );
    const [presets, setPresets] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        (data.presets || []).map((preset) => [preset.title, preset.default])
      )
    );
    const [copied, setCopied] = useState(false);
    const bound = (name: string) =>
      (data.presets || []).some(
        (preset) =>
          presets[preset.title] !== '<custom>' &&
          Object.hasOwn(preset.bind, name)
      );
    const output = data.variables.find((variable) => variable.name === target)!;
    let result: number | null = null,
      error = '';
    const canonical: Record<string, number> = {};
    try {
      for (const variable of data.variables) {
        if (variable.name === target) continue;
        const input = values[variable.name];
        if (!input.value.trim())
          throw new Error('Enter a finite number for each input.');
        canonical[variable.name] = Qty(Number(input.value), input.unit).to(
          variable.unit
        ).scalar;
      }
      canonical[target] = solveCalculation(data.path, target, canonical);
      result = Qty(canonical[target], output.unit).to(
        values[target].unit
      ).scalar;
      if (!Number.isFinite(result))
        throw new Error('The result is outside the supported numeric range.');
    } catch (exception) {
      result = null;
      const message =
        exception instanceof Error ? exception.message : String(exception);
      const messages: Record<string, string> = {
        'Enter a finite number for each input.': '请填写各项有效数值。',
        'The inputs do not determine a unique solution.':
          '这些参数无法确定唯一解，请检查除数是否为零。',
        'These inputs have no real solution.':
          '这些参数没有实数解，请检查输入范围。',
        'These inputs have no physical solution.':
          '这些参数没有有效的物理解，请检查输入范围。',
        'Physical dimensions and material properties cannot be negative.':
          '尺寸和材料参数不能为负数。',
        'This parameter must be greater than zero.': '此参数必须大于零。',
        'The result is outside the supported numeric range.':
          '结果超出支持的数值范围。'
      };
      error = english ? message : messages[message] || message;
    }
    const update = (name: string, next: Partial<InputValue>) => {
      setValues((current) => ({
        ...current,
        [name]: { ...current[name], ...next }
      }));
      setCopied(false);
    };
    const changeUnit = (name: string, unit: string) => {
      const current = values[name];
      const value =
        current.value.trim() && Number.isFinite(Number(current.value))
          ? format(Qty(Number(current.value), current.unit).to(unit).scalar)
          : current.value;
      update(name, { unit, value });
    };
    const changeTarget = (name: string) => {
      if (result !== null) update(target, { value: format(result) });
      setTarget(name);
      setCopied(false);
    };
    const choosePreset = (title: string, selection: string) => {
      const preset = data.presets!.find((item) => item.title === title)!;
      setPresets((current) => ({ ...current, [title]: selection }));
      if (selection === '<custom>') return;
      const row = dataTableLookup(preset.source, selection),
        next = { ...values };
      Object.entries(preset.bind).forEach(([name, column]) => {
        next[name] = {
          value: String(row[column]),
          unit: preset.source.columns[column].unit || next[name].unit
        };
      });
      setValues(next);
      setCopied(false);
      if (Object.hasOwn(preset.bind, target)) setTarget(defaultTarget);
    };
    const extras =
      result !== null && data.path === 'cable-voltage-drop'
        ? cableOutputs(canonical)
        : null;
    return (
      <section className="formula-workbench" aria-label={title}>
        <ToolHeaderActions>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setTarget(defaultTarget);
              setValues(initialInputs(data));
              setPresets(
                Object.fromEntries(
                  (data.presets || []).map((preset) => [
                    preset.title,
                    preset.default
                  ])
                )
              );
              setCopied(false);
            }}
          >
            {t('恢复默认', 'Reset')}
          </button>
        </ToolHeaderActions>
        <div className="formula-layout">
          <div className="formula-inputs">
            <label className="formula-target">
              {t('求解目标', 'Solve for')}
              <select
                value={target}
                onChange={(event) => changeTarget(event.target.value)}
              >
                {data.variables
                  .filter((variable) => variable.solvable !== false)
                  .map((variable) => (
                    <option
                      key={variable.name}
                      value={variable.name}
                      disabled={bound(variable.name)}
                    >
                      {uiText(variable.title)} ({variable.name})
                    </option>
                  ))}
              </select>
            </label>
            {!!data.presets?.length && (
              <div className="formula-presets">
                {data.presets.map((preset) => (
                  <label key={preset.title}>
                    {uiText(preset.title)}
                    <select
                      value={presets[preset.title]}
                      onChange={(event) =>
                        choosePreset(preset.title, event.target.value)
                      }
                    >
                      <option value="<custom>">{t('自定义', 'Custom')}</option>
                      {Object.keys(preset.source.data)
                        .sort()
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="formula-variables">
              {data.variables
                .filter((variable) => variable.name !== target)
                .map((variable) => (
                  <div className="formula-variable" key={variable.name}>
                    <label htmlFor={`calc-${variable.name}`}>
                      {uiText(variable.title)} <span>{variable.name}</span>
                    </label>
                    <div className="formula-value">
                      <input
                        id={`calc-${variable.name}`}
                        type="number"
                        step="any"
                        value={values[variable.name].value}
                        disabled={bound(variable.name)}
                        onChange={(event) =>
                          update(variable.name, { value: event.target.value })
                        }
                      />
                      <select
                        aria-label={`${uiText(variable.title)} ${t('单位', 'unit')}`}
                        value={values[variable.name].unit}
                        disabled={bound(variable.name)}
                        onChange={(event) =>
                          changeUnit(variable.name, event.target.value)
                        }
                      >
                        {(units[variable.unit] || [variable.unit]).map(
                          (unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    {bound(variable.name) && (
                      <small>
                        {t(
                          '由上方预设提供；选择「自定义」可修改。',
                          'From the selected preset. Choose Custom to edit.'
                        )}
                      </small>
                    )}
                    {variable.alternates?.some(
                      (alt) => alt.title === 'Diameter'
                    ) && (
                      <label className="formula-alternate">
                        {t('或输入直径', 'Or enter diameter')}
                        <input
                          type="number"
                          step="any"
                          value={
                            values[variable.name].value.trim()
                              ? format(Number(values[variable.name].value) * 2)
                              : ''
                          }
                          onChange={(event) =>
                            update(variable.name, {
                              value: event.target.value
                                ? String(Number(event.target.value) / 2)
                                : ''
                            })
                          }
                        />
                        <span>{values[variable.name].unit}</span>
                      </label>
                    )}
                  </div>
                ))}
            </div>
          </div>
          <aside className="formula-result">
            <p>
              {uiText(output.title)} · {target}
            </p>
            <output aria-live="polite" data-testid="calculation-result">
              {result === null ? '—' : format(result)}
            </output>
            <label>
              {t('结果单位', 'Result unit')}
              <select
                value={values[target].unit}
                onChange={(event) => changeUnit(target, event.target.value)}
              >
                {(units[output.unit] || [output.unit]).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="formula-error" role="status">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={result === null}
              onClick={async () => {
                if (result !== null) {
                  try {
                    await navigator.clipboard.writeText(
                      `${format(result)} ${values[target].unit}`
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }
              }}
            >
              {copied ? t('已复制', 'Copied') : t('复制结果', 'Copy result')}
            </button>
            <div className="formula-equation">
              <span>{t('计算公式', 'Formula')}</span>
              <code>{formulaLabels[data.path]}</code>
            </div>
            {extras && (
              <dl>
                <div>
                  <dt>{t('总电阻', 'Total resistance')}</dt>
                  <dd>{format(extras.resistance)} Ω</dd>
                </div>
                <div>
                  <dt>{t('总耗散功率', 'Total power dissipated')}</dt>
                  <dd>{format(extras.power)} W</dd>
                </div>
              </dl>
            )}
          </aside>
        </div>
      </section>
    );
  };
}
