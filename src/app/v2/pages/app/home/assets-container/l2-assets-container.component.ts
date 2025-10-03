import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  KcLabeledTabsComponent,
  TabItem,
} from '../../../../shared/ui/kc-labeled-tabs/kc-labeled-tabs.component';
import {
  BaseAssetsContainerComponent,
  ASSET_TAB_IDS,
  type AssetTabId,
} from './base-assets-container';

@Component({
  selector: 'app-l2-assets-container',
  standalone: true,
  imports: [CommonModule, KcLabeledTabsComponent],
  template: `
    <kc-labeled-tabs
      [tabs]="tabs"
      [selectedTabId]="selectedTabId()"
      (selectedTabChange)="onTabChange($event)"
    >
      <div *ngIf="selectedTabId() === 'l2-ERC20'">
        TODO: Add ERC20 tokens tab
      </div>
    </kc-labeled-tabs>
  `,
  styleUrl: './l2-assets-container.component.scss',
})
export class L2AssetsContainerComponent extends BaseAssetsContainerComponent {
  tabs: TabItem[] = [{ id: ASSET_TAB_IDS.L2_ERC20, label: 'ERC20' }];
}
