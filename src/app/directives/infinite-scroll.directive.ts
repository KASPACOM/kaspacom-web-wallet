import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  NgZone,
  PLATFORM_ID,
  inject,
  input,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { fromEvent, Subject, throttleTime, takeUntil } from 'rxjs';

/**
 * Lightweight infinite scroll directive.
 *
 * - Detects the nearest scrollable ancestor when no container is provided.
 * - Supports element-based and window-based scroll contexts.
 * - Emits `thresholdReached` once per content growth cycle and resets when height increases.
 */
@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  readonly scrollThreshold = input(70);
  readonly scrollDebounce = input(120);
  readonly scrollContainer = input<HTMLElement | Window>();
  readonly greedyLoading = input(false);
  readonly scrolled = output<number>(); // Emits scroll percentage
  readonly thresholdReached = output<void>(); // Emits when threshold is reached

  private destroy$ = new Subject<void>();
  private lastScrollHeight = 0;
  private hasReachedThreshold = false; // Track if threshold was already reached
  private actualScrollContainer?: HTMLElement | Window; // The detected or provided scroll container
  private isWindowContainer = false;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    // Find the scrollable container (provided or auto-detected)
    this.actualScrollContainer =
      this.scrollContainer() || this.findScrollableParent();
    if (!this.actualScrollContainer && typeof window !== 'undefined') {
      console.warn(
        '[InfiniteScroll] WARN: No scrollable parent found, falling back to window scroll listener.',
      );
      this.actualScrollContainer = window;
    }

    this.isWindowContainer = this.actualScrollContainer === window;

    if (!this.actualScrollContainer) {
      console.error(
        '[InfiniteScroll] ERROR: No scrollable parent found. Ensure a parent element has overflow-y set to auto or scroll.',
      );
      return;
    }

    const debounceMs = Math.max(0, this.scrollDebounce());

    this.zone.runOutsideAngular(() => {
      fromEvent(this.actualScrollContainer!, 'scroll')
        .pipe(throttleTime(debounceMs), takeUntil(this.destroy$))
        .subscribe(() => {
          this.zone.run(() => {
            const metrics = this.getScrollMetrics();
            if (!metrics) {
              return;
            }

            const currentHeight = metrics.scrollHeight;

            if (
              currentHeight > this.lastScrollHeight &&
              this.lastScrollHeight > 0
            ) {
              // Height increased = new content was loaded, reset threshold flag for next page
              this.hasReachedThreshold = false;
            }
            this.lastScrollHeight = currentHeight;

            const scrollPercentage = this.calculateScrollPercentage(metrics);
            const effectiveThreshold = Math.min(
              100,
              Math.max(0, this.scrollThreshold()),
            );

            this.scrolled.emit(scrollPercentage);

            // Only trigger when crossing threshold from below, not when already past it
            if (
              scrollPercentage >= effectiveThreshold &&
              !this.hasReachedThreshold
            ) {
              this.hasReachedThreshold = true;
              this.thresholdReached.emit();
            }
          });
        });
    });

    if (this.greedyLoading()) {
      setTimeout(() => this.checkScroll(), 100);
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) {
      return;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Manually check scroll position and emit if threshold reached
   * Useful for programmatic checks (e.g., after content loads)
   */
  public checkScroll(): void {
    if (!this.isBrowser) {
      return;
    }
    if (!this.actualScrollContainer) {
      console.warn(
        '[InfiniteScroll] WARN: checkScroll() called but no scroll container found',
      );
      return;
    }

    const metrics = this.getScrollMetrics();
    if (!metrics) {
      return;
    }

    const currentHeight = metrics.scrollHeight;

    if (currentHeight > this.lastScrollHeight && this.lastScrollHeight > 0) {
      this.hasReachedThreshold = false;
    }
    this.lastScrollHeight = currentHeight;

    const scrollPercentage = this.calculateScrollPercentage(metrics);
    const effectiveThreshold = Math.min(
      100,
      Math.max(0, this.scrollThreshold()),
    );
    this.scrolled.emit(scrollPercentage);

    if (scrollPercentage >= effectiveThreshold && !this.hasReachedThreshold) {
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
    if (!this.isBrowser) {
      return;
    }
    if (this.actualScrollContainer) {
      const metrics = this.getScrollMetrics();
      if (!metrics) {
        return;
      }
      const currentHeight = metrics.scrollHeight;
      this.lastScrollHeight = currentHeight;
      this.hasReachedThreshold = false;
    }
  }

  /**
   * Finds the nearest scrollable parent by walking up the DOM tree.
   * Returns the first element with overflow-y: auto or scroll.
   */
  private findScrollableParent(): HTMLElement | undefined {
    if (!this.isBrowser) {
      return undefined;
    }
    let parent = this.elementRef.nativeElement.parentElement;
    let depth = 0;
    const maxDepth = 20; // Prevent infinite loops

    while (parent && depth < maxDepth) {
      const computed = window.getComputedStyle(parent);
      const overflowY = computed.overflowY;

      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'overlay'
      ) {
        return parent;
      }

      if (parent === document.body || parent === document.documentElement) {
        break;
      }

      parent = parent.parentElement;
      depth++;
    }

    console.error(
      `[InfiniteScroll] ERROR: No scrollable parent found after searching ${depth} levels`,
    );
    return undefined;
  }

  private calculateScrollPercentage(metrics: ScrollMetrics): number {
    const { scrollTop, scrollHeight, clientHeight } = metrics;

    if (scrollHeight - clientHeight === 0) {
      return 100;
    }

    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  private getScrollMetrics(): ScrollMetrics | undefined {
    if (!this.isBrowser || !this.actualScrollContainer) {
      return undefined;
    }

    if (this.isWindowContainer) {
      const doc = document.documentElement;
      const body = document.body;
      const scrollTop =
        window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
      const clientHeight = doc.clientHeight;
      return { scrollTop, scrollHeight, clientHeight };
    }

    const element = this.actualScrollContainer as HTMLElement;
    return {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    };
  }
}

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}
