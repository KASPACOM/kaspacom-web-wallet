import { Routes } from '@angular/router';
import { OnboardingPageV2Component } from './pages/onboarding-page-v2/onboarding-page-v2.component';
import { AuthGuard } from './guard/auth.guard';
import { routes } from '../core/app.routes';
import { loggedRoutes } from './pages/app/logged.routes';
import { PUBLIC_PAGES } from '../public/public-content';

const publicRoutes: Routes = PUBLIC_PAGES.map((page) => ({
  path: page.path,
  loadComponent: () =>
    import('../public/public-page.component').then(
      (m) => m.PublicPageComponent,
    ),
  data: { pageId: page.id },
}));

const walletShell = () =>
  import('../wallet-shell/wallet-shell.component').then(
    (m) => m.WalletShellComponent,
  );

const walletRoutes: Routes = [
  {
    path: 'onboarding',
    loadComponent: walletShell,
    children: [
      {
        path: '',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
    ],
  },
  {
    path: 'wallet',
    loadComponent: walletShell,
    children: [
      {
        path: '',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
    ],
  },
  {
    path: 'onboarding-v2',
    loadComponent: walletShell,
    children: [
      {
        path: '',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
    ],
  },
  {
    path: 'app',
    canActivate: [AuthGuard],
    loadComponent: walletShell,
    children: loggedRoutes,
  },
  {
    path: 'legacy',
    loadComponent: walletShell,
    children: routes,
  },
];

export const V2TMP_ROUTES: Routes = [...publicRoutes, ...walletRoutes];
