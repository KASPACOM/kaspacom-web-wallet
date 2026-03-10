import { Routes } from '@angular/router';
import { OnboardingPageV2Component } from './pages/onboarding-page-v2/onboarding-page-v2.component';
import { DesignSystemShowcaseComponent } from 'kaspacom-ui';
import { AuthGuard } from './guard/auth.guard';
import { routes } from '../core/app.routes';
import { loggedRoutes } from './pages/app/logged.routes';
import { DevelopGuard } from './guard/develop.guard';

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
    path: 'ui-kit',
    canActivate: [DevelopGuard],
    component: DesignSystemShowcaseComponent,
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
