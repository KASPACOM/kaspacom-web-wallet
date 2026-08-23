import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, take } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject<Document>(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  private teardownLoader?: VoidFunction;
  private startupRevealTimeoutId?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.revealAfterInitialNavigation();
  }

  ngOnDestroy(): void {
    if (this.startupRevealTimeoutId) {
      clearTimeout(this.startupRevealTimeoutId);
      this.startupRevealTimeoutId = undefined;
    }

    if (this.teardownLoader) {
      this.teardownLoader();
      this.teardownLoader = undefined;
    }
  }

  private revealAfterInitialNavigation(): void {
    let isRevealed = false;

    const reveal = () => {
      if (isRevealed) {
        return;
      }

      isRevealed = true;

      if (this.startupRevealTimeoutId) {
        clearTimeout(this.startupRevealTimeoutId);
        this.startupRevealTimeoutId = undefined;
      }

      this.document.documentElement.removeAttribute('data-wallet-startup');
      this.teardownLoader = this.setupLoaderFadeOut();
    };

    if (this.router.navigated) {
      queueMicrotask(reveal);
      return;
    }

    const subscription = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        take(1),
      )
      .subscribe(reveal);

    this.startupRevealTimeoutId = setTimeout(() => {
      subscription.unsubscribe();
      reveal();
    }, 3000);
  }

  private setupLoaderFadeOut(): VoidFunction | undefined {
    return this.zone.runOutsideAngular(() => {
      const loader = this.document.getElementById('application-loader-startup');
      if (!loader) {
        return;
      }

      this.renderer.addClass(loader, 'fade-out');

      const cleanupFns: VoidFunction[] = [];
      let isFinalized = false;

      const finalizeRemoval = () => {
        if (isFinalized) {
          return;
        }
        isFinalized = true;

        cleanupFns.splice(0).forEach((cleanup) => cleanup());

        const parent = loader.parentNode;
        if (parent) {
          this.renderer.removeChild(parent, loader);
        } else if (
          loader instanceof HTMLElement &&
          typeof loader.remove === 'function'
        ) {
          loader.remove();
        }
      };

      const transitionCleanup = this.renderer.listen(
        loader,
        'transitionend',
        (event: TransitionEvent) => {
          if (event.target === loader && event.propertyName === 'opacity') {
            finalizeRemoval();
          }
        },
      );
      cleanupFns.push(transitionCleanup);

      const timeoutId = setTimeout(finalizeRemoval, 800);
      cleanupFns.push(() => clearTimeout(timeoutId));

      return () => {
        this.zone.runOutsideAngular(finalizeRemoval);
      };
    });
  }
}
