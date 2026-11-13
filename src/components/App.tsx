import { BrowserRouter, useLocation, useRoutes } from 'react-router-dom';
import routesConfig from '../config/routesConfig';
import Navbar from './Navbar';
import { createElement, Suspense, useState, useEffect } from 'react';
import Loading from './Loading';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { CustomSnackBarProvider } from '../contexts/CustomSnackBarContext';
import { SnackbarProvider } from 'notistack';
import { tools } from '../tools';
import './index.css';
import { darkTheme, lightTheme } from '../config/muiConfig';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { useWorkbenchText } from '../i18n/workbench';
import { UserTypeFilterProvider } from 'providers/UserTypeFilterProvider';
export type Mode = 'dark' | 'light';
function AppRoutes() {
  return useRoutes([
    ...routesConfig,
    ...tools.map((tool) => ({
      path: tool.path,
      element: createElement(tool.component)
    }))
  ]);
}
function Workspace({ mode, toggle }: { mode: Mode; toggle: () => void }) {
  const { w } = useWorkbenchText();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return (
    <div className="app-shell">
      <Navbar mode={mode} onChangeMode={toggle} />
      <div className="main-shell">
        <main id="main-content" tabIndex={-1}>
          <Suspense fallback={<Loading />}>
            <AppRoutes />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>
            XFTools<span className="footer-dot">·</span>
            {w('footer')}
          </span>
          <span>
            <GlyphShield />
            {w('privacy')}
            <span className="footer-dot">·</span>
            {w('license')}
          </span>
        </footer>
      </div>
    </div>
  );
}
function GlyphShield() {
  return <span className="status-dot" />;
}
export default function App() {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem('theme', mode);
    } catch {
      /* Use the session preference. */
    }
  }, [mode]);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <CustomSnackBarProvider>
            <UserTypeFilterProvider>
              <BrowserRouter>
                <Workspace
                  mode={mode}
                  toggle={() =>
                    setMode((current) =>
                      current === 'dark' ? 'light' : 'dark'
                    )
                  }
                />
              </BrowserRouter>
            </UserTypeFilterProvider>
          </CustomSnackBarProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
