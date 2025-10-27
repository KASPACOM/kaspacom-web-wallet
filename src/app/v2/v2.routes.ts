import { Routes } from '@angular/router';
import { OnboardingPageComponent } from './pages/onboarding-page/onboarding-page.component';
import { DesignSystemShowcaseComponent } from '@kaspacom/ui';
import { AuthGuard } from './guard/auth.guard';
import { routes } from '../core/app.routes';
import { loggedRoutes } from './pages/app/logged.routes';
import { ButtonShowcaseComponent } from './pages/button-showcase/button-showcase.component';
import { DevelopGuard } from './guard/develop.guard';

export const V2TMP_ROUTES: Routes = [
  {
    path: 'onboarding',
    canActivate: [AuthGuard],
    component: OnboardingPageComponent,
  },
  {
    path: 'ui-kit',
    canActivate: [DevelopGuard],
    component: DesignSystemShowcaseComponent,
  },
  {
    path: 'button-showcase',
    canActivate: [],
    component: ButtonShowcaseComponent,
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
