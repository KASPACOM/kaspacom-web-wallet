import { Injectable, signal, computed } from '@angular/core';
import { QuickActionDialogId } from '../pages/app/common/quick-action-dialog/quick-action-dialog.registry';

export interface IQuickActionDialogConfig {
  id: QuickActionDialogId;
  title?: string;
  isCloseable?: boolean;
  data?: any;
}

@Injectable({
  providedIn: 'root',
})
export class QuickActionDialogService {
  private currentDialogConfigSignal = signal<IQuickActionDialogConfig | null>(
    null,
  );

  // Computed properties for reactive UI updates
  activeDialog = computed(() => this.currentDialogConfigSignal());
  isAnyDialogOpen = computed(() => this.currentDialogConfigSignal() !== null);

  /**
   * Opens a new dialog. If another dialog is already open, it will be replaced.
   */
  openDialog(config: IQuickActionDialogConfig): void {
    // Always replace any existing dialog (as per requirement)
    this.currentDialogConfigSignal.set(config);
  }

  /**
   * Updates the current dialog configuration
   */
  updateDialog(config: Partial<IQuickActionDialogConfig>): void {
    const currentConfig = this.currentDialogConfigSignal();
    if (currentConfig) {
      this.currentDialogConfigSignal.set({
        ...currentConfig,
        ...config,
      });
    }
  }

  /**
   * Closes the current dialog
   */
  closeDialog(): void {
    this.currentDialogConfigSignal.set(null);
  }

  /**
   * Gets the current dialog configuration
   */
  getCurrentDialog(): IQuickActionDialogConfig | null {
    return this.activeDialog();
  }
}
