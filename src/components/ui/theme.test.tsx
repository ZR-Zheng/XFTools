import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Box, Grid, Stack, useTheme } from './index';

function Fixture({ dynamic }: { dynamic: boolean }) {
  const theme = useTheme();
  return (
    <Stack
      sx={
        dynamic
          ? (current) => ({
              color: current.palette.mode === 'dark' ? '#ffffff' : '#000000'
            })
          : { color: '#000000' }
      }
    >
      <Grid sx={dynamic ? () => ({ padding: 1 }) : { padding: 0 }}>
        <Box
          sx={dynamic ? () => ({ margin: 1 }) : undefined}
          data-testid="theme-mode"
        >
          {theme.palette.mode}
        </Box>
      </Grid>
    </Stack>
  );
}

test('style objects can change to theme callbacks without changing hook order', () => {
  const view = render(
    <ThemeContext.Provider value="light">
      <Fixture dynamic={false} />
    </ThemeContext.Provider>
  );
  expect(screen.getByTestId('theme-mode').textContent).toBe('light');
  view.rerender(
    <ThemeContext.Provider value="dark">
      <Fixture dynamic />
    </ThemeContext.Provider>
  );
  expect(screen.getByTestId('theme-mode').textContent).toBe('dark');
  expect(document.head.textContent).toContain('color:#ffffff');
  view.rerender(
    <ThemeContext.Provider value="light">
      <Fixture dynamic={false} />
    </ThemeContext.Provider>
  );
  expect(screen.getByTestId('theme-mode').textContent).toBe('light');
});
