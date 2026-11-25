import { useContext, type ReactNode } from 'react';
import Glyph from '@components/workbench/Glyph';
import { CustomSnackBarContext } from 'contexts/CustomSnackBarContext';

export function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="datecalc-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function CopyResult({
  value,
  label = '复制结果'
}: {
  value: string;
  label?: string;
}) {
  const { showSnackBar } = useContext(CustomSnackBarContext);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showSnackBar('已复制结果', 'success');
    } catch {
      showSnackBar('无法复制，请选中结果手动复制。', 'error');
    }
  }
  return (
    <button
      className="secondary-button datecalc-copy"
      type="button"
      disabled={!value}
      onClick={() => void copy()}
    >
      <Glyph name="copy" size={15} /> {label}
    </button>
  );
}

export type ResultData = {
  value: string;
  unit?: string;
  rows?: readonly (readonly [string, string])[];
  notes?: string;
  copy?: string;
};

export function Result({ data, error }: { data?: ResultData; error?: string }) {
  return (
    <section className="datecalc-card datecalc-result" aria-label="计算结果">
      <div className="datecalc-result-heading">
        <h2>计算结果</h2>
        <CopyResult
          value={
            data?.copy ??
            (data
              ? [
                  data.value + (data.unit ?? ''),
                  ...(data.rows ?? []).map(
                    ([label, value]) => `${label} ${value}`
                  )
                ].join('\n')
              : '')
          }
        />
      </div>
      <div aria-live="polite" className="datecalc-result-body">
        {error && (
          <p className="tool-inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="datecalc-result-number">
          <output aria-label="计算结果值">{data?.value ?? '—'}</output>
          {data?.unit && <span>{data.unit}</span>}
        </div>
        {data?.rows && (
          <dl className="datecalc-result-rows">
            {data.rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {data?.notes && <p className="datecalc-note">{data.notes}</p>}
      </div>
    </section>
  );
}

export function ModeGrid({
  children,
  data,
  error
}: {
  children: ReactNode;
  data?: ResultData;
  error?: string;
}) {
  return (
    <div className="datecalc-panes">
      <section className="datecalc-card datecalc-fields">{children}</section>
      <Result data={data} error={error} />
    </div>
  );
}
