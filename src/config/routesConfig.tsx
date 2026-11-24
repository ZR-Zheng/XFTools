import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import { toolAliases } from '@tools/tool-aliases';
const Home = lazy(() => import('../pages/home'));
const NotFound = lazy(() => import('../pages/not-found'));

function ToolAlias({ path, query }: { path: string; query: string }) {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  return (
    <Navigate
      replace
      to={{ pathname: `/${path}`, search: params.toString(), hash }}
    />
  );
}

const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  {
    path: '/categories/png',
    element: <ToolAlias path="categories/image-generic" query="" />
  },
  { path: '/categories/:categoryName', element: <Home /> },
  ...Object.entries(toolAliases).map(([path, target]) => ({
    path: '/' + path,
    element: <ToolAlias {...target} />
  })),
  { path: '*', element: <NotFound /> }
];
export default routes;
