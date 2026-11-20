import { Navigate, type RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import { toolAliases } from '@tools/tool-aliases';
const Home = lazy(() => import('../pages/home'));
const NotFound = lazy(() => import('../pages/not-found'));
const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/favorites', element: <Home /> },
  { path: '/recent', element: <Home /> },
  { path: '/categories/:categoryName', element: <Home /> },
  ...Object.entries(toolAliases).map(([path, target]) => ({
    path: '/' + path,
    element: <Navigate replace to={`/${target.path}?${target.query}`} />
  })),
  { path: '*', element: <NotFound /> }
];
export default routes;
