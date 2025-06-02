import { Routes } from '@angular/router';
import { OnboardingPageComponent } from './pages/onboarding-page/onboarding-page.component';
import { DesignSystemShowcaseComponent } from 'kaspacom-ui';
import { AuthGuard } from './guard/auth.guard';

export const V2TMP_ROUTES: Routes = [
  {
    path: 'onboarding',
    canActivate: [AuthGuard],
    component: OnboardingPageComponent,
  },
  {
    path: 'ui-kit',
    canActivate: [AuthGuard],
    component: DesignSystemShowcaseComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'onboarding',
  },
];
