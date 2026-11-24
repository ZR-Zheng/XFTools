import createCodec from '@cornerstonejs/codec-openjpeg/wasmjs';
import wasmUrl from '@cornerstonejs/codec-openjpeg/wasm?url';

let codec: ReturnType<typeof createCodec> | undefined;

function wrapJp2(
  codestream: Uint8Array,
  width: number,
  height: number,
  grayscale: boolean
) {
  const channels = grayscale ? 1 : 3;
  const output = new Uint8Array(85 + codestream.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, 12);
  view.setUint32(4, 0x6a502020); // Signature box
  view.setUint32(8, 0x0d0a870a);
  view.setUint32(12, 20);
  view.setUint32(16, 0x66747970); // ftyp
  view.setUint32(20, 0x6a703220); // jp2
  view.setUint32(28, 0x6a703220);
  view.setUint32(32, 45);
  view.setUint32(36, 0x6a703268); // jp2h
  view.setUint32(40, 22);
  view.setUint32(44, 0x69686472); // ihdr
  view.setUint32(48, height);
  view.setUint32(52, width);
  view.setUint16(56, channels);
  output.set([7, 7, 0, 0], 58); // 8-bit samples, JPEG 2000 compression
  view.setUint32(62, 15);
  view.setUint32(66, 0x636f6c72); // colr
  output[70] = 1; // Enumerated color space
  view.setUint32(73, grayscale ? 17 : 16);
  view.setUint32(77, codestream.length + 8);
  view.setUint32(81, 0x6a703263); // jp2c
  output.set(codestream, 85);
  return output;
}

export async function encodeJpeg2000(
  image: ImageData,
  grayscale: boolean,
  quality: number
) {
  const { width, height, data } = image;
  codec ??= createCodec({
    locateFile: () => new URL(wasmUrl, self.location.href).href
  }).catch((error: unknown) => {
    codec = undefined;
    throw error;
  });
  const { J2KEncoder } = await codec;
  const encoder = new J2KEncoder();
  try {
    const pixels = encoder.getDecodedBuffer({
      width,
      height,
      bitsPerSample: 8,
      componentCount: grayscale ? 1 : 3,
      isSigned: false
    });
    for (let i = 0, j = 0; i < data.length; i += 4) {
      pixels[j++] = data[i];
      if (!grayscale) {
        pixels[j++] = data[i + 1];
        pixels[j++] = data[i + 2];
      }
    }
    encoder.setDecompositions(
      Math.min(5, Math.floor(Math.log2(Math.min(width, height))))
    );
    encoder.setQuality(quality === 1, 1);
    encoder.setCompressionRatio(0, 1 + 30 * (1 - quality));
    encoder.encode();
    const encoded = encoder.getEncodedBuffer();
    if (encoded[0] !== 0xff || encoded[1] !== 0x4f)
      throw new Error('JPEG 2000 编码失败。');
    return wrapJp2(encoded, width, height, grayscale);
  } finally {
    encoder.delete();
  }
}
