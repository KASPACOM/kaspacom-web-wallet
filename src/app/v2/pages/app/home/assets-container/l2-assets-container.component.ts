import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  KcLabeledTabsComponent,
  TabItem,
} from '../../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import { WalletSummaryComponent } from '../wallet-summary/wallet-summary.component';
import { BaseAssetsContainerComponent } from './base-assets-container';

@Component({
  selector: 'app-l2-assets-container',
  standalone: true,
  imports: [CommonModule, KcLabeledTabsComponent, WalletSummaryComponent],
  template: `
    <kc-labeled-tabs
      [tabs]="tabs"
      [selectedTabId]="selectedTabId()"
      (selectedTabChange)="onTabChange($event)"
    >
      <div *ngIf="selectedTabId() === 'l2-balance'">
        <app-wallet-summary></app-wallet-summary>
      </div>
    </kc-labeled-tabs>
  `,
  styleUrl: './l2-assets-container.component.scss',
})
export class L2AssetsContainerComponent extends BaseAssetsContainerComponent {
  tabs: TabItem[] = [
    { id: 'l2-balance', label: 'L2 Balance' },
    // Future: Add ERC20 tokens tab when implemented
  ];
}
