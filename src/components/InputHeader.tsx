import { uiText } from 'i18n/uiText';
import Typography from '@mui/material/Typography';
export default function InputHeader({ title }: { title: string }) {
  return (
    <Typography component="h2" className="tool-section-title">
      {uiText(title)}
    </Typography>
  );
}
