import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, NgZone } from '@angular/core';
import { fromEvent, Subject, throttleTime, takeUntil } from 'rxjs';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  @Input() scrollThreshold = 70; // Percentage of scroll before triggering
  @Input() scrollContainer?: HTMLElement; // Optional container, defaults to window
  @Output() scrolled = new EventEmitter<number>(); // Emits scroll percentage
  @Output() thresholdReached = new EventEmitter<void>(); // Emits when threshold is reached

  private destroy$ = new Subject<void>();
  private lastScrollHeight = 0;
  private hasReachedThreshold = false; // Track if threshold was already reached
  private actualScrollContainer?: HTMLElement; // The detected or provided scroll container

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    // Find the scrollable container (provided or auto-detected)
    this.actualScrollContainer = this.scrollContainer || this.findScrollableParent();
    
    if (!this.actualScrollContainer) {
      console.error('[InfiniteScroll] ❌ ERROR: No scrollable parent found! Make sure a parent element has overflow-y: auto or scroll.');
      return;
    }
    
    this.zone.runOutsideAngular(() => {
      fromEvent(this.actualScrollContainer!, 'scroll')
        .pipe(
          throttleTime(120), // 120ms debounce to prevent excessive triggers
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          this.zone.run(() => {
            const currentHeight = this.actualScrollContainer!.scrollHeight;
            
            if (currentHeight > this.lastScrollHeight && this.lastScrollHeight > 0) {
              // Height increased = new content was loaded, reset threshold flag for next page
              this.hasReachedThreshold = false;
            }
            this.lastScrollHeight = currentHeight;
            
            const scrollPercentage = this.calculateScrollPercentage();
            
            this.scrolled.emit(scrollPercentage);
            
            // Only trigger when crossing threshold from below, not when already past it
            if (scrollPercentage >= this.scrollThreshold && !this.hasReachedThreshold) {
              this.hasReachedThreshold = true;
              this.thresholdReached.emit();
            }
          });
        });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Manually check scroll position and emit if threshold reached
   * Useful for programmatic checks (e.g., after content loads)
   */
  public checkScroll(): void {
    if (!this.actualScrollContainer) {
      console.warn('[InfiniteScroll] ⚠️ checkScroll() called but no scroll container found');
      return;
    }
    
    const currentHeight = this.actualScrollContainer.scrollHeight;
    
    if (currentHeight > this.lastScrollHeight && this.lastScrollHeight > 0) {
      this.hasReachedThreshold = false;
    }
    this.lastScrollHeight = currentHeight;
    
    const scrollPercentage = this.calculateScrollPercentage();
    this.scrolled.emit(scrollPercentage);
    
    if (scrollPercentage >= this.scrollThreshold && !this.hasReachedThreshold) {
      this.hasReachedThreshold = true;
      this.thresholdReached.emit();
    }
  }
  
  /**
   * Manually reset the threshold flag
   * Useful when content grows from outside sources (e.g., auto-reload merge)
   * This allows the directive to load more if needed after new items are added
   */
  public resetThreshold(): void {
    if (this.actualScrollContainer) {
      const currentHeight = this.actualScrollContainer.scrollHeight;
      this.lastScrollHeight = currentHeight;
      this.hasReachedThreshold = false;
    }
  }

  /**
   * Finds the nearest scrollable parent by walking up the DOM tree.
   * Returns the first element with overflow-y: auto or scroll.
   */
  private findScrollableParent(): HTMLElement | undefined {
    let parent = this.elementRef.nativeElement.parentElement;
    let depth = 0;
    const maxDepth = 20; // Prevent infinite loops
    
    while (parent && depth < maxDepth) {
      const computed = window.getComputedStyle(parent);
      const overflowY = computed.overflowY;
      
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return parent;
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    console.error(`[InfiniteScroll] ❌ No scrollable parent found after searching ${depth} levels`);
    return undefined;
  }

  private calculateScrollPercentage(): number {
    if (!this.actualScrollContainer) {
      return 0;
    }
    
    const element = this.actualScrollContainer;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    
    if (scrollHeight - clientHeight === 0) {
      return 100;
    }
    
    return (scrollTop / (scrollHeight - clientHeight)) * 100;
  }
}
