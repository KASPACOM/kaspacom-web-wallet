import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface KaspaNetworkConfig {
  id: string;           // e.g. 'mainnet', 'testnet-10', 'testnet-12'
  name: string;         // Display name: 'Mainnet', 'Testnet 10', 'Testnet 12'
  networkId: string;    // WASM SDK network id: 'mainnet', 'testnet-10', 'testnet-12'
  wrpcUrl: string;      // '' = use Resolver (auto), or hostname like 'tn12-node.kaspa.com'
  useResolver: boolean; // true = auto-discover via Resolver, false = use wrpcUrl
  kaspaApiBaseurl: string;
  kaspaExplorerBaseurl: string;
  kasplexApiBaseurl: string;      // empty string if not available
  krc721ApiBaseurl: string;       // empty string if not available  
  krc721CacheStreamUrl: string;   // empty string if not available
  knsApiBaseurl: string;          // empty string if not available
  isCustom: boolean;    // false for presets, true for user-added
}

const PRESET_NETWORKS: KaspaNetworkConfig[] = [
  {
    id: 'mainnet',
    name: 'Mainnet',
    networkId: 'mainnet',
    wrpcUrl: '',
    useResolver: true,
    kaspaApiBaseurl: 'https://api.kaspa.org',
    kaspaExplorerBaseurl: 'https://explorer.kaspa.org',
    kasplexApiBaseurl: 'https://api.kasplex.org/v1',
    krc721ApiBaseurl: 'https://mainnet.krc721.stream/api/v1/krc721/mainnet',
    krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/mainnet',
    knsApiBaseurl: 'https://api.knsdomains.org/mainnet',
    isCustom: false,
  },
  {
    id: 'testnet-10',
    name: 'Testnet 10',
    networkId: 'testnet-10',
    wrpcUrl: '',
    useResolver: true,
    kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
    kaspaExplorerBaseurl: 'https://explorer-tn10.kaspa.org',
    kasplexApiBaseurl: 'https://tn10api.kasplex.org/v1',
    krc721ApiBaseurl: 'https://testnet-10.krc721.stream/api/v1/krc721/testnet-10',
    krc721CacheStreamUrl: 'https://cache.krc721.stream/krc721/testnet-10',
    knsApiBaseurl: 'https://api.knsdomains.org/tn10',
    isCustom: false,
  },
  {
    id: 'testnet-12',
    name: 'Testnet 12',
    networkId: 'testnet-12',
    wrpcUrl: 'tn12-node.kaspa.com',
    useResolver: false,
    kaspaApiBaseurl: 'https://api-tn12.kaspa.org',
    kaspaExplorerBaseurl: 'https://tn12.kaspa.stream',
    kasplexApiBaseurl: '',
    krc721ApiBaseurl: '',
    krc721CacheStreamUrl: '',
    knsApiBaseurl: '',
    isCustom: false,
  },
];

const STORAGE_KEY_SELECTED = 'kaspacom_selected_network';
const STORAGE_KEY_CUSTOM = 'kaspacom_custom_networks';

@Injectable({
  providedIn: 'root',
})
export class NetworkConfigService {
  private activeNetworkSignal: WritableSignal<KaspaNetworkConfig>;
  private customNetworks: KaspaNetworkConfig[] = [];

  constructor() {
    // Load custom networks from localStorage
    this.loadCustomNetworks();

    // Load selected network from localStorage, or use environment default
    const savedNetworkId = localStorage.getItem(STORAGE_KEY_SELECTED);
    const defaultNetwork = this.findNetworkById(savedNetworkId || environment.kaspaNetwork) 
      || PRESET_NETWORKS[0];

    this.activeNetworkSignal = signal(defaultNetwork);
  }

  /**
   * Get the currently active network configuration
   */
  getActiveNetwork(): KaspaNetworkConfig {
    return this.activeNetworkSignal();
  }

  /**
   * Get a read-only signal for reactive updates
   */
  getActiveNetworkSignal() {
    return this.activeNetworkSignal.asReadonly();
  }

  /**
   * Set the active network by ID
   */
  setActiveNetwork(id: string): void {
    const network = this.findNetworkById(id);
    if (!network) {
      throw new Error(`Network with id '${id}' not found`);
    }

    localStorage.setItem(STORAGE_KEY_SELECTED, id);
    this.activeNetworkSignal.set(network);

    // Trigger RPC reconnect - consumers should subscribe to the signal
  }

  /**
   * Get all available networks (presets + custom)
   * In production: only mainnet
   * In dev: all networks
   */
  getAllNetworks(): KaspaNetworkConfig[] {
    if (environment.isProduction) {
      // Only mainnet in production
      return PRESET_NETWORKS.filter(n => n.id === 'mainnet');
    }
    return [...PRESET_NETWORKS, ...this.customNetworks];
  }

  /**
   * Get only preset networks (filtered by environment)
   */
  getPresetNetworks(): KaspaNetworkConfig[] {
    if (environment.isProduction) {
      return PRESET_NETWORKS.filter(n => n.id === 'mainnet');
    }
    return PRESET_NETWORKS;
  }

  /**
   * Get only custom networks (only in dev)
   */
  getCustomNetworks(): KaspaNetworkConfig[] {
    if (environment.isProduction) {
      return [];
    }
    return this.customNetworks;
  }

  /**
   * Check if network switching is allowed (dev only)
   */
  isNetworkSwitchingAllowed(): boolean {
    return !environment.isProduction;
  }

  /**
   * Add a custom network (dev only)
   */
  addCustomNetwork(config: KaspaNetworkConfig): void {
    if (environment.isProduction) {
      throw new Error('Custom networks are only available in development mode');
    }

    // Ensure it's marked as custom
    config.isCustom = true;

    // Check for duplicate IDs
    if (this.findNetworkById(config.id)) {
      throw new Error(`Network with id '${config.id}' already exists`);
    }

    this.customNetworks.push(config);
    this.saveCustomNetworks();
  }

  /**
   * Remove a custom network (dev only)
   */
  removeCustomNetwork(id: string): void {
    if (environment.isProduction) {
      throw new Error('Custom networks are only available in development mode');
    }

    const index = this.customNetworks.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Custom network with id '${id}' not found`);
    }

    this.customNetworks.splice(index, 1);
    this.saveCustomNetworks();

    // If the removed network was active, switch to mainnet
    if (this.activeNetworkSignal().id === id) {
      this.setActiveNetwork('mainnet');
    }
  }

  /**
   * Update an existing network (preset or custom)
   * Used for editing WRPC URL or other fields
   */
  updateNetwork(id: string, partial: Partial<KaspaNetworkConfig>): void {
    const network = this.findNetworkById(id);
    if (!network) {
      throw new Error(`Network with id '${id}' not found`);
    }

    // Don't allow changing id or isCustom flag
    delete partial.id;
    delete partial.isCustom;

    // Update the network
    Object.assign(network, partial);

    // If it's a custom network, save to localStorage
    if (network.isCustom) {
      this.saveCustomNetworks();
    }

    // If this is the active network, update the signal
    if (this.activeNetworkSignal().id === id) {
      this.activeNetworkSignal.set({ ...network });
    }
  }

  /**
   * Get a specific API URL from the active network
   */
  getApiUrl(key: keyof KaspaNetworkConfig): string {
    const value = this.activeNetworkSignal()[key];
    return typeof value === 'string' ? value : '';
  }

  private findNetworkById(id: string): KaspaNetworkConfig | undefined {
    return this.getAllNetworks().find(n => n.id === id);
  }

  private loadCustomNetworks(): void {
    if (environment.isProduction) {
      this.customNetworks = [];
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (stored) {
      try {
        this.customNetworks = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse custom networks from localStorage:', e);
        this.customNetworks = [];
      }
    }
  }

  private saveCustomNetworks(): void {
    if (environment.isProduction) {
      return;
    }
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(this.customNetworks));
  }
}
