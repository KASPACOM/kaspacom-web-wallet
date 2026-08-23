import { Injectable } from '@angular/core';
import { WalletDB } from '../../db/wallet-db.service';
import type { ContractRegistryEntry } from '../../db/dtos/contract-registry-entry';
export type {
  ContractRegistryEntry,
  ContractStatus,
} from '../../db/dtos/contract-registry-entry';

@Injectable({
  providedIn: 'root',
})
export class ContractRegistryService {
  private readonly STORAGE_KEY = 'kaspacom_contracts_registry';

  constructor(private db: WalletDB) {}

  /**
   * Get all contracts from IndexedDB.
   */
  async getAllContracts(): Promise<ContractRegistryEntry[]> {
    try {
      return this.sanitizeContracts(await this.db.contractRegistry.toArray());
    } catch (error) {
      console.error('Error reading contracts registry:', error);
      return [];
    }
  }

  /**
   * Get a contract by ID
   */
  async getContract(id: string): Promise<ContractRegistryEntry | undefined> {
    const contract = await this.db.contractRegistry.get(id);
    return this.isValidContract(contract) ? contract : undefined;
  }

  /**
   * Add a new contract to the registry
   */
  async addContract(contract: ContractRegistryEntry): Promise<void> {
    try {
      await this.db.contractRegistry.put(contract);
    } catch (error) {
      console.error('Error saving contract to registry:', error);
      throw error;
    }
  }

  /**
   * Update an existing contract
   */
  async updateContract(
    id: string,
    updates: Partial<ContractRegistryEntry>,
  ): Promise<void> {
    try {
      await this.db.contractRegistry.update(id, updates);
    } catch (error) {
      console.error('Error updating contract in registry:', error);
      throw error;
    }
  }

  /**
   * Delete a contract from the registry
   */
  async deleteContract(id: string): Promise<void> {
    try {
      await this.db.contractRegistry.delete(id);
    } catch (error) {
      console.error('Error deleting contract from registry:', error);
      throw error;
    }
  }

  /**
   * Get contracts deployed by a specific account (by pubkey)
   */
  async getContractsByPubkey(pubkey: string): Promise<ContractRegistryEntry[]> {
    return (await this.getAllContracts()).filter(
      (c) => c.deployedBy.pubkey === pubkey,
    );
  }

  /**
   * Get contracts by network
   */
  async getContractsByNetwork(
    network: string,
  ): Promise<ContractRegistryEntry[]> {
    return (await this.getAllContracts()).filter((c) => c.network === network);
  }

  /**
   * Generate a UUID
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  async migrateContractsRegistryFromLocalStorage(): Promise<void> {
    let data: string | null = null;
    try {
      data = localStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error reading legacy contracts registry:', error);
      return;
    }

    if (!data) return;

    try {
      const parsed = JSON.parse(data);
      const contracts = this.sanitizeContracts(parsed);
      if (contracts.length) {
        await this.db.contractRegistry.bulkPut(contracts);
      }
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error migrating contracts registry to IndexedDB:', error);
      throw error;
    }
  }

  private sanitizeContracts(data: unknown): ContractRegistryEntry[] {
    if (!Array.isArray(data)) return [];
    // Drop entries missing fields the consumers dereference, so a corrupt or
    // older-schema record can't crash the contracts UI.
    return data.filter((c): c is ContractRegistryEntry =>
      this.isValidContract(c),
    );
  }

  private isValidContract(c: unknown): c is ContractRegistryEntry {
    return (
      !!c &&
      typeof c === 'object' &&
      typeof (c as any).id === 'string' &&
      typeof (c as any).compiledJson === 'string' &&
      !!(c as any).outpoint &&
      typeof (c as any).outpoint.txid === 'string' &&
      !!(c as any).deployedBy &&
      typeof (c as any).deployedBy.pubkey === 'string' &&
      typeof (c as any).network === 'string'
    );
  }
}
