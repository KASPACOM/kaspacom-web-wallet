import { computed, signal } from '@angular/core';

export abstract class BaseActivityComponent<TItem> {
  selectedTabId = signal<string>('all');

  abstract allActivity: ReturnType<typeof computed<TItem[]>>;

  filteredActivity = computed<TItem[]>(() => this.allActivity());

  onTabChange(tabId: string): void {
    this.selectedTabId.set(tabId);
  }
}
