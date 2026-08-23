import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
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
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private teardownLoader?: VoidFunction;
  private startupRevealTimeoutId?: ReturnType<typeof setTimeout>;
  private teardownWalletShellReadyListener?: VoidFunction;
  private teardownWalletStartupRequestListener?: VoidFunction;
  private isWalletStartupRequestActive = false;

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.teardownWalletShellReadyListener = this.renderer.listen(
      'window',
      'wallet-shell-ready',
      () => {
        if (
          this.document.documentElement.getAttribute(
            'data-wallet-startup',
          ) === 'wallet' ||
          this.isWalletStartupRequestActive
        ) {
          this.finishStartupLoading();
        }
      },
    );
    this.teardownWalletStartupRequestListener = this.renderer.listen(
      'window',
      'wallet-startup-request',
      () => this.showWalletStartupLoaderIfNeeded(),
    );
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

    if (this.teardownWalletShellReadyListener) {
      this.teardownWalletShellReadyListener();
      this.teardownWalletShellReadyListener = undefined;
    }

    if (this.teardownWalletStartupRequestListener) {
      this.teardownWalletStartupRequestListener();
      this.teardownWalletStartupRequestListener = undefined;
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

      this.finishStartupLoading();
    };

    const revealWhenRouteIsReady = () => {
      if (!this.document.querySelector('app-wallet-shell')) {
        reveal();
        return;
      }

      if (
        this.document.documentElement.getAttribute(
          'data-wallet-shell-ready',
        ) === 'true'
      ) {
        reveal();
        return;
      }

      const walletShellReadyHandler = () => reveal();
      window.addEventListener('wallet-shell-ready', walletShellReadyHandler, {
        once: true,
      });

      const walletShellFallbackId = setTimeout(() => {
        window.removeEventListener(
          'wallet-shell-ready',
          walletShellReadyHandler,
        );
        reveal();
      }, 3000);

      const originalTeardown = this.teardownLoader;
      this.teardownLoader = () => {
        clearTimeout(walletShellFallbackId);
        window.removeEventListener(
          'wallet-shell-ready',
          walletShellReadyHandler,
        );
        originalTeardown?.();
      };
    };

    if (this.router.navigated) {
      queueMicrotask(revealWhenRouteIsReady);
      return;
    }

    const subscription = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        take(1),
      )
      .subscribe(revealWhenRouteIsReady);

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

      return () => {
        this.renderer.removeClass(loader, 'fade-out');
      };
    });
  }

  private finishStartupLoading(): void {
    this.isWalletStartupRequestActive = false;
    this.document.documentElement.removeAttribute('data-wallet-startup');
    this.document.documentElement.removeAttribute('data-wallet-shell-ready');
    this.teardownLoader = this.setupLoaderFadeOutAfterNextPaint();
  }

  private showWalletStartupLoaderIfNeeded(): void {
    const isWalletShellLoaded =
      this.document.documentElement.getAttribute(
        'data-wallet-shell-loaded',
      ) === 'true';

    if (isWalletShellLoaded) {
      return;
    }

    this.isWalletStartupRequestActive = true;

    if (this.teardownLoader) {
      this.teardownLoader();
      this.teardownLoader = undefined;
    }

    this.document
      .getElementById('application-loader-startup')
      ?.classList.remove('fade-out');
  }

  private setupLoaderFadeOutAfterNextPaint(): VoidFunction | undefined {
    if (
      typeof requestAnimationFrame !== 'function' ||
      typeof cancelAnimationFrame !== 'function'
    ) {
      return this.setupLoaderFadeOut();
    }

    let frameId: number | undefined;
    let nestedFrameId: number | undefined;
    let loaderTeardown: VoidFunction | undefined;
    let isCancelled = false;

    frameId = requestAnimationFrame(() => {
      nestedFrameId = requestAnimationFrame(() => {
        if (isCancelled) {
          return;
        }

        loaderTeardown = this.setupLoaderFadeOut();
      });
    });

    return () => {
      isCancelled = true;

      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }

      if (nestedFrameId !== undefined) {
        cancelAnimationFrame(nestedFrameId);
      }

      loaderTeardown?.();
    };
  }
}
