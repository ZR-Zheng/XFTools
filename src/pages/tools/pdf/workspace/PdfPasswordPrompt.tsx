import { useEffect, useRef, useState } from 'react';

export default function PdfPasswordPrompt({
  file,
  busy,
  error,
  onUnlock,
  onClose,
  t
}: {
  file: File;
  busy: boolean;
  error: string;
  onUnlock: (password: string) => void;
  onClose: () => void;
  t: (zh: string, en: string) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="pdf-password-dialog"
      ref={dialog}
      aria-labelledby="pdf-password-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (password && !busy) onUnlock(password);
        }}
      >
        <h2 id="pdf-password-title">
          {t('输入 PDF 密码', 'Enter PDF password')}
        </h2>
        <p>{file.name}</p>
        <label className="pdf-output-name">
          {t('PDF 密码', 'PDF password')}
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="pdf-form-note" role="alert">
            {error}
          </p>
        )}
        <div className="pdf-edit-property-actions">
          <button
            type="submit"
            className="pdf-primary"
            disabled={!password || busy}
          >
            {busy
              ? t('正在打开…', 'Opening…')
              : t('解锁并打开', 'Unlock and open')}
          </button>
          <button type="button" onClick={onClose}>
            {t('跳过', 'Skip')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
