export const compressionPresets = {
  low: { maxSide: 2800, imageQuality: 86 },
  medium: { maxSide: 1900, imageQuality: 73 },
  high: { maxSide: 1200, imageQuality: 58 }
};

export type CompressionOptions = {
  compressionLevel: keyof typeof compressionPresets | 'lossless' | 'custom';
  imageEncoding: 'auto' | 'jpeg' | 'jp2';
  imageQuality: number;
  maxSide: number;
  grayscale: boolean;
};

export const defaultCompression: CompressionOptions = {
  compressionLevel: 'medium',
  imageEncoding: 'auto',
  ...compressionPresets.medium,
  grayscale: false
};
