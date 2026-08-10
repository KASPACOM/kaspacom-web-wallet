import { Injectable, signal } from '@angular/core';

export type ContractsRegistryRefreshReason = 'saved' | 'indexed';

@Injectable({
  providedIn: 'root',
})
export class ContractsRegistryRefreshService {
  private refreshVersion = signal(0);

  readonly changes = this.refreshVersion.asReadonly();

  notify(_reason: ContractsRegistryRefreshReason): void {
    this.refreshVersion.update((version) => version + 1);
  }
}
