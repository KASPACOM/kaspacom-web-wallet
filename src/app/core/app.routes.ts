import { Routes } from '@angular/router';
import { LoginComponent } from '../pages/login/login.component';
import { WalletSelectionComponent } from '../pages/wallet-selection/wallet-selection.component';
import { WalletInfoComponent } from '../pages/wallet-info/wallet-info.component';
import { ReviewActionComponent } from '../components/wallet-actions-reviews/review-action/review-action.component';
import { ClearDataComponent } from '../pages/clear-data/clear-data.component';
import { OnboardingPageV2Component } from '../v2/pages/onboarding-page-v2/onboarding-page-v2.component';

export const routes: Routes = [
  {
    path: 'wallet',
    children: [
      {
        path: '',
        component: OnboardingPageV2Component,
      },
    ],
  },
  { path: 'login', component: LoginComponent },
  { path: 'wallet-selection', component: WalletSelectionComponent },
  { path: 'wallet-info', component: WalletInfoComponent },
  { path: 'review-action', component: ReviewActionComponent },
  { path: 'clear-data', component: ClearDataComponent },
  // {
  //   // temporary, lazy load not needed
  //   path: 'v2',
  //   children: V2TMP_ROUTES,
  // },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'wallet',
  },
  { path: '**', redirectTo: '' },
];
