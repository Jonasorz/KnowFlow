import { createRootRoute, createRoute, createRouter, Outlet, useLocation } from '@tanstack/react-router';
import { MainLayout } from './components/layout/main-layout';
import { ArticleList } from './components/article/article-list';
import { ArticleReader } from './components/article/article-reader';
import { SourceManager } from './components/source/source-manager';
import { SettingsPage } from './components/settings/settings-page';

// Root Route
const rootRoute = createRootRoute({
  component: () => {
    const location = useLocation();
    const isHome = location.pathname === '/';
    return (
      <MainLayout showHeader={isHome}>
        <Outlet />
      </MainLayout>
    );
  },
});

// Index Route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ArticleList,
});

// Article Reader Route
const articleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/article/$id',
  component: ArticleReader,
});

// Source Manager Route
const sourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sources',
  component: SourceManager,
});

// Settings Route
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

// Create Route Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  articleRoute,
  sourcesRoute,
  settingsRoute,
]);

// Create Router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
