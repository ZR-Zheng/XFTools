export type ImageJob = {
  signal?: AbortSignal;
  report?: (message: string, fraction?: number) => void;
};
