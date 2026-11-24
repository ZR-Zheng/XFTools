import type { Asset } from './project';

export const audioTypes = [
  'audio/*',
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.flac',
  '.aif',
  '.aiff',
  '.wma',
  '.webm',
  '.mka'
];

async function durationOf(url: string, signal: AbortSignal) {
  return new Promise<number | undefined>((resolve) => {
    const audio = new Audio();
    function finish(duration?: number) {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      audio.onloadedmetadata = audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      resolve(duration);
    }
    const abort = () => finish();
    const timeout = window.setTimeout(abort, 6000);
    signal.addEventListener('abort', abort, { once: true });
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      finish(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : undefined
      );
    audio.onerror = abort;
    audio.src = url;
  });
}

async function measurePeaks(file: File, duration: number, signal: AbortSignal) {
  if (
    typeof OfflineAudioContext !== 'function' ||
    file.size > 24 * 1024 ** 2 ||
    duration > 480
  )
    return;
  try {
    const context = new OfflineAudioContext(1, 1, 8000);
    const data = await file.arrayBuffer();
    signal.throwIfAborted();
    const decoded = await context.decodeAudioData(data);
    signal.throwIfAborted();
    const count = Math.min(1600, decoded.length);
    const peaks = new Float32Array(count * 2);
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, index) => decoded.getChannelData(index)
    );
    for (let index = 0; index < count; index++) {
      const from = Math.floor((index * decoded.length) / count);
      const to = Math.floor(((index + 1) * decoded.length) / count);
      const step = Math.max(1, Math.floor((to - from) / 64));
      let min = 0;
      let max = 0;
      for (const channel of channels)
        for (let sample = from; sample < to; sample += step) {
          min = Math.min(min, channel[sample]);
          max = Math.max(max, channel[sample]);
        }
      peaks[index * 2] = min;
      peaks[index * 2 + 1] = max;
    }
    return peaks;
  } catch {
    return undefined;
  }
}

export async function openAudio(
  file: File,
  signal: AbortSignal
): Promise<Asset> {
  signal.throwIfAborted();
  const url = URL.createObjectURL(file);
  try {
    const nativeDuration = await durationOf(url, signal);
    signal.throwIfAborted();
    const duration =
      nativeDuration ??
      (await (await import('./engine')).probeAudio(file, signal));
    const peaks = nativeDuration
      ? await measurePeaks(file, duration, signal)
      : undefined;
    signal.throwIfAborted();
    return {
      id: crypto.randomUUID(),
      file,
      url,
      duration,
      playable: nativeDuration !== undefined,
      peaks
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
