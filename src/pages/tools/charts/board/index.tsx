import { useEffect, useState } from 'react';
import './chart-board.css';

const boardDocument = `${import.meta.env.BASE_URL}line-chart-assistant/index.html`;
type FrameSource = { src: string } | { srcDoc: string };

async function loadBoard(signal: AbortSignal): Promise<FrameSource> {
  const url = new URL(boardDocument, window.location.href);
  const response = await fetch(url, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error('Missing chart board index');

  const entry = new DOMParser().parseFromString(
    await response.text(),
    'text/html'
  );
  if (!entry.querySelector('script[type="module"][src]')) {
    throw new Error('Missing chart board module');
  }
  const scripts = entry.querySelectorAll('script[src^="/assets/"]');
  const links = entry.querySelectorAll('link[href^="/assets/"]');
  if (!scripts.length && !links.length) return { src: url.href };

  // The supplied Vite build points at /assets. Resolve those entry tags inside its own folder.
  const base = entry.createElement('base');
  base.href = new URL('./', url).href;
  entry.head.prepend(base);
  for (const script of scripts) {
    script.setAttribute('src', `.${script.getAttribute('src')}`);
  }
  for (const link of links) {
    link.setAttribute('href', `.${link.getAttribute('href')}`);
  }
  return { srcDoc: `<!doctype html>\n${entry.documentElement.outerHTML}` };
}

export default function ChartBoard({ title }: { title: string }) {
  const [source, setSource] = useState<FrameSource>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void loadBoard(controller.signal).then(
      (entry) => {
        if (!controller.signal.aborted) setSource(entry);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      }
    );
    return () => controller.abort();
  }, []);

  if (!source)
    return (
      <p className="chart-board-status" role={failed ? 'alert' : 'status'}>
        {failed
          ? '无法加载统计图画板，请检查构建文件是否完整。'
          : '正在加载统计图画板…'}
      </p>
    );

  return <iframe {...source} title={title} className="chart-board-frame" />;
}
