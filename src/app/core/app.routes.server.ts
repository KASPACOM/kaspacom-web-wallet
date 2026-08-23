import { RenderMode, ServerRoute } from '@angular/ssr';
import { PUBLIC_PAGES } from '../public/public-content';

const publicServerRoutes: ServerRoute[] = PUBLIC_PAGES.map(
  (page): ServerRoute => ({
    path: page.path,
    renderMode: RenderMode.Prerender,
  }),
);

export const serverRoutes: ServerRoute[] = [
  ...publicServerRoutes,
  {
    path: 'onboarding',
    renderMode: RenderMode.Client,
  },
  {
    path: 'wallet',
    renderMode: RenderMode.Client,
  },
  {
    path: 'onboarding-v2',
    renderMode: RenderMode.Client,
  },
  {
    path: 'app/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'legacy/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
