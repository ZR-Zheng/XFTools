import { createTheme, ThemeOptions } from '@mui/material';
const fontFamily =
  '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
function makeTheme(dark: boolean) {
  const border = dark ? '#343c49' : '#e3e5e9';
  const options: ThemeOptions = {
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: dark ? '#82aaff' : '#285ee8' },
      secondary: { main: '#ea580c' },
      background: {
        default: dark ? '#151a23' : '#f7f8fa',
        paper: dark ? '#1d2430' : '#ffffff',
        hover: dark ? '#293243' : '#f0f4ff',
        lightSecondary: dark ? '#1d2430' : '#ffffff',
        darkSecondary: dark ? '#293243' : '#edf2fe'
      },
      text: {
        primary: dark ? '#eef1f7' : '#202735',
        secondary: dark ? '#b1bdcf' : '#626c7d'
      },
      divider: border
    },
    typography: {
      fontFamily,
      fontSize: 14,
      h1: { fontWeight: 700 },
      h2: { fontWeight: 650 },
      h3: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
      body1: { lineHeight: 1.7 }
    },
    shape: { borderRadius: 10 },
    zIndex: { snackbar: 2000 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 42, borderRadius: 8, padding: '8px 18px' }
        }
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: dark ? '#1a202a' : '#fff',
            '& fieldset': { borderColor: border }
          },
          input: { fontSize: 15 }
        }
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
      MuiCheckbox: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiCard: {
        styleOverrides: {
          root: { border: `1px solid ${border}`, boxShadow: 'none' }
        }
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: 40, minHeight: 40 } }
      },
      MuiTooltip: { defaultProps: { arrow: true } }
    }
  };
  return createTheme(options);
}
export const lightTheme = makeTheme(false);
export const darkTheme = makeTheme(true);
