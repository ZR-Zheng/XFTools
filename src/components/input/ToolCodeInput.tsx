import ToolTextInput from './ToolTextInput';
export default function ToolCodeInput(props: {
  title?: string;
  value: string;
  language: string;
  onChange: (value: string) => void;
}) {
  return <ToolTextInput {...props} />;
}
