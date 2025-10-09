import { Routes } from '@angular/router';
import { HomeComponent } from '../home.component';
import { SearchComponent } from '../search/search.component';
import { Krc20AssetComponent } from '../krc20-asset/krc20-asset.component';
import { Krc721AssetComponent } from '../krc721-asset/krc721-asset.component';
import { KnsAssetComponent } from '../kns-asset/kns-asset.component';
import { UtxoAssetComponent } from '../utxo-asset/utxo-asset.component';
import { Krc20TransactionDetailsComponent } from '../krc20-transaction-details/krc20-transaction-details.component';
import { KaspaTransactionDetailsComponent } from '../kaspa-transaction-details/kaspa-transaction-details.component';
import { Erc20TransactionDetailsComponent } from '../erc20-transaction-details/erc20-transaction-details.component';

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
    path: 'asset/krc20/:ticker/transaction/:transactionId',
    component: Krc20TransactionDetailsComponent,
    data: { animation: 'TransactionDetail' },
  },
  {
    path: 'asset/krc721/:tick/:tokenId',
    component: Krc721AssetComponent,
    data: { animation: 'AssetDetail' },
  },
  {
    path: 'asset/kns/:assetId',
    component: KnsAssetComponent,
    data: { animation: 'AssetDetail' },
  },
  {
    path: 'asset/utxo/:txId',
    component: UtxoAssetComponent,
    data: { animation: 'AssetDetail' },
  },
  {
    path: 'transaction/kaspa/:transactionId',
    component: KaspaTransactionDetailsComponent,
    data: { animation: 'TransactionDetail' },
  },
  {
    path: 'transaction/erc20/:transactionId',
    component: Erc20TransactionDetailsComponent,
    data: { animation: 'TransactionDetail' },
  },
];
