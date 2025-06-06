import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { SwapComponent } from './swap/swap.component';
import { AppWrapperComponent } from './app-wrapper.component';
import { SearchComponent } from './home/search/search.component';
import { CollectablesComponent } from './collectables/collectables.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { SettingsComponent } from './settings/settings.component';
import { ActivityComponent } from './activity/activity.component';
import { HomeRoutes } from './home/routes/home.routes';

export const loggedRoutes: Routes = [
  {
    path: '',
    component: AppWrapperComponent,
    children: [
      {
        path: 'home',
        children: HomeRoutes,
        data: { animation: 'Home' },
      },
      {
        path: 'swap',
        component: SwapComponent,
        data: { animation: 'Swap' },
      },
      {
        path: 'collectables',
        component: CollectablesComponent,
        data: { animation: 'Collectables' },
      },
      {
        path: 'transactions',
        component: TransactionsComponent,
        data: { animation: 'Transactions' },
      },
      {
        path: 'settings',
        component: SettingsComponent,
        data: { animation: 'Settings' },
      },
      {
        path: 'activity',
        component: ActivityComponent,
        data: { animation: 'Activity' },
      },
    ],
  },
  {
    path: 'login',
    component: LoginComponent,
    data: { animation: 'Login' },
  },
];
