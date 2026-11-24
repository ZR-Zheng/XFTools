import { useEffect, useRef, useState } from 'react';
import { downloadFile, getFileExtension } from '@utils/file';
import { fileLimit, groups, resultLimit, type Settings } from './formats';
import { runConversion } from './run';

type Status = 'pending' | 'running' | 'done' | 'error' | 'cancelled';
export type Job = {
  id: string;
  file: File;
  settings: Settings;
  status: Status;
  progress?: number;
  waiting?: boolean;
  output?: File;
  error?: string;
};

function validation(file: File, { group }: Settings) {
  if (!file.size) return '该文件是空的，请重新选择文件。';
  if (file.size > fileLimit)
    return '单文件超过 150 MB，请先缩小或分段后再导入。';
  const extensions: readonly string[] = groups[group].extensions;
  if (extensions.includes(getFileExtension(file.name))) return;
  const compatible =
    group === 'document'
      ? file.type === 'application/pdf'
      : file.type.startsWith(`${group}/`);
  if (!compatible) return '文件与当前分类不匹配。请切换分类后重新添加。';
}

export function useConversionQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [packing, setPacking] = useState(false);
  const [notice, setNotice] = useState('');
  const current = useRef<Job[]>([]);
  const task = useRef<AbortController>(null);
  const archive = useRef<AbortController>(null);

  useEffect(
    () => () => {
      task.current?.abort();
      archive.current?.abort();
      task.current = archive.current = null;
    },
    []
  );

  function update(change: (previous: Job[]) => Job[]) {
    current.current = change(current.current);
    setJobs(current.current);
  }

  function patch(id: string, fields: Partial<Job>) {
    update((jobs) =>
      jobs.map((job) => (job.id === id ? { ...job, ...fields } : job))
    );
  }

  function add(files: File[], settings: Settings) {
    const available = 50 - current.current.length;
    setNotice(
      files.length > available
        ? '队列最多保留 50 项。移除部分任务后可以继续添加。'
        : ''
    );
    const items: Job[] = files.slice(0, available).map((file) => {
      const error = validation(file, settings);
      return {
        id: crypto.randomUUID(),
        file,
        settings,
        status: error ? 'error' : 'pending',
        error
      };
    });
    update((jobs) => [...jobs, ...items]);
  }

  async function start() {
    if (task.current) return;
    const controller = new AbortController();
    task.current = controller;
    const { signal } = controller;
    setNotice('');
    setRunning(true);
    try {
      while (!signal.aborted) {
        const job = current.current.find((item) => item.status === 'pending');
        if (!job) break;
        patch(job.id, {
          status: 'running',
          progress: 0,
          error: undefined,
          waiting: false
        });
        try {
          const retainedBytes = () =>
            current.current.reduce(
              (total, item) => total + (item.output?.size ?? 0),
              0
            );
          const limitMessage =
            '已达到结果暂存上限，请先下载并清理已完成任务，再重试。';
          if (retainedBytes() >= resultLimit * 2) throw new Error(limitMessage);
          const output = await runConversion(
            job.file,
            job.settings,
            signal,
            (value, waiting = false) => {
              if (signal.aborted) return;
              const percent = Math.floor(value);
              const item = current.current.find((item) => item.id === job.id);
              if (percent !== item?.progress || waiting !== item?.waiting)
                patch(job.id, { progress: percent, waiting });
            }
          );
          signal.throwIfAborted();
          if (retainedBytes() + output.size > resultLimit * 2)
            throw new Error(limitMessage);
          patch(job.id, {
            status: 'done',
            output,
            progress: 100,
            waiting: false
          });
        } catch (error) {
          if (task.current !== controller) return;
          if (signal.aborted)
            patch(job.id, { status: 'cancelled', waiting: false });
          else {
            const message = error instanceof Error ? error.message : '';
            patch(job.id, {
              status: 'error',
              waiting: false,
              error: /[\u3400-\u9fff]/.test(message)
                ? message
                : '转换失败，请确认文件完好且可以读取，或尝试其他输出格式。'
            });
          }
        }
      }
    } finally {
      if (task.current === controller) {
        task.current = null;
        setRunning(false);
      }
    }
  }

  async function downloadAll() {
    if (archive.current) return;
    const files = current.current.flatMap((job) =>
      job.output ? [job.output] : []
    );
    if (!files.length) return;
    const controller = new AbortController();
    archive.current = controller;
    setNotice('');
    setPacking(true);
    try {
      const { archiveFiles } = await import('./archive');
      const file = await archiveFiles(
        files,
        'converted-files.zip',
        controller.signal
      );
      downloadFile(file);
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(error instanceof Error ? error.message : '无法打包下载。');
    } finally {
      if (archive.current === controller) {
        archive.current = null;
        setPacking(false);
      }
    }
  }

  return {
    jobs,
    running,
    packing,
    notice,
    add,
    start,
    downloadAll,
    cancel: () => task.current?.abort(),
    remove: (id: string) =>
      update((jobs) =>
        jobs.filter((job) => job.id !== id || job.status === 'running')
      ),
    retry: (id: string) =>
      patch(id, { status: 'pending', error: undefined, progress: undefined }),
    canRetry: (job: Job) => !validation(job.file, job.settings),
    clearCompleted: () =>
      update((jobs) => jobs.filter((job) => job.status !== 'done'))
  };
}
