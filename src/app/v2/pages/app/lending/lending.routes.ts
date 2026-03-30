import { Routes } from '@angular/router';
import { LendingDashboardComponent } from './pages/dashboard/lending-dashboard.component';
import { LendingSupplyComponent } from './pages/supply/lending-supply.component';
import { LendingWithdrawComponent } from './pages/withdraw/lending-withdraw.component';
import { LendingBorrowComponent } from './pages/borrow/lending-borrow.component';
import { LendingRepayComponent } from './pages/repay/lending-repay.component';
import { LendingDataService } from './services/lending-data.service';

export const LendingRoutes: Routes = [
  {
    path: '',
    component: LendingDashboardComponent,
    providers: [LendingDataService],
  },
  {
    path: 'supply/:address',
    component: LendingSupplyComponent,
    providers: [LendingDataService],
  },
  {
    path: 'withdraw/:address',
    component: LendingWithdrawComponent,
    providers: [LendingDataService],
  },
  {
    path: 'borrow/:address',
    component: LendingBorrowComponent,
    providers: [LendingDataService],
  },
  {
    path: 'repay/:address',
    component: LendingRepayComponent,
    providers: [LendingDataService],
  },
];
