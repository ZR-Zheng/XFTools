import { InitialValuesType } from './types';
import { runFFmpegTask } from 'lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import JSZip from 'jszip';
import { getResizeDimensions } from './resize-dimensions';

// One shared resampler; loaded only when a raster image is actually processed.
let resampler: Promise<import('pica').Pica> | undefined;
function getResampler() {
  return (resampler ??= import('pica').then(({ default: createPica }) =>
    createPica({ concurrency: 2 })
  ));
}

async function decodeImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const processImage = async (
  file: File,
  options: InitialValuesType
): Promise<File | null> => {
  const {
    width,
    height,
    resizeMethod,
    percentage,
    dimensionType,
    maintainAspectRatio
  } = options;

  if (file.type === 'image/svg+xml') {
    try {
      const fileText = await file.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(fileText, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      const viewBox = svgElement.getAttribute('viewBox');

      const image = await decodeImage(file);
      const originalWidth = image.naturalWidth,
        originalHeight = image.naturalHeight;
      const { width: newWidth, height: newHeight } = getResizeDimensions(
        originalWidth,
        originalHeight,
        options
      );

      svgElement.setAttribute('width', String(newWidth));
      svgElement.setAttribute('height', String(newHeight));

      if (!viewBox) {
        svgElement.setAttribute(
          'viewBox',
          `0 0 ${originalWidth} ${originalHeight}`
        );
      }

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgDoc);

      return new File([svgString], file.name, {
        type: 'image/svg+xml'
      });
    } catch (error) {
      console.error('Error processing SVG:', error);
      return null;
    }
  }

  if (file.type === 'image/gif') {
    try {
      return await runFFmpegTask(async ({ ffmpeg, tempFile }) => {
        const inputName = tempFile('.gif');
        const outputName = tempFile('.gif');

        await ffmpeg.writeFile(inputName, await fetchFile(file));

        let scaleFilter: string;

        if (resizeMethod === 'pixels') {
          if (dimensionType === 'width') {
            const newWidth = parseInt(width);

            scaleFilter = maintainAspectRatio
              ? `scale=${newWidth}:-1`
              : `scale=${newWidth}:${parseInt(height)}`;
          } else {
            const newHeight = parseInt(height);

            scaleFilter = maintainAspectRatio
              ? `scale=-1:${newHeight}`
              : `scale=${parseInt(width)}:${newHeight}`;
          }
        } else {
          const scale = Number(percentage) / 100;
          scaleFilter = `scale='max(1,round(iw*${scale}))':'max(1,round(ih*${scale}))'`;
        }

        await ffmpeg.exec([
          '-i',
          inputName,
          '-vf',
          `${scaleFilter},split[a][b];[a]palettegen[p];[b][p]paletteuse`,
          outputName
        ]);

        const data = await ffmpeg.readFile(outputName);

        return new File([new Uint8Array(data as Uint8Array)], file.name, {
          type: 'image/gif'
        });
      });
    } catch (error) {
      console.error('Error processing GIF with FFmpeg:', error);
      return null;
    }
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    const img = await decodeImage(file);
    const { width: newWidth, height: newHeight } = getResizeDimensions(
      img.naturalWidth,
      img.naturalHeight,
      options
    );

    canvas.width = newWidth;
    canvas.height = newHeight;

    await (await getResampler()).resize(img, canvas);

    const outputType = file.type || 'image/png';

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }

        resolve(
          new File(
            [blob],
            blob.type === file.type
              ? file.name
              : file.name.replace(/\.[^.]+$/, '') +
                  '.' +
                  (blob.type.split('/')[1] || 'png'),
            {
              type: blob.type
            }
          )
        );
      }, outputType);
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return null;
  }
};

export const resizeImages = async (
  files: File[],
  options: InitialValuesType
): Promise<{ results: File[]; zipFile: File | null } | null> => {
  try {
    // Pica already processes tiles in parallel. Keep files sequential so a batch
    // does not hold several full-resolution canvases in memory at once.
    const results: File[] = [];
    for (const file of files) {
      const result = await processImage(file, options);
      if (!result) throw new Error(`Unable to resize ${file.name}`);
      results.push(result);
    }

    if (results.length === 0) {
      return null;
    }

    if (results.length === 1) {
      return {
        results,
        zipFile: null
      };
    }

    const zip = new JSZip();

    const names = new Set<string>();
    results.forEach((file) => {
      const base = file.name.replace(/\.[^.]+$/, ''),
        extension = file.name.slice(base.length);
      let name = file.name,
        count = 2;
      while (names.has(name)) name = `${base}-${count++}${extension}`;
      names.add(name);
      zip.file(name, file);
    });

    const zipBlob = await zip.generateAsync({
      type: 'blob'
    });

    return {
      results,
      zipFile: new File([zipBlob], 'resized-images.zip', {
        type: 'application/zip'
      })
    };
  } catch (error) {
    console.error('Error processing images:', error);
    return null;
  }
};
