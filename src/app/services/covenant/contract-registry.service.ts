import { Injectable } from '@angular/core';

export type ContractStatus = 'active' | 'spent' | 'unknown';

export interface ContractRegistryEntry {
  id: string; // uuid
  contractName: string;
  compiledJson: string; // full JSON for re-interaction
  deployTxid: string;
  contractAddress: string;
  outpoint: { txid: string; vout: number };
  amountSompi: string; // bigint as string
  deployedBy: { address: string; pubkey: string; accountName: string };
  deployedAt: number; // timestamp
  network: string;
  status?: ContractStatus; // on-chain status
  lastChecked?: number; // timestamp of last status check
  spendTxid?: string; // TX that spent this contract
  // Parsed access info
  accessRoles: Array<{
    functionName: string;
    params: Array<{ name: string; type: string }>;
    description: string; // human readable like "Owner can spend"
  }>;
  covenantId?: string;
  /** ID of the registry entry that this contract continues (keepAlive chain) */
  predecessorId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ContractRegistryService {
  private readonly STORAGE_KEY = 'kaspacom_contracts_registry';

  /**
   * Get all contracts from localStorage
   */
  getAllContracts(): ContractRegistryEntry[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Drop entries missing fields the consumers dereference, so a corrupt or
      // older-schema record can't crash the contracts UI.
      return parsed.filter(
        (c: any) =>
          c &&
          typeof c === 'object' &&
          typeof c.id === 'string' &&
          typeof c.compiledJson === 'string' &&
          c.outpoint &&
          typeof c.outpoint.txid === 'string' &&
          c.deployedBy &&
          typeof c.deployedBy.pubkey === 'string' &&
          typeof c.network === 'string',
      );
    } catch (error) {
      console.error('Error reading contracts registry:', error);
      return [];
    }
  }

  /**
   * Get a contract by ID
   */
  getContract(id: string): ContractRegistryEntry | undefined {
    return this.getAllContracts().find((c) => c.id === id);
  }

  /**
   * Add a new contract to the registry
   */
  addContract(contract: ContractRegistryEntry): void {
    try {
      const contracts = this.getAllContracts();
      contracts.push(contract);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contracts));
    } catch (error) {
      console.error('Error saving contract to registry:', error);
      throw error;
    }
  }

  /**
   * Update an existing contract
   */
  updateContract(id: string, updates: Partial<ContractRegistryEntry>): void {
    try {
      const contracts = this.getAllContracts();
      const index = contracts.findIndex((c) => c.id === id);
      if (index >= 0) {
        contracts[index] = { ...contracts[index], ...updates };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contracts));
      }
    } catch (error) {
      console.error('Error updating contract in registry:', error);
      throw error;
    }
  }

  /**
   * Delete a contract from the registry
   */
  deleteContract(id: string): void {
    try {
      const contracts = this.getAllContracts().filter((c) => c.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contracts));
    } catch (error) {
      console.error('Error deleting contract from registry:', error);
      throw error;
    }
  }

  /**
   * Get contracts deployed by a specific account (by pubkey)
   */
  getContractsByPubkey(pubkey: string): ContractRegistryEntry[] {
    return this.getAllContracts().filter((c) => c.deployedBy.pubkey === pubkey);
  }

  /**
   * Get contracts by network
   */
  getContractsByNetwork(network: string): ContractRegistryEntry[] {
    return this.getAllContracts().filter((c) => c.network === network);
  }

  /**
   * Generate a UUID
   */
  generateId(): string {
    return crypto.randomUUID();
  }
}
