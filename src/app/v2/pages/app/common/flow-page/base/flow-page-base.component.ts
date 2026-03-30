import { Directive, inject, OnInit, OnDestroy } from '@angular/core';
import { FlowPageBase, IFlowPageConfig } from '../interfaces/flow-page.interface';
import { FlowPagesService } from '../../../../../services/flow-pages.service';

@Directive()
export abstract class FlowPageBaseComponent extends FlowPageBase implements OnInit, OnDestroy {
  protected flowPagesService = inject(FlowPagesService);
  
  abstract override get config(): IFlowPageConfig;
  
  ngOnInit(): void {
    this.onPageEnter?.();
  }
  
  ngOnDestroy(): void {
    this.onPageExit?.();
  }
  
  /**
   * Navigate to the next page in the sequence
   */
  protected navigateToNextPage(config: IFlowPageConfig): void {
    this.flowPagesService.navigateToPage(config);
  }
  
  /**
   * Go back to the previous page
   */
  protected navigateBack(): void {
    if (this.onNavigateBack && !this.onNavigateBack()) {
      return; // Prevent navigation if onNavigateBack returns false
    }
    this.flowPagesService.navigateBack();
  }
  
  /**
   * Close the entire flow
   */
  protected closeFlow(): void {
    this.flowPagesService.closePage();
  }
  
  /**
   * Check if we can navigate back
   */
  protected canGoBack(): boolean {
    return this.flowPagesService.canNavigateBack();
  }
  
  /**
   * Get the current page configuration
   */
  protected getCurrentConfig(): IFlowPageConfig | null {
    return this.flowPagesService.getCurrentPage();
  }

  protected saveTransientState(state: unknown): void {
    this.flowPagesService.saveTransientState(this.config.id, state);
  }

  protected restoreTransientState<T>(): T | undefined {
    return this.flowPagesService.getTransientState<T>(this.config.id);
  }
}