import { Routes } from '@angular/router';
import { OnboardingPageComponent } from './pages/onboarding-page/onboarding-page.component';
import { DesignSystemShowcaseComponent } from 'kaspacom-ui';

export const V2TMP_ROUTES: Routes = [
  {
    path: 'onboarding',
    component: OnboardingPageComponent,
  },
  {
    path: 'ui-kit',
    component: DesignSystemShowcaseComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'onboarding',
  },
];
