import { Injectable, signal, computed, inject } from '@angular/core';
import { WalletAction, WalletActionType } from '../../types/wallet-action';
import { FlowPagesService } from './flow-pages.service';
import { Router } from '@angular/router';
import {
  WalletActionResult,
  EIP1193RequestPayload,
  EIP1193RequestType,
} from '@kaspacom/wallet-messages';

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

export type L2PriorityInfo = {
  baseFee: bigint;
  priorityFee: bigint;
  gasLimit: bigint;
};

export type PendingActionConfirmation = {
  status: 'checking' | 'confirmed' | 'unavailable' | 'timed-out';
  message: string;
};

export type ApprovalPageResultParams = {
  isApproved: boolean;
  priorityFee?: bigint;
  l2PriorityInfo?: L2PriorityInfo;
  additionalParams?: { [key: string]: any };
};

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
  private currentResolve: ((result: ApprovalPageResultParams) => void) | null =
    null;

  // Identifies the current approval instance so a deferred reject scheduled
  // for a detached page can detect that a newer approval has since started.
  private approvalInstanceCounter = 0;
  private currentApprovalInstanceId = 0;

  // Signal to track completion events for components to listen to
  private completionSignal = signal<{
    success: boolean;
    result?: WalletActionResult;
  } | null>(null);

  // Public computed for components to observe completion
  completion = computed(() => this.completionSignal());

  // Lets a flow (e.g. contracts page) report that the backend an action
  // depends on (the covenant indexer) hasn't caught up yet, so the success
  // page can hold the user on it instead of letting them navigate away
  // believing the change is already reflected everywhere.
  private pendingConfirmationSignal = signal<PendingActionConfirmation | null>(
    null,
  );
  pendingConfirmation = computed(() => this.pendingConfirmationSignal());
  private actionIndexingPollCounter = 0;
  private activeActionIndexingPollId: number | null = null;

  setPendingConfirmation(
    state: PendingActionConfirmation | null,
    pollId?: number,
  ) {
    if (pollId !== undefined && this.activeActionIndexingPollId !== pollId) {
      return;
    }
    this.pendingConfirmationSignal.set(state);
  }

  // The flow-page outlet destroys ContractsPageComponent the instant the
  // approval overlay covers it (see isContractsWide's comment in
  // app-wrapper.component.ts), so the action-indexing poll that started on
  // the old instance keeps running detached from any UI once the user
  // returns to "My Contracts" — a freshly-created instance's own initial
  // load has no idea that check is still in flight, and races ahead with
  // its own fetch, which is exactly the staleness the poll exists to avoid.
  // Tracking the poll's completion here, outside the component, lets that
  // new instance await it before doing its own first load instead of racing it.
  private actionIndexingCompletionSignal = signal<Promise<void> | null>(null);

  setActionIndexingCompletion(promise: Promise<void>): number {
    const pollId = ++this.actionIndexingPollCounter;
    this.activeActionIndexingPollId = pollId;
    this.actionIndexingCompletionSignal.set(promise);
    return pollId;
  }

  // A poll's own cleanup must not blindly null the signal: if the user
  // skipped/moved on and started a second covenant action before this poll
  // finished, the signal has since been overwritten with that newer poll's
  // promise — clearing unconditionally here would wipe that reference out
  // while the newer poll is still running, making the next
  // waitForActionIndexing() resolve immediately instead of waiting on it.
  // Only clear if the signal still holds the exact promise this poll set.
  clearActionIndexingCompletion(promise: Promise<void>, pollId: number) {
    if (
      this.activeActionIndexingPollId === pollId &&
      this.actionIndexingCompletionSignal() === promise
    ) {
      this.activeActionIndexingPollId = null;
      this.actionIndexingCompletionSignal.set(null);
    }
  }

  /** Resolves immediately if no action-indexing poll is in flight. */
  async waitForActionIndexing(): Promise<void> {
    await this.actionIndexingCompletionSignal();
  }

  // The success page's "Skip waiting" link dismisses the poll's blocking
  // effect without cancelling the poll itself (trackActionIndexingCore()
  // keeps running in the background and still updates the registry/
  // pendingConfirmation when it eventually settles). Clearing the signal
  // here just means the *next* waitForActionIndexing() call — from the
  // freshly re-created Contracts instance — resolves immediately instead of
  // waiting on a promise the user explicitly opted out of.
  skipActionIndexing() {
    this.activeActionIndexingPollId = null;
    this.actionIndexingCompletionSignal.set(null);
  }

  /**
   * Shows approval dialog using the appropriate display mode
   */
  async showApproval(
    action: WalletAction,
    isFromIframe: boolean = false,
  ): Promise<ApprovalPageResultParams> {
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
    this.currentApprovalInstanceId = ++this.approvalInstanceCounter;
    this.pendingConfirmationSignal.set(null);

    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.displayApproval(config);
    });
  }

  /**
   * Resolves the current approval with the given result
   */
  resolveApproval(result: ApprovalPageResultParams) {
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
    this.activeActionIndexingPollId = null;
    this.pendingConfirmationSignal.set(null);
    this.cleanupApproval();

    // Cancel any pending detach-reject timer — the approval is being closed
    // through the normal path, so the deferred reject from
    // notifyApprovalPageDetached() would otherwise fire later against a
    // stale instance and clear state it no longer owns.
    if (this.pendingDetachReject !== null) {
      clearTimeout(this.pendingDetachReject);
      this.pendingDetachReject = null;
    }
  }

  private pendingDetachReject: ReturnType<typeof setTimeout> | null = null;

  /**
   * Called by the approval flow page when it initializes. Cancels a reject
   * scheduled by a previous instance's destroy — the page was only relocated
   * (e.g. the app-wrapper swapped between the overlay and two-column layout
   * branches when a wide workspace page deactivated), not actually closed.
   */
  notifyApprovalPageAttached() {
    if (this.pendingDetachReject !== null) {
      clearTimeout(this.pendingDetachReject);
      this.pendingDetachReject = null;
    }
  }

  /**
   * Called by the approval flow page when it is destroyed. The component is
   * destroyed both when the user actually leaves the approval (back
   * navigation / flow closed) and when the layout re-parents it, in which
   * case a new instance is created within the same change-detection pass.
   * Defer the auto-reject one tick so the re-created page can cancel it —
   * otherwise a covenant deploy dispatched from the wide contracts workspace
   * is silently rejected the moment its approval page opens.
   */
  notifyApprovalPageDetached() {
    if (this.pendingDetachReject !== null) {
      clearTimeout(this.pendingDetachReject);
    }
    const detachedApprovalInstanceId = this.currentApprovalInstanceId;
    this.pendingDetachReject = setTimeout(() => {
      this.pendingDetachReject = null;
      // A new approval may have started since this page was detached
      // (e.g. this one was already resolved and cleaned up while a fresh
      // action was dispatched before this timer fired) - only reject if
      // we're still looking at the same approval instance.
      if (this.currentApprovalInstanceId === detachedApprovalInstanceId) {
        this.rejectIfPending();
      }
    }, 0);
  }

  /**
   * Rejects and cleans up a pending approval without triggering navigation.
   * Used when the approval page is destroyed externally (e.g. user navigated back).
   */
  rejectIfPending() {
    if (this.currentResolve) {
      this.currentResolve({ isApproved: false });
      this.currentResolve = null;
    }
    this.currentApprovalConfigSignal.set(null);
    this.completionSignal.set(null);
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
    const pageConfig = {
      id: 'action-approval' as const,
      title: this.getApprovalTitle(config.action),
      canNavigateBack: config.state === ApprovalFlowState.APPROVAL,
      showTitle: config.state === ApprovalFlowState.APPROVAL,
      showBackground: config.state === ApprovalFlowState.APPROVAL,
    };

    // If a flow page is already open, add approval on top of the stack
    // Otherwise, start a new flow
    if (this.flowPagesService.isAnyPageOpen()) {
      this.flowPagesService.navigateToPage(pageConfig);
    } else {
      this.flowPagesService.openFlow(pageConfig);
    }
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
        // Use navigateBack() to return to the previous page in the stack
        // instead of closePage() which clears the entire stack
        this.flowPagesService.navigateBack();
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
      case WalletActionType.COVENANT_DEPLOY:
        return 'Deploy Covenant';
      case WalletActionType.COVENANT_SPEND:
        return 'Interact With Covenant';
      case WalletActionType.COVENANT_COMPLETE_PARTIAL:
        return 'Complete Covenant Interaction';
      case WalletActionType.SIGN_MESSAGE:
        return 'Sign Message';
      case WalletActionType.SIGN_PSKT_TRANSACTION:
        return 'Sign Transaction';
      case WalletActionType.EIP1193_PROVIDER_REQUEST:
        const eipData =
          action.data as EIP1193RequestPayload<EIP1193RequestType>;
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
