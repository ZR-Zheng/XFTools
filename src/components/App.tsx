import { BrowserRouter, useLocation, useRoutes } from 'react-router-dom';
import routesConfig from '../config/routesConfig';
import Navbar from './Navbar';
import { createElement, Suspense, useEffect } from 'react';
import Loading from './Loading';
import { CustomSnackBarProvider } from '../contexts/CustomSnackBarContext';
import { tools } from '../tools';
import './index.css';
import './workbench/refinements.css';
import './workbench/task-pages.css';
import './workbench/specialized-pages.css';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { useWorkbenchText } from '../i18n/workbench';
import { UserTypeFilterProvider } from 'providers/UserTypeFilterProvider';
import { ThemeContext } from '../contexts/ThemeContext';
function AppRoutes() {
  return useRoutes([
    ...routesConfig,
    ...tools.map((tool) => ({
      path: tool.path,
      element: createElement(tool.component)
    }))
  ]);
}
function Workspace() {
  const { w } = useWorkbenchText();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return (
    <div className="app-shell">
      <Navbar />
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
        </footer>
      </div>
    </div>
  );
}
export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    try {
      localStorage.removeItem('theme');
    } catch {
      /* The fixed appearance also works when storage is unavailable. */
    }
  }, []);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeContext.Provider value="light">
        <CustomSnackBarProvider>
          <UserTypeFilterProvider>
            <BrowserRouter>
              <Workspace />
            </BrowserRouter>
          </UserTypeFilterProvider>
        </CustomSnackBarProvider>
      </ThemeContext.Provider>
    </I18nextProvider>
  );
}
