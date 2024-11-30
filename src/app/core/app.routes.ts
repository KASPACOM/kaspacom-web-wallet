import { Routes } from '@angular/router';
import { SetPasswordComponent } from '../pages/set-password/set-password.component';
import { LoginComponent } from '../pages/login/login.component';
import { WalletSelectionComponent } from '../pages/wallet-selection/wallet-selection.component';
import { AddWalletComponent } from '../pages/add-wallet/add-wallet.component';

export const routes: Routes = [
    { path: 'set-password', component: SetPasswordComponent },
    { path: 'login', component: LoginComponent },
    { path: 'add-wallet', component: AddWalletComponent },
    { path: 'wallet-selection', component: WalletSelectionComponent },
    { path: '**', redirectTo: '' },  
];
