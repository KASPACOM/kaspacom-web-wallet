import { Routes } from '@angular/router';
import { OnboardingPageV2Component } from './pages/onboarding-page-v2/onboarding-page-v2.component';
import { AuthGuard } from './guard/auth.guard';
import { loggedRoutes } from './pages/app/logged.routes';
import { PUBLIC_PAGES } from '../public/public-content';
import { publicHomeGuard } from '../public/public-home.guard';

const publicRoutes: Routes = PUBLIC_PAGES.map((page) => {
  const route: Routes[number] = {
    path: page.path,
    loadComponent: () =>
      import('../public/public-page.component').then(
        (m) => m.PublicPageComponent,
      ),
    data: { pageId: page.id },
  };

  if (page.path === '') {
    route.canMatch = [publicHomeGuard];
  }

  return route;
});

const publicWalletInfoRoute: Routes[number] = {
  path: 'wallet-info',
  loadComponent: () =>
    import('../public/public-page.component').then(
      (m) => m.PublicPageComponent,
    ),
  data: { pageId: 'home' },
};

const walletShell = () =>
  import('../wallet-shell/wallet-shell.component').then(
    (m) => m.WalletShellComponent,
  );

const walletRoutes: Routes = [
  {
    path: '',
    loadComponent: walletShell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
      {
        path: 'info',
        loadComponent: () =>
          import('../public/public-page.component').then(
            (m) => m.PublicPageComponent,
          ),
        data: { pageId: 'home' },
      },
      {
        path: 'onboarding',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
      {
        path: 'wallet',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
      {
        path: 'onboarding-v2',
        canActivate: [AuthGuard],
        component: OnboardingPageV2Component,
      },
      {
        path: 'app',
        canActivate: [AuthGuard],
        children: loggedRoutes,
      },
    ],
  },
];

export const V2TMP_ROUTES: Routes = [
  ...publicRoutes,
  publicWalletInfoRoute,
  ...walletRoutes,
];
