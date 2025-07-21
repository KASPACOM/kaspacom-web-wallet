import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
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

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const scrollElement = this.scrollContainer || window;
    
    fromEvent(scrollElement, 'scroll')
      .pipe(
        throttleTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        const scrollPercentage = this.calculateScrollPercentage();
        this.scrolled.emit(scrollPercentage);
        
        if (scrollPercentage >= this.scrollThreshold) {
          this.thresholdReached.emit();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateScrollPercentage(): number {
    if (this.scrollContainer) {
      // For custom container
      const element = this.scrollContainer;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      
      if (scrollHeight - clientHeight === 0) {
        return 100;
      }
      
      return (scrollTop / (scrollHeight - clientHeight)) * 100;
    } else {
      // For window scroll
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      if (documentHeight - windowHeight === 0) {
        return 100;
      }
      
      return (scrollTop / (documentHeight - windowHeight)) * 100;
    }
  }

  /**
   * Manually check if should load more (useful for initial load)
   */
  public checkScroll(): void {
    const scrollPercentage = this.calculateScrollPercentage();
    this.scrolled.emit(scrollPercentage);
    
    if (scrollPercentage >= this.scrollThreshold) {
      this.thresholdReached.emit();
    }
  }
} 