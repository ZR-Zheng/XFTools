import MultiFileInput, {
  type MultiFileInputProps,
  type MultiFileValue
} from './MultiFileInput';
export type MultiAudioInput = MultiFileValue;
export default function ToolMultipleAudioInput(
  props: Omit<MultiFileInputProps, 'type'> & { type: 'audio' }
) {
  return <MultiFileInput {...props} />;
}
