import { useEffect, useState } from 'react';
import { ToolComponentProps } from '@tools/defineTool';
import { useWorkbenchText } from '../../../../i18n/workbench';

export default function BcryptWorkbench(_props: ToolComponentProps) {
  const { english } = useWorkbenchText();
  const [mode, setMode] = useState<'hash' | 'verify'>('hash');
  const [input, setInput] = useState(''),
    [hash, setHash] = useState('');
  const [rounds, setRounds] = useState(10),
    [show, setShow] = useState(false);
  const [result, setResult] = useState(''),
    [matched, setMatched] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    setResult('');
    setMatched(null);
    setError('');
    setCopied(false);
  }, [input, hash, rounds, mode]);
  const run = async () => {
    setBusy(true);
    setError('');
    setMatched(null);
    try {
      const bcrypt = await import('bcryptjs');
      if (mode === 'hash') {
        if (!Number.isInteger(rounds) || rounds < 4 || rounds > 12)
          throw new Error(
            english
              ? 'Cost must be an integer from 4 to 12.'
              : '成本系数应为 4–12 的整数。'
          );
        setResult(await bcrypt.hash(input, rounds));
      } else {
        if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash.trim()))
          throw new Error(
            english
              ? 'Enter a valid bcrypt hash.'
              : '请输入有效的 bcrypt 哈希。'
          );
        setMatched(await bcrypt.compare(input, hash.trim()));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="specialized-workbench bcrypt-workbench">
      <div className="workbench-tabs" role="tablist" aria-label="bcrypt">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'hash'}
          disabled={busy}
          onClick={() => setMode('hash')}
        >
          {english ? 'Generate hash' : '生成哈希'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'verify'}
          disabled={busy}
          onClick={() => setMode('verify')}
        >
          {english ? 'Verify password' : '验证密码'}
        </button>
      </div>
      <form
        className="specialized-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {english ? 'Password / text' : '密码或文本'}
            <input
              aria-label={english ? 'Password / text' : '密码或文本'}
              type={show ? 'text' : 'password'}
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
            {english ? 'Show password' : '显示密码'}
          </label>
          {mode === 'hash' ? (
            <label>
              {english ? 'Cost factor' : '成本系数'}
              <input
                type="number"
                aria-label={english ? 'Cost factor' : '成本系数'}
                min="4"
                max="12"
                value={rounds}
                onChange={(e) => setRounds(e.target.valueAsNumber)}
              />
              <small>
                {english
                  ? 'Higher values take longer. The salt is generated automatically.'
                  : '数值越大，计算耗时越长；盐值会自动随机生成。'}
              </small>
            </label>
          ) : (
            <label>
              {english ? 'bcrypt hash' : 'bcrypt 哈希'}
              <textarea
                rows={3}
                value={hash}
                placeholder="$2b$10$…"
                onChange={(e) => setHash(e.target.value)}
              />
            </label>
          )}
        </fieldset>
        <button
          className="primary-button"
          type="submit"
          disabled={busy || !input || (mode === 'verify' && !hash)}
        >
          {busy
            ? english
              ? 'Processing…'
              : '正在处理…'
            : mode === 'hash'
              ? english
                ? 'Generate hash'
                : '生成哈希'
              : english
                ? 'Verify password'
                : '验证密码'}
        </button>
      </form>
      <div className="specialized-result" aria-live="polite">
        {error && (
          <p role="alert" className="tool-inline-error">
            {error}
          </p>
        )}
        {result && mode === 'hash' && (
          <>
            <h2>{english ? 'bcrypt hash' : 'bcrypt 哈希'}</h2>
            <textarea
              rows={3}
              readOnly
              aria-label={english ? 'Generated hash' : '生成的哈希'}
              value={result}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(result)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setError(
                      english
                        ? 'Copy failed. Select and copy the hash.'
                        : '复制失败，请选中哈希后手动复制。'
                    )
                  );
              }}
            >
              {copied
                ? english
                  ? 'Copied'
                  : '已复制'
                : english
                  ? 'Copy hash'
                  : '复制哈希'}
            </button>
          </>
        )}
        {matched !== null && (
          <p
            className={`bcrypt-match ${matched ? 'success' : 'error'}`}
            role="status"
          >
            {matched
              ? english
                ? 'Password matches'
                : '密码匹配'
              : english
                ? 'Password does not match'
                : '密码不匹配'}
          </p>
        )}
      </div>
    </div>
  );
}
