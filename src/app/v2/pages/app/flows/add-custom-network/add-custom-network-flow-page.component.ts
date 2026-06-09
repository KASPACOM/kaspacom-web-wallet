import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownOption, KcButtonComponent, KcDropdownSelectComponent, KcInputComponent, NotificationService } from 'kaspacom-ui';
import { EthereumWalletChainManager, ExtendedEIP1193ProviderChain } from '../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { CHAIN_ID_LOGOS } from '../../../../shared/network-selection-modal/chain-id-logos';

interface WellKnownNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  decimals: number;
  explorerUrl: string;
}

const WELL_KNOWN_NETWORKS: WellKnownNetwork[] = [
  { name: 'Ethereum Mainnet',   chainId: 1,      rpcUrl: 'https://eth.llamarpc.com',                         symbol: 'ETH',   decimals: 18, explorerUrl: 'https://etherscan.io' },
  { name: 'Base',               chainId: 8453,   rpcUrl: 'https://mainnet.base.org',                         symbol: 'ETH',   decimals: 18, explorerUrl: 'https://basescan.org' },
  { name: 'Arbitrum One',       chainId: 42161,  rpcUrl: 'https://arb1.arbitrum.io/rpc',                     symbol: 'ETH',   decimals: 18, explorerUrl: 'https://arbiscan.io' },
  { name: 'Optimism',           chainId: 10,     rpcUrl: 'https://mainnet.optimism.io',                      symbol: 'ETH',   decimals: 18, explorerUrl: 'https://optimistic.etherscan.io' },
  { name: 'Polygon',            chainId: 137,    rpcUrl: 'https://polygon-rpc.com',                          symbol: 'POL',   decimals: 18, explorerUrl: 'https://polygonscan.com' },
  { name: 'BNB Smart Chain',    chainId: 56,     rpcUrl: 'https://bsc-dataseed.binance.org',                 symbol: 'BNB',   decimals: 18, explorerUrl: 'https://bscscan.com' },
  { name: 'Avalanche C-Chain',  chainId: 43114,  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',            symbol: 'AVAX',  decimals: 18, explorerUrl: 'https://snowtrace.io' },
  { name: 'zkSync Era',         chainId: 324,    rpcUrl: 'https://mainnet.era.zksync.io',                    symbol: 'ETH',   decimals: 18, explorerUrl: 'https://explorer.zksync.io' },
  { name: 'Linea',              chainId: 59144,  rpcUrl: 'https://rpc.linea.build',                          symbol: 'ETH',   decimals: 18, explorerUrl: 'https://lineascan.build' },
  { name: 'Fantom',             chainId: 250,    rpcUrl: 'https://rpc.ftm.tools',                            symbol: 'FTM',   decimals: 18, explorerUrl: 'https://ftmscan.com' },
  { name: 'Celo',               chainId: 42220,  rpcUrl: 'https://forno.celo.org',                           symbol: 'CELO',  decimals: 18, explorerUrl: 'https://celoscan.io' },
  { name: 'Moonbeam',           chainId: 1284,   rpcUrl: 'https://rpc.api.moonbeam.network',                 symbol: 'GLMR',  decimals: 18, explorerUrl: 'https://moonscan.io' },
  { name: 'Moonriver',          chainId: 1285,   rpcUrl: 'https://rpc.api.moonriver.moonbeam.network',       symbol: 'MOVR',  decimals: 18, explorerUrl: 'https://moonriver.moonscan.io' },
  { name: 'Cronos',             chainId: 25,     rpcUrl: 'https://evm.cronos.org',                           symbol: 'CRO',   decimals: 18, explorerUrl: 'https://cronoscan.com' },
  { name: 'Metis',              chainId: 1088,   rpcUrl: 'https://andromeda.metis.io/?owner=1088',           symbol: 'METIS', decimals: 18, explorerUrl: 'https://andromeda-explorer.metis.io' },
];

@Component({
  selector: 'app-add-custom-network-flow-page',
  standalone: true,
  imports: [CommonModule, FormsModule, KcButtonComponent, KcInputComponent, KcDropdownSelectComponent],
  templateUrl: './add-custom-network-flow-page.component.html',
  styleUrl: './add-custom-network-flow-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class AddCustomNetworkFlowPageComponent {
  private chainManager = inject(EthereumWalletChainManager);
  private flowPagesService = inject(FlowPagesService);
  private notificationService = inject(NotificationService);

  networkName = signal('');
  chainId = signal('');
  rpcUrl = signal('');
  currencySymbol = signal('');
  currencyDecimals = signal('18');
  explorerUrl = signal('');

  isSaving = signal(false);
  submitted = signal(false);
  selectedPresetChainId = signal<number | null>(null);

  protected readonly presetOptions: DropdownOption[] = WELL_KNOWN_NETWORKS.map(n => ({
    value: n.chainId,
    label: n.name,
  }));

  private urlPattern = /^https?:\/\/.+/;

  isChainIdValid = computed(() => {
    const val = this.chainId().trim();
    if (!val) return false;
    const num = Number(val);
    return Number.isSafeInteger(num) && num > 0;
  });

  isRpcUrlValid = computed(() => this.urlPattern.test(this.rpcUrl().trim()));

  isExplorerUrlValid = computed(() => {
    const val = this.explorerUrl().trim();
    return !val || this.urlPattern.test(val);
  });

  isDecimalsValid = computed(() => {
    const val = Number(this.currencyDecimals());
    return Number.isInteger(val) && val >= 0 && val <= 36;
  });

  isFormValid = computed(() =>
    !!this.networkName().trim() &&
    this.isChainIdValid() &&
    this.isRpcUrlValid() &&
    !!this.currencySymbol().trim() &&
    this.isDecimalsValid() &&
    this.isExplorerUrlValid()
  );

  chainIdError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.chainId().trim()) return 'Chain ID is required';
    return this.isChainIdValid() ? '' : 'Must be a positive safe integer';
  });

  rpcUrlError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.rpcUrl().trim()) return 'RPC URL is required';
    return this.isRpcUrlValid() ? '' : 'Must be a valid URL (http:// or https://)';
  });

  explorerUrlError = computed(() => {
    if (!this.submitted() || !this.explorerUrl().trim()) return '';
    return this.isExplorerUrlValid() ? '' : 'Must be a valid URL (http:// or https://)';
  });

  decimalsError = computed(() => {
    if (!this.submitted()) return '';
    return this.isDecimalsValid() ? '' : 'Must be a number between 0 and 36';
  });

  getPresetNetworkIcon(chainId: number): string | null {
    const hex = `0x${chainId.toString(16)}`;
    return CHAIN_ID_LOGOS[hex] || null;
  }

  onPresetSelected(chainId: number): void {
    const preset = WELL_KNOWN_NETWORKS.find(n => n.chainId === chainId);
    if (!preset) return;
    this.selectedPresetChainId.set(chainId);
    this.networkName.set(preset.name);
    this.chainId.set(String(preset.chainId));
    this.rpcUrl.set(preset.rpcUrl);
    this.currencySymbol.set(preset.symbol);
    this.currencyDecimals.set(String(preset.decimals));
    this.explorerUrl.set(preset.explorerUrl);
  }

  onSave(): void {
    this.submitted.set(true);
    if (!this.isFormValid()) return;

    const hexChainId = `0x${Number(this.chainId().trim()).toString(16)}`;

    const allChains = this.chainManager.getAllChainsByChainId();
    if (allChains[hexChainId]) {
      this.notificationService.error('Network Exists', 'A network with this Chain ID is already added.');
      return;
    }

    const symbol = this.currencySymbol().trim().toUpperCase();
    const chain: ExtendedEIP1193ProviderChain = {
      chainId: hexChainId,
      chainName: this.networkName().trim(),
      nativeCurrency: {
        name: symbol,
        symbol,
        decimals: Number(this.currencyDecimals()),
      },
      rpcUrls: [this.rpcUrl().trim()],
      blockExplorerUrls: this.explorerUrl().trim() ? [this.explorerUrl().trim()] : [],
    };

    this.isSaving.set(true);
    try {
      this.chainManager.addChain(chain);
      this.notificationService.success('Network Added', `${chain.chainName} has been added.`);
      this.flowPagesService.navigateBack();
    } catch {
      this.notificationService.error('Error', 'Failed to add network. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel(): void {
    this.flowPagesService.navigateBack();
  }
}
