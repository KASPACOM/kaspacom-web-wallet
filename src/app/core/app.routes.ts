import { Routes } from '@angular/router';
import { SetPasswordComponent } from '../pages/set-password/set-password.component';
import { LoginComponent } from '../pages/login/login.component';
import { WalletSelectionComponent } from '../pages/wallet-selection/wallet-selection.component';
import { AddWalletComponent } from '../pages/add-wallet/add-wallet.component';
import { WalletInfoComponent } from '../pages/wallet-info/wallet-info.component';
import { TestInscriptionsComponent } from '../components/test-inscriptions/test-inscriptions.component';
import { TestInscriptionsGuard } from './test-inscriptions.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'test-inscriptions', pathMatch: 'full' },
    { path: 'test-inscriptions', component: TestInscriptionsComponent },
    {
        path: '',
        canActivate: [TestInscriptionsGuard],
        children: [
            { path: 'set-password', component: SetPasswordComponent },
            { path: 'login', component: LoginComponent },
            { path: 'add-wallet', component: AddWalletComponent },
            { path: 'wallet-selection', component: WalletSelectionComponent },
            { path: 'wallet-info', component: WalletInfoComponent }
        ]
    }
];
