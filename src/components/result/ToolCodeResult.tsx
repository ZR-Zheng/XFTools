import ToolTextResult from './ToolTextResult';
export default function ToolCodeResult({
  language,
  extension = language,
  ...props
}: {
  title?: string;
  value: string;
  language: string;
  extension?: string;
  loading?: boolean;
}) {
  return (
    <ToolTextResult
      {...props}
      language={language}
      extension={extension}
      keepSpecialCharacters
    />
  );
}
