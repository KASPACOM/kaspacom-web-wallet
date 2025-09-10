import { Routes } from '@angular/router';
import { OnboardingPageComponent } from './pages/onboarding-page/onboarding-page.component';
import { DesignSystemShowcaseComponent } from '@kaspacom/ui';
import { AuthGuard } from './guard/auth.guard';
import { routes } from '../core/app.routes';
import { loggedRoutes } from './pages/app/logged.routes';
import { RecoveryImportComponent } from './pages/onboarding-page/flows/import-existing-flow/recovery/recovery-import.component';
import { ButtonShowcaseComponent } from './pages/button-showcase/button-showcase.component';

export const V2TMP_ROUTES: Routes = [
  {
    path: 'onboarding',
    canActivate: [AuthGuard],
    component: OnboardingPageComponent,
  },
  {
    path: 'recovery',
    component: RecoveryImportComponent,
  },
  {
    path: 'ui-kit',
    canActivate: [AuthGuard],
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
