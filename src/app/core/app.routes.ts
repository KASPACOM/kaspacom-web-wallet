import { Routes } from '@angular/router';
import { SetPasswordComponent } from '../pages/set-password/set-password.component';
import { LoginComponent } from '../pages/login/login.component';
import { WalletImportComponent } from '../pages/wallet-import/wallet-import.component';
import { DashboardComponent } from '../pages/dashboard/dashboard.component';

export const routes: Routes = [
    { path: 'set-password', component: SetPasswordComponent },
    { path: 'login', component: LoginComponent },
    { path: 'import-wallet', component: WalletImportComponent },
    { path: 'dashboard', component: DashboardComponent },
    { path: '**', redirectTo: '' },  
];
