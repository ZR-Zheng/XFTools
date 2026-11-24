export default function ImageTaskStatus({
  running,
  message,
  progress,
  error,
  cancel
}: {
  running?: boolean;
  message?: string;
  progress?: number;
  error?: string;
  cancel: () => void;
}) {
  return (
    <>
      {running && (
        <div className="iw-task-status">
          <span role="status">{message}</span>
          <progress aria-label="任务进度" max={1} value={progress} />
          <button type="button" onClick={cancel}>
            取消任务
          </button>
        </div>
      )}
      {error && (
        <p className="iw-alert" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
