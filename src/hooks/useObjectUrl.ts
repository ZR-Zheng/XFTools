import { useEffect, useState } from 'react';

export default function useObjectUrl(file: Blob) {
  const [preview, setPreview] = useState<{ file: Blob; url: string }>();
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview?.file === file ? preview.url : undefined;
}
