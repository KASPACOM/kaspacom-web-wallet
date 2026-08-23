import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';

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

  private teardownLoader?: VoidFunction;

  ngAfterViewInit(): void {
    this.teardownLoader = this.setupLoaderFadeOut();
  }

  ngOnDestroy(): void {
    if (this.teardownLoader) {
      this.teardownLoader();
      this.teardownLoader = undefined;
    }
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
