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
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'onboarding',
  },
];
