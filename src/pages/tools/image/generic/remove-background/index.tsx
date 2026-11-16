import React, { useState } from 'react';
import * as Yup from 'yup';
import ToolFileResult from '@components/result/ToolFileResult';
import ToolContent from '@components/ToolContent';
import { ToolComponentProps } from '@tools/defineTool';
import ToolImageInput from '@components/input/ToolImageInput';
import { removeBackground } from '@imgly/background-removal';

const initialValues = {};

const validationSchema = Yup.object({});

export default function RemoveBackgroundFromImage({
  title
}: ToolComponentProps) {
  const [input, setInput] = useState<File | null>(null);
  const [result, setResult] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const compute = async (_optionsValues: typeof initialValues, input: any) => {
    if (!input) return;

    setIsProcessing(true);

    try {
      let fileToProcess = input;
      // Check if the file is HEIC (by MIME type or extension)
      if (
        /image\/hei[cf]/.test(input.type) ||
        /\.hei[cf]$/i.test(input.name || '')
      ) {
        // Share the same on-demand decoder as the multiple-image picker.
        const { heicTo } = await import('heic-to');
        const convertedBlob = await heicTo({
          blob: input,
          type: 'image/png'
        });
        fileToProcess = new File(
          [convertedBlob],
          input.name.replace(/\.[^/.]+$/, '') + '.png',
          { type: 'image/png' }
        );
      }

      // Convert the file to a Blob URL
      const inputUrl = URL.createObjectURL(fileToProcess);

      // Process the image with the background removal library
      let blob: Blob;
      try {
        blob = await removeBackground(inputUrl, {
          progress: (progress) => {
            console.log(`Background removal progress: ${progress}`);
          }
        });
      } finally {
        URL.revokeObjectURL(inputUrl);
      }

      // Create a new file from the blob
      const newFile = new File(
        [blob],
        fileToProcess.name.replace(/\.[^/.]+$/, '') + '-no-bg.png',
        {
          type: 'image/png'
        }
      );

      setResult(newFile);
    } catch (err) {
      console.error('Error removing background:', err);
      throw new Error(
        'Failed to remove background. Please try a different image or try again later.',
        { cause: err }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolContent
      title={title}
      initialValues={initialValues}
      getGroups={null}
      compute={compute}
      input={input}
      validationSchema={validationSchema}
      inputComponent={
        <ToolImageInput
          value={input}
          onChange={setInput}
          accept={['image/*']}
          title={'Input Image'}
        />
      }
      resultComponent={
        <ToolFileResult
          title={'Transparent PNG'}
          value={result}
          extension={'png'}
          loading={isProcessing}
          loadingText={'Removing background'}
        />
      }
      toolInfo={{
        title: 'Remove Background from Image',
        description:
          'This tool uses AI to automatically remove the background from your images, creating a transparent PNG. Perfect for product photos, profile pictures, and design assets.'
      }}
    />
  );
}
