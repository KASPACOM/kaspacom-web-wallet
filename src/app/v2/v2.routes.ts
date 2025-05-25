import { Routes } from '@angular/router';
import { OnboardingPageComponent } from './pages/onboarding-page/onboarding-page.component';

export const V2TMP_ROUTES: Routes = [
  {
    path: 'onboarding',
    component: OnboardingPageComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'onboarding',
  },
];
