export type PdfJob = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};
