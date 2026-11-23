import type { InitialValuesType } from './types';
import type { SecurityRequest, SecurityResponse } from './security.worker';

async function processSecurity(
  file: File,
  mode: SecurityRequest['mode'],
  password: string,
  signal?: AbortSignal
) {
  if (!password) throw new Error('请输入 PDF 密码。');
  if (password.includes('\0')) throw new Error('密码包含无效字符。');
  const data = await file.arrayBuffer();
  signal?.throwIfAborted();
  const worker = new Worker(new URL('./security.worker.ts', import.meta.url), {
    type: 'module'
  });
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const abort = () => finish(() => reject(signal?.reason));
    const timeout = setTimeout(
      () => finish(() => reject(new Error('PDF 密码处理超时，请重试。'))),
      45_000
    );
    const finish = (settle: () => void) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      settle();
    };
    worker.onmessage = ({ data }: MessageEvent<SecurityResponse>) =>
      finish(() => {
        if ('bytes' in data) resolve(data.bytes);
        else reject(new Error(data.error));
      });
    worker.onerror = worker.onmessageerror = () =>
      finish(() => reject(new Error('PDF 密码处理引擎启动失败。')));
    signal?.addEventListener('abort', abort, { once: true });
    try {
      worker.postMessage(
        { mode, bytes: data, password } satisfies SecurityRequest,
        [data]
      );
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export async function protectPdf(
  file: File,
  { password, confirmPassword }: InitialValuesType,
  signal?: AbortSignal
) {
  if (password !== confirmPassword) throw new Error('两次输入的密码不一致。');
  if (new TextEncoder().encode(password).length > 127)
    throw new Error('密码的 UTF-8 长度不能超过 127 字节。');
  const bytes = await processSecurity(file, 'protect', password, signal);
  return new File(
    [bytes],
    `${file.name.replace(/\.pdf$/i, '')}-protected.pdf`,
    { type: 'application/pdf' }
  );
}

export async function unlockPdf(
  file: File,
  password: string,
  signal?: AbortSignal
) {
  const bytes = await processSecurity(file, 'unlock', password, signal);
  return new File([bytes], file.name, { type: 'application/pdf' });
}
