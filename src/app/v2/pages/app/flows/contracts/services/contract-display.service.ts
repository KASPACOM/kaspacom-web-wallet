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
