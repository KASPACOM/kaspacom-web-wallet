import { Routes } from '@angular/router';
import { HomeComponent } from '../home.component';
import { SearchComponent } from '../search/search.component';
import { Krc20AssetComponent } from '../krc20-asset/krc20-asset.component';
import { Krc721AssetComponent } from '../krc721-asset/krc721-asset.component';

export const HomeRoutes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'search',
    component: SearchComponent,
  },
  {
    path: 'asset/krc20/:ticker',
    component: Krc20AssetComponent,
    data: { animation: 'AssetDetail' },
  },
  {
    path: 'asset/krc721/:tick/:tokenId',
    component: Krc721AssetComponent,
    data: { animation: 'AssetDetail' },
  },
];
