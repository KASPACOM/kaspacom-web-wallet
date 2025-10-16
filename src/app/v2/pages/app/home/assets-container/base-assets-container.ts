import { signal } from '@angular/core';

export class BaseAssetsContainerComponent {
  selectedTabId = signal<string>('utxos');

  onTabChange(tabId: string): void {
    this.selectedTabId.set(tabId);
  }
}
