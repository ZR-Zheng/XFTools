import MultiFileInput, {
  type MultiFileInputProps,
  type MultiFileValue
} from './MultiFileInput';
export type MultiVideoInput = MultiFileValue;
export default function ToolMultipleVideoInput(
  props: Omit<MultiFileInputProps, 'type'> & { type: 'video' }
) {
  return <MultiFileInput {...props} />;
}
