import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RpcService } from '../../../../../../services/kaspa-netwrok-services/rpc.service';
import { KaspaL1NetworkService } from '../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { ContractDashboardEntry } from '../contracts-page.models';

/**
 * Pure display/formatting helpers for the Contracts page — no state, safe to
 * inject anywhere a contract needs to be rendered (dashboard, detail, deploy
 * result, share links).
 */
@Injectable({
  providedIn: 'root',
})
export class ContractDisplayService {
  private rpcService = inject(RpcService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Get explorer link for address
   */
  getExplorerAddressLink(address: string): string {
    return `${this.kaspaL1NetworkService.getKaspaExplorerBaseurl()}/addresses/${address}`;
  }

  /**
   * Get explorer link for transaction
   */
  getExplorerLink(txid: string): string {
    const covenantExplorerBaseurl =
      this.kaspaL1NetworkService.getCovenantExplorerBaseurl();
    if (covenantExplorerBaseurl) {
      return `${covenantExplorerBaseurl}/tx/${txid}`;
    }
    return `${this.kaspaL1NetworkService.getKaspaExplorerBaseurl()}/txs/${txid}`;
  }

  /**
   * Get covenant explorer link for a covenant ID (covenants.kaspa.com), if the current network has one configured
   */
  getCovenantExplorerLink(covenantId: string): string | undefined {
    const covenantExplorerBaseurl =
      this.kaspaL1NetworkService.getCovenantExplorerBaseurl();
    return covenantExplorerBaseurl
      ? `${covenantExplorerBaseurl}/covenants/${covenantId}`
      : undefined;
  }

  /**
   * Truncate string for display
   */
  truncate(str: string | null | undefined, length: number = 16): string {
    const value = String(str ?? '');
    if (value.length <= length) return value;
    return (
      value.substring(0, length) + '...' + value.substring(value.length - 6)
    );
  }

  /**
   * Format sompi to KAS
   */
  formatSompiToKas(sompi: string): string {
    try {
      const kas = Number(BigInt(String(sompi || '0'))) / 1e8;
      return kas.toFixed(8).replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  }

  getSourceLabel(contract: ContractDashboardEntry): string {
    return this.getSourceLabels(contract).join(' + ');
  }

  getSourceLabels(contract: ContractDashboardEntry): string[] {
    if (contract.source === 'both') return ['Local', 'Indexer'];
    return [contract.source === 'indexer' ? 'Indexer' : 'Local'];
  }

  getStatusLabel(contract: ContractDashboardEntry): string {
    const labels: Record<ContractDashboardEntry['status'], string> = {
      active: 'Active',
      spent: 'Spent',
      unknown: 'Unknown',
      'tracking-incomplete': 'Tracking incomplete',
    };
    return labels[contract.status] || 'Unknown';
  }

  formatTimestamp(value: number | undefined | null): string {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  }

  formatActionName(action: string): string {
    const labels: Record<string, string> = {
      deploy: 'Deploy',
      spend: 'Spend',
      continuation: 'Continuation',
      keepAlive: 'Keep Alive',
      claim: 'Claim',
      spend12: 'MultiSig Spend',
      release: 'Release',
      refund: 'Refund',
      arbitrate: 'Arbitrate',
      recover: 'Recover',
      withdraw: 'Withdraw',
      unvault: 'Start Unvault',
      emergencySweep: 'Emergency Sweep',
      finalize: 'Finalize',
    };
    return labels[action] || action;
  }

  /**
   * Canonicalize a contract/template name so aliases from different sources
   * (indexer, on-chain ABI, template picker) compare equal — e.g. "Escrow"
   * and "EscrowWithArbiter" both normalize to "EscrowWithArbiter".
   */
  normalizeContractName(name: string): string {
    const normalized = String(name || '').replace(/[^a-zA-Z0-9]/g, '');
    const aliases: Record<string, string> = {
      DeadMansSwitch: 'DeadManSwitch',
      "DeadMan'sSwitch": 'DeadManSwitch',
      TimeLockVault: 'TimeLockVault',
      MultiSigVault: 'MultiSigVault',
      Escrow: 'EscrowWithArbiter',
      SelfCustody: 'SelfCustodyVault',
      SelfCustodyVault: 'SelfCustodyVault',
    };
    return aliases[normalized] || normalized;
  }

  /**
   * Classify a template or dashboard entry into the small set of icon/accent
   * keys the UI switches on. Accepts either a ContractTemplate (keyed by
   * `id`) or a ContractDashboardEntry (keyed by `contractName`/`name`).
   */
  getTemplateKey(
    input: any,
  ): 'deadman' | 'timelock' | 'multisig' | 'escrow' | 'default' {
    // ContractTemplate.id on the Create / Templates tabs.
    switch (input?.id) {
      case 'dead-mans-switch':
        return 'deadman';
      case 'time-lock-vault':
        return 'timelock';
      case 'multi-sig-vault':
        return 'multisig';
      case 'escrow-with-arbiter':
        return 'escrow';
      case 'self-custody-vault':
        return 'default';
    }
    switch (this.normalizeContractName(input?.contractName ?? input?.name ?? '')) {
      case 'DeadManSwitch':
        return 'deadman';
      case 'TimeLockVault':
        return 'timelock';
      case 'MultiSigVault':
        return 'multisig';
      case 'EscrowWithArbiter':
        return 'escrow';
      default:
        return 'default';
    }
  }

  /**
   * Builds a share link that carries only the network and canonical covenant
   * ID — never private data or compiled JSON. The receiving wallet imports
   * current state from the indexer when the link is opened.
   */
  buildShareLink(covenantId: string): string {
    if (!this.isBrowser) return '';
    const url = new URL(
      `${window.location.origin}/app/contracts/${covenantId}`,
    );
    url.searchParams.set('network', this.rpcService.getNetwork());
    return url.toString();
  }
}
