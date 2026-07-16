import { Injectable, signal, computed } from '@angular/core';
import {
  IFlowPageConfig,
  IFlowPageStack,
  IFlowPageNavigation,
} from '../pages/app/common/flow-page/interfaces/flow-page.interface';
import { FlowPageId } from '../pages/app/common/flow-page/flow-page.registry';

@Injectable({
  providedIn: 'root',
})
export class FlowPagesService implements IFlowPageNavigation {
  private pageStackSignal = signal<IFlowPageStack>({
    pages: [],
    currentIndex: -1,
  });

  private readonly _transientStates = new Map<string, unknown>();

  // Computed properties for reactive UI updates
  activePage = computed(() => {
    const stack = this.pageStackSignal();
    return stack.currentIndex >= 0 ? stack.pages[stack.currentIndex] : null;
  });

  canNavigateBack = computed(() => {
    const stack = this.pageStackSignal();
    const currentPage =
      stack.currentIndex >= 0 ? stack.pages[stack.currentIndex] : null;
    // Show back button if there's a previous page OR if current page allows navigation back
    return stack.currentIndex > 0 || currentPage?.canNavigateBack === true;
  });

  isAnyPageOpen = computed(() => {
    return this.pageStackSignal().currentIndex >= 0;
  });

  getCurrentPage(): IFlowPageConfig | null {
    return this.activePage();
  }

  navigateToPage(config: IFlowPageConfig): void {
    this.pageStackSignal.update((stack) => {
      // Check if we're trying to navigate to the same page that's currently active
      const currentPage =
        stack.currentIndex >= 0 ? stack.pages[stack.currentIndex] : null;
      if (currentPage && currentPage.id === config.id) {
        // Update the current page with new data
        const updatedPages = [...stack.pages];
        updatedPages[stack.currentIndex] = config;
        return {
          pages: updatedPages,
          currentIndex: stack.currentIndex,
        };
      }

      // Add new page to stack
      return {
        pages: [...stack.pages, config],
        currentIndex: stack.pages.length,
      };
    });
  }

  navigateBack(): void {
    const currentId = this.activePage()?.id;
    if (currentId) {
      this._transientStates.delete(currentId);
    }
    this.pageStackSignal.update((stack) => {
      if (stack.currentIndex > 0) {
        // Remove the current page from the stack and go to the previous one
        const newPages = stack.pages.slice(0, stack.currentIndex);
        return {
          pages: newPages,
          currentIndex: newPages.length - 1,
        };
      }
      // If we're at the first page, close the entire flow
      return {
        pages: [],
        currentIndex: -1,
      };
    });
  }

  closePage(): void {
    this._transientStates.clear();
    this.pageStackSignal.set({
      pages: [],
      currentIndex: -1,
    });
  }

  // Convenience method to open a new flow sequence
  openFlow(config: IFlowPageConfig): void {
    this._transientStates.clear();
    this.pageStackSignal.set({
      pages: [config],
      currentIndex: 0,
    });
  }

  saveTransientState(pageId: string, state: unknown): void {
    this._transientStates.set(pageId, state);
  }

  getTransientState<T>(pageId: string): T | undefined {
    return this._transientStates.get(pageId) as T | undefined;
  }

  isPageOpen(pageId: FlowPageId): boolean {
    const activePage = this.activePage();
    return activePage?.id === pageId;
  }

  /** True if `pageId` is anywhere in the stack, not just at the top — e.g. a
   * page layered on top (like an action approval) still has it underneath. */
  isPageInStack(pageId: FlowPageId): boolean {
    return this.pageStackSignal().pages.some((page) => page.id === pageId);
  }

  // Get the previous page in the stack
  getPreviousPage(): IFlowPageConfig | null {
    const stack = this.pageStackSignal();
    return stack.currentIndex > 0 ? stack.pages[stack.currentIndex - 1] : null;
  }

  // canNavigateBack is now implemented as a computed property above

  // Check if we have a previous page in the stack
  hasPreviousPage(): boolean {
    const stack = this.pageStackSignal();
    return stack.currentIndex > 0;
  }
}
