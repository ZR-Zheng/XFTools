import { clamp, clipGain, type Asset, type Entry, type Range } from './project';

interface Channel {
  audio: HTMLAudioElement;
  gain: GainNode;
  url: string;
  clip: string;
  pending: boolean;
  generation: number;
}

interface Playback {
  entries: Entry[];
  mix?: Entry;
  assets: Map<string, Asset>;
  position: number;
  range: Range;
  repeat: boolean;
  onTime: (time: number) => void;
  onStop: (error?: string) => void;
}

export class AudioPreview {
  private context?: AudioContext;
  private channels: Channel[] = [];
  private frame = 0;
  private run = 0;

  stop() {
    this.run++;
    cancelAnimationFrame(this.frame);
    for (const channel of this.channels) {
      channel.audio.pause();
      channel.clip = '';
      channel.pending = false;
      channel.generation++;
    }
  }

  destroy() {
    this.stop();
    for (const channel of this.channels) {
      channel.audio.removeAttribute('src');
      channel.audio.load();
      channel.gain.disconnect();
    }
    this.channels = [];
    if (this.context && this.context.state !== 'closed')
      void this.context.close().catch(() => {});
    this.context = undefined;
  }

  async play(options: Playback) {
    this.stop();
    const run = this.run;
    const context = (this.context ??= new AudioContext());
    if (!this.channels.length) {
      this.channels = [0, 1].map(() => {
        const audio = new Audio();
        audio.preload = 'auto';
        const gain = context.createGain();
        context
          .createMediaElementSource(audio)
          .connect(gain)
          .connect(context.destination);
        return {
          audio,
          gain,
          url: '',
          clip: '',
          pending: false,
          generation: 0
        };
      });
    }
    await context.resume();
    if (run !== this.run) return;
    const [primary, backing] = this.channels;
    let cursor = options.position;
    let last = context.currentTime;
    let lastUpdate = -Infinity;
    let mainIndex = Math.max(
      0,
      options.entries.findIndex((entry) => entry.end > cursor)
    );
    const finish = (error?: string) => {
      if (run !== this.run) return;
      this.stop();
      options.onStop(error);
    };

    const tune = (
      channel: Channel,
      entry: Entry | undefined,
      time: number,
      now: number
    ) => {
      const asset = entry && options.assets.get(entry.clip.assetId);
      if (
        !entry ||
        !asset?.playable ||
        time < entry.start ||
        time >= entry.end
      ) {
        channel.audio.pause();
        channel.clip = '';
        return true;
      }
      const { audio, gain } = channel;
      if (channel.url !== asset.url) {
        channel.url = asset.url;
        channel.clip = '';
        channel.pending = false;
        channel.generation++;
        audio.src = asset.url;
        audio.onended = null;
      }
      if (audio.error) {
        finish('当前片段无法试听。');
        return false;
      }
      if (audio.readyState < 2) return false;
      const clip = entry.clip;
      const elapsed = time - entry.start;
      const target = clamp(
        clip.inPoint + elapsed * clip.speed,
        clip.inPoint,
        clip.outPoint
      );
      if (
        clip.id !== channel.clip ||
        Math.abs(audio.currentTime - target) > 0.12
      ) {
        channel.clip = clip.id;
        audio.currentTime = Math.max(
          0,
          Math.min(target, clip.outPoint - 0.001)
        );
      }
      audio.playbackRate = clip.speed;
      audio.preservesPitch = true;
      gain.gain.setTargetAtTime(clipGain(clip, elapsed), now, 0.008);
      if (audio.paused && !channel.pending) {
        channel.pending = true;
        const generation = channel.generation;
        void audio
          .play()
          .catch((error) => {
            if (
              run === this.run &&
              generation === channel.generation &&
              error?.name !== 'AbortError'
            )
              finish('无法开始试听，请检查浏览器的音频播放权限。');
          })
          .finally(() => {
            if (generation === channel.generation) channel.pending = false;
          });
      }
      return !audio.seeking;
    };

    const tick = () => {
      if (run !== this.run) return;
      const now = context.currentTime;
      const delta = Math.min(now - last, 0.25);
      last = now;
      if (cursor >= options.range.end) {
        if (!options.repeat) {
          options.onTime(options.range.end);
          finish();
          return;
        }
        cursor = options.range.start;
        mainIndex = Math.max(
          0,
          options.entries.findIndex((entry) => entry.end > cursor)
        );
        primary.clip = backing.clip = '';
      }
      while (
        mainIndex < options.entries.length &&
        options.entries[mainIndex].end <= cursor
      )
        mainIndex++;
      const entry = options.entries[mainIndex];
      const primaryReady = tune(primary, entry, cursor, now);
      const backingReady =
        primaryReady && tune(backing, options.mix, cursor, now);
      if (primaryReady && (entry || backingReady)) {
        cursor = Math.min(cursor + delta, options.range.end);
      } else {
        // A decoder still opening at a cut should not consume the next clip.
        if (!primaryReady) {
          backing.audio.pause();
          backing.clip = '';
        }
      }
      if (now - lastUpdate >= 1 / 30) {
        lastUpdate = now;
        options.onTime(cursor);
      }
      if (run === this.run) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
