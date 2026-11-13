import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';
const Home = lazy(() => import('../pages/home'));
const NotFound = lazy(() => import('../pages/not-found'));
const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/favorites', element: <Home /> },
  { path: '/recent', element: <Home /> },
  { path: '/categories/:categoryName', element: <Home /> },
  { path: '*', element: <NotFound /> }
];
export default routes;
