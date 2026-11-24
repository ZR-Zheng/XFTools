import { useEffect, useRef, useState } from 'react';
import type { ImageJob } from '../image-job';

type TaskState<T> = {
  scope: object;
  running: boolean;
  message: string;
  progress?: number;
  result?: T;
  error?: string;
};

export default function useImageTask<T>(scope: object | null) {
  const running = useRef<AbortController | null>(null);
  const [state, setState] = useState<TaskState<T>>();
  useEffect(
    () => () => {
      running.current?.abort();
      running.current = null;
    },
    [scope]
  );

  const current = state?.scope === scope ? state : undefined;
  const cancel = () => {
    running.current?.abort();
    running.current = null;
    setState(undefined);
  };
  const run = async (work: (job: ImageJob) => Promise<T>) => {
    if (!scope || running.current) return;
    const controller = new AbortController();
    running.current = controller;
    const report = (message: string, progress?: number) => {
      if (running.current === controller)
        setState({ scope, running: true, message, progress });
    };
    report('正在读取当前编辑结果…');
    try {
      const result = await work({ signal: controller.signal, report });
      if (running.current === controller)
        setState({ scope, running: false, message: '', result });
    } catch (failure) {
      if (running.current === controller)
        setState({
          scope,
          running: false,
          message: '',
          error: failure instanceof Error ? failure.message : '图片处理失败。'
        });
    } finally {
      if (running.current === controller) running.current = null;
    }
  };
  return { ...current, run, cancel };
}
