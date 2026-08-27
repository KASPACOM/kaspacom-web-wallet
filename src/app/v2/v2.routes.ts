import { Routes } from '@angular/router';
import { OnboardingPageV2Component } from './pages/onboarding-page-v2/onboarding-page-v2.component';
import { AuthGuard } from './guard/auth.guard';
import { routes } from '../core/app.routes';
import { loggedRoutes } from './pages/app/logged.routes';

export const V2TMP_ROUTES: Routes = [
  {
    path: 'onboarding',
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
  {
    path: 'legacy',
    children: routes,
  },
  // Public, SEO-indexable content pages — prerendered at build time,
  // see src/app/core/server.routes.ts.
  {
    path: 'faq',
    loadComponent: () =>
      import('../pages/content/faq/faq.component').then(
        (m) => m.FaqComponent,
      ),
  },
  {
    path: 'features',
    loadComponent: () =>
      import('../pages/content/features/features.component').then(
        (m) => m.FeaturesComponent,
      ),
  },
  {
    path: 'learn',
    loadComponent: () =>
      import('../pages/content/learn/learn.component').then(
        (m) => m.LearnComponent,
      ),
  },
  {
    path: 'learn/what-is-kaspa',
    loadComponent: () =>
      import(
        '../pages/content/learn/articles/what-is-kaspa/what-is-kaspa.component'
      ).then((m) => m.WhatIsKaspaComponent),
  },
  {
    path: 'learn/what-is-a-non-custodial-wallet',
    loadComponent: () =>
      import(
        '../pages/content/learn/articles/what-is-a-non-custodial-wallet/what-is-a-non-custodial-wallet.component'
      ).then((m) => m.WhatIsANonCustodialWalletComponent),
  },
  {
    path: 'learn/what-is-krc-20',
    loadComponent: () =>
      import(
        '../pages/content/learn/articles/what-is-krc-20/what-is-krc-20.component'
      ).then((m) => m.WhatIsKrc20Component),
  },
  {
    path: 'learn/what-is-kns',
    loadComponent: () =>
      import(
        '../pages/content/learn/articles/what-is-kns/what-is-kns.component'
      ).then((m) => m.WhatIsKnsComponent),
  },
  {
    path: 'learn/how-to-store-kaspa-safely',
    loadComponent: () =>
      import(
        '../pages/content/learn/articles/how-to-store-kaspa-safely/how-to-store-kaspa-safely.component'
      ).then((m) => m.HowToStoreKaspaSafelyComponent),
  },
  {
    path: 'learn/kaspa-vs-bitcoin',
    loadComponent: () =>
      import(
        '../pages/content/learn/articles/kaspa-vs-bitcoin/kaspa-vs-bitcoin.component'
      ).then((m) => m.KaspaVsBitcoinComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'onboarding',
  },
];
