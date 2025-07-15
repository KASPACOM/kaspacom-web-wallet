import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'kc-labeled-tabs',
  imports: [CommonModule],
  templateUrl: './kc-labeled-tabs.component.html',
  styleUrl: './kc-labeled-tabs.component.scss',
})
export class KcLabeledTabsComponent {
  tabs = input.required<TabItem[]>();
  selectedTabId = input<string>('');
  
  selectedTabChange = output<string>();

  selectedTab = computed(() => {
    const tabs = this.tabs();
    const selectedId = this.selectedTabId();
    
    if (!selectedId && tabs.length > 0) {
      return tabs[0];
    }
    
    return tabs.find(tab => tab.id === selectedId) || tabs[0];
  });

  onTabClick(tabId: string) {
    if (this.selectedTabId() !== tabId) {
      this.selectedTabChange.emit(tabId);
    }
  }

  isSelected(tabId: string): boolean {
    return this.selectedTab()?.id === tabId;
  }
} 