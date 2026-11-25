import { useEffect, useRef } from 'react';
import Glyph from '@components/workbench/Glyph';
import {
  animationPose,
  paintMask,
  previewFilter,
  type VideoMask
} from './effects';
import type { Framing } from './templates';
import { openGifPreview } from './gif-preview';
import { loadStill } from './media';
import {
  cropRect,
  clipDuration,
  editedSize,
  sourceTime,
  type Asset,
  type PositionedClip,
  type Soundtrack
} from './timeline';

interface Props {
  asset: Asset;
  entry: PositionedClip;
  frame: { width: number; height: number };
  framing: Framing;
  transparent: boolean;
  time: number;
  duration: number;
  playing: boolean;
  soundtrack: Soundtrack | null;
  audioAsset?: Asset;
  onTime: (value: number) => void;
  onStop: () => void;
  onError: (message: string) => void;
}

export default function VideoMonitor(props: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const maskRaster = useRef<{ mask: VideoMask; canvas: HTMLCanvasElement }>(
    null
  );
  const still = useRef<{
    assetId: string;
    source: HTMLImageElement | ImageBitmap;
  }>(null);
  const gif = useRef<ReturnType<typeof openGifPreview>>(null);
  const lastUpdate = useRef(0);
  const imageClock = useRef<{
    clipId: string;
    started: number;
    position: number;
  }>(null);
  const latest = useRef(props);
  latest.current = props;
  const {
    entry,
    asset,
    frame,
    framing,
    transparent,
    playing,
    time,
    duration,
    soundtrack,
    audioAsset
  } = props;
  const factor = Math.min(1, 960 / Math.max(frame.width, frame.height));
  const width = Math.max(1, Math.round(frame.width * factor));
  const height = Math.max(1, Math.round(frame.height * factor));

  function draw() {
    const media = video.current;
    const surface = canvas.current;
    if (!surface) return;
    const context = surface.getContext('2d');
    if (!context) return;
    const { asset, entry, framing, transparent, time, playing } =
      latest.current;
    const scene =
      asset.kind === 'video'
        ? media && media.readyState >= 2
          ? media
          : undefined
        : still.current?.assetId === asset.id
          ? still.current.source
          : undefined;
    if (!scene) return;
    const { clip } = entry;
    const rect = cropRect(asset, clip);
    const sx = scene instanceof ImageBitmap ? scene.width / asset.width : 1;
    const sy = scene instanceof ImageBitmap ? scene.height / asset.height : 1;
    const size = editedSize(asset, clip);
    const resize = framing === 'cover' ? Math.max : Math.min;
    const scale = resize(
      surface.width / size.width,
      surface.height / size.height
    );
    const elapsed =
      media && playing
        ? (media.currentTime - clip.inPoint) / clip.speed
        : time - entry.start;
    const pose = animationPose(clip.animation, elapsed, clipDuration(clip));
    const dx = pose.x * surface.width;
    const dy = pose.y * surface.height;
    context.clearRect(0, 0, surface.width, surface.height);
    context.save();
    if (dx || dy) {
      context.translate(dx, dy);
      context.beginPath();
      context.rect(0, 0, surface.width, surface.height);
      context.clip();
    }
    context.globalAlpha = pose.opacity;
    const filter = previewFilter(clip.filter);
    if ('filter' in CanvasRenderingContext2D.prototype) context.filter = filter;
    else surface.style.filter = filter;
    context.translate(surface.width / 2, surface.height / 2);
    context.scale(clip.flipX ? -1 : 1, clip.flipY ? -1 : 1);
    context.rotate((clip.rotation * Math.PI) / 180);
    context.drawImage(
      scene,
      rect.x * sx,
      rect.y * sy,
      rect.width * sx,
      rect.height * sy,
      (-rect.width * scale) / 2,
      (-rect.height * scale) / 2,
      rect.width * scale,
      rect.height * scale
    );
    context.restore();

    if (clip.mask) {
      const layer =
        maskRaster.current?.canvas ?? document.createElement('canvas');
      if (
        maskRaster.current?.mask !== clip.mask ||
        layer.width !== surface.width ||
        layer.height !== surface.height
      ) {
        paintMask(layer, clip.mask, surface.width, surface.height);
        maskRaster.current = { mask: clip.mask, canvas: layer };
      }
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(layer, dx, dy);
    } else if (maskRaster.current) {
      maskRaster.current.canvas.width = maskRaster.current.canvas.height = 0;
      maskRaster.current = null;
    }
    if (!transparent) {
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#000';
      context.fillRect(0, 0, surface.width, surface.height);
    }
    context.globalCompositeOperation = 'source-over';
  }

  function releaseStill() {
    const source = still.current?.source;
    if (source instanceof ImageBitmap) source.close();
    else source?.removeAttribute('src');
    still.current = null;
  }

  useEffect(() => {
    if (asset.kind !== 'image' && asset.kind !== 'gif') return;
    const controller = new AbortController();
    function fail() {
      if (controller.signal.aborted) return;
      latest.current.onStop();
      latest.current.onError('预览无法解码 ' + asset.file.name + '。');
    }
    if (asset.kind === 'gif') {
      try {
        gif.current = openGifPreview(
          asset.file,
          (source) => {
            releaseStill();
            still.current = { assetId: asset.id, source };
            draw();
          },
          fail
        );
        gif.current.seek(sourceTime(latest.current.entry, latest.current.time));
      } catch {
        fail();
      }
    } else {
      void loadStill(asset.url, controller.signal)
        .then((source) => {
          if (controller.signal.aborted) {
            source.removeAttribute('src');
            return;
          }
          still.current = { assetId: asset.id, source };
          draw();
        })
        .catch(fail);
    }
    return () => {
      controller.abort();
      gif.current?.close();
      gif.current = null;
      releaseStill();
    };
  }, [asset]);

  function syncVideo(force = false) {
    const media = video.current;
    if (!media || !media.readyState) return;
    const { entry, time, playing, soundtrack, duration } = latest.current;
    const wanted = sourceTime(entry, time);
    if (
      force ||
      Math.abs(media.currentTime - wanted) > (playing ? 0.15 : 0.012)
    ) {
      media.currentTime = Math.min(
        wanted,
        Math.max(0, entry.clip.outPoint - 0.001)
      );
    }
    media.playbackRate = entry.clip.speed;
    media.volume =
      soundtrack?.replace && soundtrack.offset < duration
        ? 0
        : entry.clip.volume;
  }

  function startVideo() {
    const media = video.current;
    if (!media) return;
    void media.play().catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (media !== video.current || !latest.current.playing) return;
      latest.current.onStop();
      latest.current.onError('预览无法播放，请重新点击播放或检查文件编码。');
    });
  }

  useEffect(() => {
    syncVideo();
    draw();
  }, [entry.clip, soundtrack, duration, width, height, framing, transparent]);

  useEffect(() => {
    if (asset.kind === 'gif') gif.current?.seek(sourceTime(entry, time));
    if (asset.kind !== 'video' && entry.clip.animation) draw();
    if (asset.kind === 'video' && !playing) {
      syncVideo();
      draw();
    }
  }, [asset, entry, time, playing]);

  useEffect(() => {
    imageClock.current = null;
    lastUpdate.current = 0;
    const media = video.current;
    if (!media) return;
    if (playing) startVideo();
    else media.pause();
    return () => media.pause();
  }, [playing, entry.clip.id]);

  useEffect(() => {
    const media = audio.current;
    if (!media) return;
    const elapsed = time - (soundtrack?.offset ?? 0);
    const length = soundtrack ? soundtrack.end - soundtrack.start : 0;
    if (
      !soundtrack ||
      elapsed < 0 ||
      (!soundtrack.loop && elapsed >= length) ||
      length <= 0
    ) {
      media.pause();
      return;
    }
    const wanted = soundtrack.start + (elapsed % length);
    media.volume = soundtrack.volume;
    if (
      media.readyState &&
      Math.abs(media.currentTime - wanted) > (playing ? 0.15 : 0.025)
    )
      media.currentTime = wanted;
    if (playing && media.paused) void media.play().catch(() => {});
    if (!playing) media.pause();
  }, [audioAsset, playing, soundtrack, time]);

  function advance() {
    const media = video.current;
    const state = latest.current;
    if (!state.playing) return;
    const now = performance.now();
    const { clip, start, end } = state.entry;
    if (state.asset.kind !== 'video') {
      if (still.current?.assetId !== state.asset.id) return;
      if (imageClock.current?.clipId !== clip.id)
        imageClock.current = {
          clipId: clip.id,
          started: now,
          position: state.time
        };
      const next =
        imageClock.current.position + (now - imageClock.current.started) / 1000;
      if (next >= end || now - lastUpdate.current >= 1000 / 30) {
        lastUpdate.current = now;
        state.onTime(Math.min(end, next));
      }
      if (next >= state.duration) state.onStop();
      return;
    }
    if (!media || media.seeking || media.readyState < 2) return;
    if (media.ended || media.currentTime >= clip.outPoint - 0.002) {
      media.pause();
      state.onTime(end);
      if (end >= state.duration) state.onStop();
    } else if (now - lastUpdate.current >= 1000 / 30) {
      lastUpdate.current = now;
      state.onTime(
        start + Math.max(0, media.currentTime - clip.inPoint) / clip.speed
      );
      if (typeof media.requestVideoFrameCallback !== 'function') draw();
    }
  }

  useEffect(() => {
    if (!playing) return;
    let id: number;
    const next = () => {
      advance();
      id = requestAnimationFrame(next);
    };
    id = requestAnimationFrame(next);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  useEffect(() => {
    const media = video.current;
    if (
      !playing ||
      !media ||
      typeof media.requestVideoFrameCallback !== 'function'
    )
      return;
    let id: number;
    let lastPaint = -Infinity;
    const next = (timestamp: number) => {
      if (timestamp - lastPaint >= 1000 / 32) {
        draw();
        lastPaint = timestamp;
      }
      id = media.requestVideoFrameCallback(next);
    };
    id = media.requestVideoFrameCallback(next);
    return () => media.cancelVideoFrameCallback(id);
  }, [playing, entry.clip.id, asset.kind]);

  return (
    <>
      <canvas
        ref={canvas}
        width={width}
        height={height}
        aria-label="时间线画面"
      />
      {asset.kind === 'video' && (
        <video
          key={entry.clip.id}
          className="vw-decode"
          ref={video}
          src={asset.url}
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedMetadata={() => {
            syncVideo(true);
            if (latest.current.playing) startVideo();
          }}
          onSeeked={draw}
          onLoadedData={draw}
          onEnded={advance}
        />
      )}
      {audioAsset && (
        <audio
          ref={audio}
          src={audioAsset.url}
          preload="auto"
          aria-hidden="true"
        />
      )}
    </>
  );
}

export function EmptyMonitor({ onImport }: { onImport: () => void }) {
  return (
    <button type="button" className="vw-empty" onClick={onImport}>
      <span>
        <Glyph name="video" size={27} />
      </span>
      <strong>拖放视频或图片，开始剪辑</strong>
      <small>或点击导入 MP4、WebM、GIF、PNG 等素材</small>
    </button>
  );
}
