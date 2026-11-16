import MultiFileInput, {
  type MultiFileInputProps,
  type MultiFileValue
} from './MultiFileInput';
export type MultiPdfInput = MultiFileValue;
export default function ToolMultiplePdfInput(
  props: Omit<MultiFileInputProps, 'type'> & { type: 'pdf' }
) {
  return <MultiFileInput {...props} />;
}
