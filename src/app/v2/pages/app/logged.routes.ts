import { Routes } from '@angular/router';

import { AppWrapperComponent } from './app-wrapper.component';
import { CollectablesComponent } from './collectables/collectables.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { SettingsComponent } from './settings/settings.component';
import { ActivityComponent } from './activity/activity.component';
import { HomeRoutes } from './home/routes/home.routes';
import { LendingRoutes } from './lending/lending.routes';

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
      {
        path: 'lending',
        children: LendingRoutes,
        data: { animation: 'Lending' },
      },
    ],
  },
];
