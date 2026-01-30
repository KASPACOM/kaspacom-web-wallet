import { Injectable, signal, computed, inject } from '@angular/core';
import { WalletAction, WalletActionType } from '../../types/wallet-action';
import { FlowPagesService } from './flow-pages.service';
import { Router } from '@angular/router';
import { WalletActionResult, EIP1193RequestPayload, EIP1193RequestType } from '@kaspacom/wallet-messages';

export enum ApprovalDisplayMode {
  FLOW_PAGE = 'flow_page', // For regular app usage - integrated flow
  MODAL_DIALOG = 'modal_dialog', // For iframe usage - modal overlay
  FULL_PAGE = 'full_page', // For legacy/route-based usage
}

export enum ApprovalFlowState {
  APPROVAL = 'approval', // Showing approval form
  PROCESSING = 'processing', // Loading/processing transaction
  SUCCESS = 'success', // Showing success page
  ERROR = 'error', // Showing error page
}

export interface ApprovalFlowConfig {
  mode: ApprovalDisplayMode;
  action: WalletAction;
  isFromIframe?: boolean;
  state?: ApprovalFlowState;
  progress?: number;
  result?: WalletActionResult;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApprovalFlowService {
  private flowPagesService = inject(FlowPagesService);
  private router = inject(Router);

  private currentApprovalConfigSignal = signal<ApprovalFlowConfig | null>(null);

  // Computed properties
  currentApprovalConfig = computed(() => this.currentApprovalConfigSignal());
  isApprovalActive = computed(
    () => this.currentApprovalConfigSignal() !== null,
  );
  currentState = computed(
    () =>
      this.currentApprovalConfigSignal()?.state || ApprovalFlowState.APPROVAL,
  );
  currentProgress = computed(
    () => this.currentApprovalConfigSignal()?.progress || 0,
  );

  // Resolve function for the current approval
  private currentResolve:
    | ((result: {
        isApproved: boolean;
        priorityFee?: bigint;
        additionalParams?: { [key: string]: any };
      }) => void)
    | null = null;

  // Signal to track completion events for components to listen to
  private completionSignal = signal<{
    success: boolean;
    result?: WalletActionResult;
  } | null>(null);

  // Public computed for components to observe completion
  completion = computed(() => this.completionSignal());

  /**
   * Shows approval dialog using the appropriate display mode
   */
  async showApproval(
    action: WalletAction,
    isFromIframe: boolean = false,
  ): Promise<{
    isApproved: boolean;
    priorityFee?: bigint;
    additionalParams?: { [key: string]: any };
  }> {
    // Determine display mode based on context
    const mode = this.determineDisplayMode(isFromIframe);

    const config: ApprovalFlowConfig = {
      mode,
      action,
      isFromIframe,
      state: ApprovalFlowState.APPROVAL,
    };

    // Clear any existing approval
    if (this.currentResolve) {
      this.currentResolve({ isApproved: false });
    }

    this.currentApprovalConfigSignal.set(config);

    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.displayApproval(config);
    });
  }

  /**
   * Resolves the current approval with the given result
   */
  resolveApproval(result: {
    isApproved: boolean;
    priorityFee?: bigint;
    additionalParams?: { [key: string]: any };
  }) {
    if (this.currentResolve) {
      this.currentResolve(result);
      this.currentResolve = null;
    }

    // Don't cleanup if approval was accepted - we'll transition to processing state
    if (!result.isApproved) {
      this.cleanupApproval();
    }
  }

  /**
   * Updates the flow state to processing/loading
   */
  setProcessingState(progress: number = 0) {
    const config = this.currentApprovalConfigSignal();
    if (config) {
      const newConfig = {
        ...config,
        state: ApprovalFlowState.PROCESSING,
        progress,
      };
      this.currentApprovalConfigSignal.set(newConfig);

      // Update flow page configuration to disable back navigation
      if (config.mode === ApprovalDisplayMode.FLOW_PAGE) {
        this.updateFlowPageConfig(newConfig);
      }
    }
  }

  /**
   * Updates the flow state to success with transaction result
   */
  setSuccessState(result: WalletActionResult) {
    const config = this.currentApprovalConfigSignal();
    if (config) {
      // Add a 600ms delay before showing the success page
      setTimeout(() => {
        const newConfig = {
          ...config,
          state: ApprovalFlowState.SUCCESS,
          result,
          progress: 100,
        };
        this.currentApprovalConfigSignal.set(newConfig);

        // Update flow page configuration to disable back navigation
        if (config.mode === ApprovalDisplayMode.FLOW_PAGE) {
          this.updateFlowPageConfig(newConfig);
        }

        // Emit completion event for components to listen to
        this.completionSignal.set({ success: true, result });
      }, 1000);
    }
  }

  /**
   * Updates the flow state to error
   */
  setErrorState(error: string) {
    const config = this.currentApprovalConfigSignal();
    if (config) {
      this.currentApprovalConfigSignal.set({
        ...config,
        state: ApprovalFlowState.ERROR,
        error,
      });

      // Emit completion event for components to listen to
      this.completionSignal.set({ success: false });
    }
  }

  /**
   * Updates processing progress
   */
  updateProgress(progress: number) {
    const config = this.currentApprovalConfigSignal();
    if (config && config.state === ApprovalFlowState.PROCESSING) {
      this.currentApprovalConfigSignal.set({
        ...config,
        progress,
      });
    }
  }

  /**
   * Closes the current approval flow
   */
  closeApproval() {
    // Clear completion signal
    this.completionSignal.set(null);
    this.cleanupApproval();
  }

  private determineDisplayMode(isFromIframe: boolean): ApprovalDisplayMode {
    if (isFromIframe) {
      return ApprovalDisplayMode.MODAL_DIALOG;
    }

    // For regular app usage, use flow pages
    return ApprovalDisplayMode.FLOW_PAGE;
  }

  private displayApproval(config: ApprovalFlowConfig) {
    switch (config.mode) {
      case ApprovalDisplayMode.FLOW_PAGE:
        this.showAsFlowPage(config);
        break;
      case ApprovalDisplayMode.MODAL_DIALOG:
        // The modal will be handled by the existing review-action component
        // which is already included in app-wrapper.component.html
        break;
      case ApprovalDisplayMode.FULL_PAGE:
        this.showAsFullPage(config);
        break;
    }
  }

  private showAsFlowPage(config: ApprovalFlowConfig) {
    this.flowPagesService.openFlow({
      id: 'action-approval',
      title: this.getApprovalTitle(config.action),
      canNavigateBack: config.state === ApprovalFlowState.APPROVAL,
      showTitle: config.state === ApprovalFlowState.APPROVAL,
      showBackground: config.state === ApprovalFlowState.APPROVAL,
    });
  }

  private showAsFullPage(config: ApprovalFlowConfig) {
    this.router.navigate(['/review-action']);
  }

  /**
   * Updates the flow page configuration when approval state changes
   */
  private updateFlowPageConfig(config: ApprovalFlowConfig) {
    this.flowPagesService.navigateToPage({
      id: 'action-approval',
      title: this.getApprovalTitle(config.action),
      canNavigateBack: config.state === ApprovalFlowState.APPROVAL,
      showTitle: config.state === ApprovalFlowState.APPROVAL,
      showBackground: config.state === ApprovalFlowState.APPROVAL,
    });
  }

  private cleanupApproval() {
    const config = this.currentApprovalConfigSignal();
    if (config) {
      this.cleanupByMode(config.mode);
    }

    this.currentApprovalConfigSignal.set(null);
  }

  private cleanupByMode(mode: ApprovalDisplayMode) {
    switch (mode) {
      case ApprovalDisplayMode.FLOW_PAGE:
        this.flowPagesService.closePage();
        break;
      case ApprovalDisplayMode.MODAL_DIALOG:
        // Modal cleanup handled by review-action component
        break;
      case ApprovalDisplayMode.FULL_PAGE:
        // Navigation handled by router
        break;
    }
  }

  private getApprovalTitle(action: WalletAction): string {
    switch (action.type) {
      case WalletActionType.TRANSFER_KAS:
        return 'Send Kaspa';
      case WalletActionType.COMMIT_REVEAL:
        return 'Confirm Action';
      case WalletActionType.SIGN_MESSAGE:
        return 'Sign Message';
      case WalletActionType.SIGN_PSKT_TRANSACTION:
        return 'Sign Transaction';
      case WalletActionType.EIP1193_PROVIDER_REQUEST:
        const eipData = action.data as EIP1193RequestPayload<EIP1193RequestType>;
        switch (eipData.method) {
          case EIP1193RequestType.SEND_TRANSACTION:
          case EIP1193RequestType.KAS_SEND_TRANSACTION:
            return 'Send Transaction';
          case EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN:
            return 'Add Network';
          case EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN:
            return 'Switch Network';
          case EIP1193RequestType.SIGN_TYPED_DATA:
          case EIP1193RequestType.SIGN_TYPED_DATA_V4:
            return 'Sign Message';
          default:
            return 'L2 Action';
        }
      default:
        return 'Confirm Action';
    }
  }
}
