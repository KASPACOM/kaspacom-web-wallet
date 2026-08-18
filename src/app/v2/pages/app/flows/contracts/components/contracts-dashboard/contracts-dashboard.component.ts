import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  KcButtonComponent,
  KcInputComponent,
  KcTooltipDirective,
} from '@kaspacom/ui-kit';
import { CopyButtonComponent } from '../../../../../../shared/ui/copy-button/copy-button.component';
import { ContractDisplayService } from '../../services/contract-display.service';
import {
  ContractDashboardEntry,
  ContractDashboardFilter,
  ContractStatusFilter,
  TabName,
} from '../../contracts-page.models';

@Component({
  selector: 'app-contracts-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcTooltipDirective,
    CopyButtonComponent,
  ],
  templateUrl: './contracts-dashboard.component.html',
  styleUrl: './contracts-dashboard.component.scss',
})
export class ContractsDashboardComponent {
  display = inject(ContractDisplayService);

  // Filtered/sorted list the shell already computed (filteredDashboardContracts()).
  contracts = input.required<ContractDashboardEntry[]>();
  loading = input(false);
  indexerLoading = input(false);
  error = input<string | null>(null);
  network = input('');

  dashboardFilter = input<ContractDashboardFilter>('all');
  statusFilter = input<ContractStatusFilter>('active');
  dashboardSearch = input('');

  // Shell-owned so the same contract's editor stays in sync whether opened
  // from a card here or from the detail panel (a sibling still in the shell).
  editingAliasKey = input<string | null>(null);
  aliasNotice = input<{ key: string; message: string } | null>(null);
  walletKey = input<string | undefined>(undefined);

  dashboardFilterChanged = output<ContractDashboardFilter>();
  statusFilterChanged = output<ContractStatusFilter>();
  dashboardSearchChanged = output<string>();
  refreshRequested = output<void>();
  tabRequested = output<TabName>();

  contractDetailsRequested = output<ContractDashboardEntry>();
  contractActionRequested = output<ContractDashboardEntry>();

  aliasEditRequested = output<ContractDashboardEntry>();
  aliasEditCancelled = output<void>();
  aliasSaveRequested = output<{
    contract: ContractDashboardEntry;
    draft: string;
  }>();
  aliasRemoveRequested = output<ContractDashboardEntry>();

  // Local to this card's editor input — the shell keeps the authoritative
  // editingAliasKey/aliasNotice (also read by the detail panel), but the
  // text being typed only needs to exist wherever the box is rendered.
  aliasDraft = '';

  constructor() {
    effect(() => {
      const key = this.editingAliasKey();
      if (!key) {
        this.aliasDraft = '';
        return;
      }
      const contract = this.contracts().find(
        (entry) => this.getAliasEditKey(entry) === key,
      );
      if (!contract) return;
      const currentWalletKey = this.walletKey();
      this.aliasDraft =
        (currentWalletKey ? contract.aliases?.[currentWalletKey] : '') ||
        contract.aliasName ||
        '';
    });
  }

  canEditContractAlias(contract: ContractDashboardEntry): boolean {
    return !!contract.registryEntry;
  }

  getAliasEditKey(contract: ContractDashboardEntry): string {
    return contract.registryEntry?.id || contract.id;
  }

  getAliasUnavailableMessage(): string {
    return 'Import this contract before adding a nickname.';
  }

  setDashboardFilter(filter: ContractDashboardFilter) {
    this.dashboardFilterChanged.emit(filter);
  }

  setStatusFilter(filter: ContractStatusFilter) {
    this.statusFilterChanged.emit(filter);
  }

  onSearchChange(value: string) {
    this.dashboardSearchChanged.emit(value || '');
  }

  beginAliasEdit(contract: ContractDashboardEntry) {
    this.aliasEditRequested.emit(contract);
  }

  cancelAliasEdit() {
    this.aliasEditCancelled.emit();
  }

  saveAlias(contract: ContractDashboardEntry) {
    this.aliasSaveRequested.emit({ contract, draft: this.aliasDraft });
  }

  removeAlias(contract: ContractDashboardEntry) {
    this.aliasRemoveRequested.emit(contract);
  }
}
