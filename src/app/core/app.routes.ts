import { Routes } from '@angular/router';
import { SetPasswordComponent } from '../pages/set-password/set-password.component';
import { LoginComponent } from '../pages/login/login.component';
import { WalletSelectionComponent } from '../pages/wallet-selection/wallet-selection.component';
import { AddWalletComponent } from '../pages/add-wallet/add-wallet.component';
import { WalletInfoComponent } from '../pages/wallet-info/wallet-info.component';
import { ReviewActionComponent } from '../components/wallet-actions-reviews/review-action/review-action.component';
import { ClearDataComponent } from '../pages/clear-data/clear-data.component';
import {OnboardingPageComponent} from "../v2/pages/onboarding-page/onboarding-page.component";

export const routes: Routes = [
  {
    path: 'wallet', children: [
      {
        path: '',
        component: OnboardingPageComponent,
      }
    ]
  },
  {path: 'set-password', component: SetPasswordComponent},
  {path: 'login', component: LoginComponent},
  {path: 'add-wallet', component: AddWalletComponent},
  {path: 'wallet-selection', component: WalletSelectionComponent},
  {path: 'wallet-info', component: WalletInfoComponent},
  {path: 'review-action', component: ReviewActionComponent},
  {path: 'clear-data', component: ClearDataComponent },
    { path: '**', redirectTo: ''},
];
