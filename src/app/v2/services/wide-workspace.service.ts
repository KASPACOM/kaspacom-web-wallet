import { Injectable, signal, computed } from '@angular/core';

/**
 * Tracks whether a "wide workspace" view (currently only Contracts) is
 * mounted. Driven by the consuming component's own lifecycle rather than
 * flow-page config, since Contracts can mount either via FlowPagesService
 * (home tile) or directly via router-outlet (share links) — a counter
 * guards against double-activation races across those two paths.
 */
@Injectable({ providedIn: 'root' })
export class WideWorkspaceService {
  private readonly activeCount = signal(0);

  readonly isActive = computed(() => this.activeCount() > 0);

  activate(): void {
    this.activeCount.update((n) => n + 1);
  }

  deactivate(): void {
    this.activeCount.update((n) => Math.max(0, n - 1));
  }
}
