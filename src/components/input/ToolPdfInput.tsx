import React, { lazy, Suspense, useRef } from 'react';
import BaseFileInput from './BaseFileInput';
import { BaseFileInputProps } from './file-input-utils';
const PdfPagePicker = lazy(() => import('./PdfPagePicker'));

interface PdfFileInputProps extends BaseFileInputProps {
  pageRanges?: string;
  onPageRangesChange?: (value: string) => void;
}

export default function ToolPdfInput({
  pageRanges = '',
  onPageRangesChange,
  ...props
}: PdfFileInputProps) {
  const pdfRef = useRef<HTMLIFrameElement>(null);

  return (
    <BaseFileInput {...props} type={'pdf'}>
      {({ preview }) =>
        onPageRangesChange && preview ? (
          <Suspense fallback={<span>PDF…</span>}>
            <PdfPagePicker
              key={preview}
              url={preview}
              ranges={pageRanges}
              onChange={onPageRangesChange}
            />
          </Suspense>
        ) : (
          <iframe
            ref={pdfRef}
            src={preview}
            width="100%"
            height="100%"
            title={props.title || 'PDF preview'}
            style={{ maxWidth: '500px' }}
          />
        )
      }
    </BaseFileInput>
  );
}
