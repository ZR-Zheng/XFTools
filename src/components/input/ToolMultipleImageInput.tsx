import MultiFileInput, {
  type MultiFileInputProps,
  type MultiFileValue
} from './MultiFileInput';
export type MultiImageInput = MultiFileValue;
export default function ToolMultipleImageInput(
  props: Omit<MultiFileInputProps, 'type'> & { type: 'image' }
) {
  return <MultiFileInput {...props} />;
}
