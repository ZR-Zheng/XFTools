import type { ImageJob } from '../../image-job';

const defaultModelPath =
  'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

async function getModelPath(signal?: AbortSignal) {
  const configured =
    import.meta.env.VITE_BACKGROUND_REMOVAL_PUBLIC_PATH?.trim();
  const base = new URL(import.meta.env.BASE_URL, self.location.origin);
  const url = new URL(
    configured ? configured.replace(/\/?$/, '/') : defaultModelPath,
    base
  );
  const request = new AbortController();
  const abort = () => request.abort(signal?.reason);
  signal?.throwIfAborted();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => request.abort(), 8_000);
  try {
    const response = await fetch(new URL('resources.json', url), {
      signal: request.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    return url.href;
  } catch (cause) {
    signal?.throwIfAborted();
    throw new Error('无法下载 AI 去背景模型清单。', { cause });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function removeImageBackground(
  file: File,
  { signal, report }: ImageJob = {}
): Promise<File> {
  report?.('正在连接 AI 去背景模型…');
  const publicPath = await getModelPath(signal);
  let input: Blob = file;
  if (/^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { heicTo } = await import('heic-to');
    input = await heicTo({ blob: file, type: 'image/png' });
  }
  const { removeBackground } = await import('@imgly/background-removal');
  signal?.throwIfAborted();
  const blob = await removeBackground(input, {
    publicPath,
    output: { format: 'image/png' },
    fetchArgs: { signal },
    progress: (key, loaded, total) =>
      report?.(
        key.startsWith('fetch') ? '正在下载去背景资源…' : '正在分离前景和背景…',
        total > 0 ? loaded / total : undefined
      )
  });
  signal?.throwIfAborted();
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-no-bg.png', {
    type: 'image/png'
  });
}
