import { Component, input, output } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';

export interface ContractsSidebarItem {
  key: string;
  label: string;
  iconClass: string;
  badge?: number;
}

@Component({
  selector: 'app-contracts-sidebar',
  standalone: true,
  imports: [KcIconComponent],
  templateUrl: './contracts-sidebar.component.html',
  styleUrl: './contracts-sidebar.component.scss',
})
export class ContractsSidebarComponent {
  items = input.required<ContractsSidebarItem[]>();
  active = input.required<string>();
  select = output<string>();
}
