declare module '@cornerstonejs/codec-openjpeg/wasmjs' {
  type Encoder = {
    getDecodedBuffer(frame: {
      width: number;
      height: number;
      bitsPerSample: 8;
      componentCount: 1 | 3;
      isSigned: false;
    }): Uint8Array;
    setDecompositions(levels: number): void;
    setQuality(lossless: boolean, layers: number): void;
    setCompressionRatio(layer: number, ratio: number): void;
    encode(): void;
    getEncodedBuffer(): Uint8Array;
    delete(): void;
  };
  export default function createCodec(settings: {
    locateFile: (path: string) => string;
  }): Promise<{ J2KEncoder: new () => Encoder }>;
}
