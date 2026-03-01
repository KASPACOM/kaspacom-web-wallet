import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KcButtonComponent, KcIconComponent, NotificationService } from 'kaspacom-ui';
import { NetworkConfigService, KaspaNetworkConfig } from '../../../services/network-config.service';
import { EthereumWalletChainManager } from '../../../services/etherium-services/etherium-wallet-chain.manager';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, KcButtonComponent, KcIconComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private networkConfigService = inject(NetworkConfigService);
  private ethereumWalletChainManager = inject(EthereumWalletChainManager);
  private notificationService = inject(NotificationService);

  // Environment flags
  protected isProduction = environment.isProduction;
  protected canSwitchNetworks = computed(() => this.networkConfigService.isNetworkSwitchingAllowed());

  // Kaspa Network state
  protected activeNetwork = computed(() => this.networkConfigService.getActiveNetworkSignal()());
  protected allNetworks = computed(() => this.networkConfigService.getAllNetworks());
  protected showCustomizeWrpc = signal(false);
  protected showAddCustomNetwork = signal(false);
  protected customWrpcUrl = signal('');

  // L2 Network state
  protected l2Networks = computed(() => Object.values(this.ethereumWalletChainManager.getAllChainsByChainId()));
  protected showEditL2Rpc = signal<string | null>(null);
  protected editL2RpcUrl = signal('');

  // Custom network form
  protected customNetworkForm = signal({
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

  // Kaspa Network Methods
  onNetworkChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const networkId = select.value;
    
    try {
      this.networkConfigService.setActiveNetwork(networkId);
      this.notificationService.success(`Switched to ${this.activeNetwork().name}`);
    } catch (error) {
      this.notificationService.error(`Failed to switch network: ${error}`);
    }
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
      this.notificationService.success('WRPC configuration updated');
      this.showCustomizeWrpc.set(false);
    } catch (error) {
      this.notificationService.error(`Failed to update WRPC: ${error}`);
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
      this.notificationService.error('Please fill in required fields (ID, Name, Network ID)');
      return;
    }

    try {
      const config: KaspaNetworkConfig = {
        ...form,
        isCustom: true,
      };
      
      this.networkConfigService.addCustomNetwork(config);
      this.notificationService.success(`Added custom network: ${form.name}`);
      this.showAddCustomNetwork.set(false);
    } catch (error) {
      this.notificationService.error(`Failed to add network: ${error}`);
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
      this.notificationService.success('Custom network removed');
    } catch (error) {
      this.notificationService.error(`Failed to remove network: ${error}`);
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
      this.notificationService.error('RPC URL cannot be empty');
      return;
    }

    try {
      // Update the network config
      const network = this.l2Networks().find(n => n.chainId === chainId);
      if (network) {
        network.rpcUrls = [newRpcUrl];
        this.notificationService.success('L2 RPC URL updated');
        this.showEditL2Rpc.set(null);
      }
    } catch (error) {
      this.notificationService.error(`Failed to update RPC: ${error}`);
    }
  }

  cancelEditL2Rpc(): void {
    this.showEditL2Rpc.set(null);
  }
}
