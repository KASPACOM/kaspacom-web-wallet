import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcButtonComponent, KcIconComponent, NotificationService } from 'kaspacom-ui';
import { NetworkConfigService, KaspaNetworkConfig } from '../../../../services/network-config.service';
import { EthereumWalletChainManager } from '../../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, KcButtonComponent, KcIconComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly networkConfigService: NetworkConfigService = inject(NetworkConfigService);
  private readonly ethereumWalletChainManager: EthereumWalletChainManager = inject(EthereumWalletChainManager);
  private readonly notificationService: NotificationService = inject(NotificationService);

  // Environment flags
  protected readonly isProduction = environment.isProduction;
  protected readonly canSwitchNetworks = computed(() => this.networkConfigService.isNetworkSwitchingAllowed());

  // Kaspa Network state
  protected readonly activeNetwork = computed(() => this.networkConfigService.getActiveNetworkSignal()());
  protected readonly allNetworks = computed(() => this.networkConfigService.getAllNetworks());
  protected readonly showCustomizeWrpc = signal(false);
  protected readonly showAddCustomNetwork = signal(false);
  protected readonly customWrpcUrl = signal('');

  // L2 Network state
  protected readonly l2Networks = computed<EIP1193ProviderChain[]>(() => 
    Object.values(this.ethereumWalletChainManager.getAllChainsByChainId()) as EIP1193ProviderChain[]
  );
  protected readonly showEditL2Rpc = signal<string | null>(null);
  protected readonly editL2RpcUrl = signal('');

  // Custom network form
  protected readonly customNetworkForm = signal({
    id: '',
    name: '',
    networkId: '',
    wrpcUrl: '',
    useResolver: true,
    kaspaApiBaseurl: '',
    kaspaExplorerBaseurl: '',
    kasplexApiBaseurl: '',
    krc721ApiBaseurl: '',
    krc721CacheStreamUrl: '',
    knsApiBaseurl: '',
  });

  // Custom network form update methods
  updateCustomFormField(field: string, value: string): void {
    const current = this.customNetworkForm();
    this.customNetworkForm.set({ ...current, [field]: value });
  }

  // Kaspa Network Methods
  switchToNetwork(networkId: string): void {
    try {
      this.networkConfigService.setActiveNetwork(networkId);
      this.notificationService.success('Network switched', `Switched to ${this.activeNetwork().name}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Network switch failed', `Failed to switch network: ${errorMessage}`);
    }
  }

  onNetworkChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const networkId = select.value;
    this.switchToNetwork(networkId);
  }

  getWrpcDisplay(): string {
    const network = this.activeNetwork();
    if (network.useResolver) {
      return 'Auto (Resolver)';
    }
    return network.wrpcUrl || 'Not configured';
  }

  openCustomizeWrpc(): void {
    this.customWrpcUrl.set(this.activeNetwork().wrpcUrl);
    this.showCustomizeWrpc.set(true);
  }

  saveCustomWrpc(): void {
    const url = this.customWrpcUrl();
    const useResolver = url === '';
    
    try {
      this.networkConfigService.updateNetwork(this.activeNetwork().id, {
        wrpcUrl: url,
        useResolver,
      });
      this.notificationService.success('WRPC updated', 'WRPC configuration updated successfully');
      this.showCustomizeWrpc.set(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.error('WRPC update failed', `Failed to update WRPC: ${errorMessage}`);
    }
  }

  cancelCustomizeWrpc(): void {
    this.showCustomizeWrpc.set(false);
  }

  openAddCustomNetwork(): void {
    this.customNetworkForm.set({
      id: '',
      name: '',
      networkId: '',
      wrpcUrl: '',
      useResolver: true,
      kaspaApiBaseurl: '',
      kaspaExplorerBaseurl: '',
      kasplexApiBaseurl: '',
      krc721ApiBaseurl: '',
      krc721CacheStreamUrl: '',
      knsApiBaseurl: '',
    });
    this.showAddCustomNetwork.set(true);
  }

  saveCustomNetwork(): void {
    const form = this.customNetworkForm();
    
    if (!form.id || !form.name || !form.networkId) {
      this.notificationService.error('Missing fields', 'Please fill in required fields (ID, Name, Network ID)');
      return;
    }

    try {
      const config: KaspaNetworkConfig = {
        ...form,
        isCustom: true,
      };
      
      this.networkConfigService.addCustomNetwork(config);
      this.notificationService.success('Network added', `Added custom network: ${form.name}`);
      this.showAddCustomNetwork.set(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Network add failed', `Failed to add network: ${errorMessage}`);
    }
  }

  cancelAddCustomNetwork(): void {
    this.showAddCustomNetwork.set(false);
  }

  removeCustomNetwork(networkId: string): void {
    if (!confirm('Are you sure you want to remove this custom network?')) {
      return;
    }

    try {
      this.networkConfigService.removeCustomNetwork(networkId);
      this.notificationService.success('Network removed', 'Custom network removed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Network removal failed', `Failed to remove network: ${errorMessage}`);
    }
  }

  // L2 Network Methods
  getL2Icon(network: EIP1193ProviderChain): string {
    return this.ethereumWalletChainManager.getChainEnvConfig(network.chainId)?.icon || '🌐';
  }

  openEditL2Rpc(chainId: string): void {
    const network = this.l2Networks().find(n => n.chainId === chainId);
    if (network) {
      this.editL2RpcUrl.set(network.rpcUrls[0] || '');
      this.showEditL2Rpc.set(chainId);
    }
  }

  saveL2Rpc(): void {
    const chainId = this.showEditL2Rpc();
    if (!chainId) return;

    const newRpcUrl = this.editL2RpcUrl();
    if (!newRpcUrl) {
      this.notificationService.error('Invalid RPC URL', 'RPC URL cannot be empty');
      return;
    }

    try {
      // Update the network config
      const network = this.l2Networks().find(n => n.chainId === chainId);
      if (network) {
        network.rpcUrls = [newRpcUrl];
        this.notificationService.success('RPC updated', 'L2 RPC URL updated successfully');
        this.showEditL2Rpc.set(null);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.error('RPC update failed', `Failed to update RPC: ${errorMessage}`);
    }
  }

  cancelEditL2Rpc(): void {
    this.showEditL2Rpc.set(null);
  }
}
