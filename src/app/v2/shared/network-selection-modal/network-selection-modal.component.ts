import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  NetworkSelectionService,
  NetworkConfig,
  NetworkType,
} from '../../../services/network-selection.service';
import { FlowPagesService } from '../../services/flow-pages.service';
import { KcIconComponent } from '@kaspacom/ui';

@Component({
  selector: 'app-network-selection-modal',
  imports: [CommonModule, KcIconComponent],
  templateUrl: './network-selection-modal.component.html',
  styleUrl: './network-selection-modal.component.scss',
})
export class NetworkSelectionModalComponent {
  private networkSelectionService = inject(NetworkSelectionService);
  private flowPagesService = inject(FlowPagesService);

  networks = signal<NetworkConfig[]>([]);
  currentNetwork = signal<string>('');

  constructor() {
    // Subscribe to current network changes
    toObservable(
      this.networkSelectionService.getCurrentNetworkSignal(),
    ).subscribe((network: string) => {
      this.currentNetwork.set(network);
    });

    // Load all networks (including disabled ones for visibility)
    this.networks.set(this.networkSelectionService.getAllNetworks());
  }

  onNetworkSelect(networkId: string): void {
    const networkConfig = this.networkSelectionService.getNetworkById(
      networkId as NetworkType,
    );
    if (!networkConfig?.enabled) {
      return; // Don't allow selection of disabled networks
    }

    this.networkSelectionService.setCurrentNetwork(networkId as NetworkType);
    this.flowPagesService.closePage();
  }

  onClose(): void {
    this.flowPagesService.closePage();
  }

  getNetworkIcon(network: NetworkConfig): string {
    return network.icon || '🌐';
  }

  isCurrentNetwork(networkId: string): boolean {
    return this.currentNetwork() === networkId;
  }

  isNetworkDisabled(network: NetworkConfig): boolean {
    return !network.enabled;
  }
}
