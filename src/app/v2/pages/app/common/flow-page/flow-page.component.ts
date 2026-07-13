import { Component, input, output } from '@angular/core';

import { KcIconComponent, KcTooltipDirective } from '@kaspacom/ui-kit';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

@Component({
  selector: 'app-flow-page',
  standalone: true,
  imports: [KcIconComponent, KcTooltipDirective],
  templateUrl: './flow-page.component.html',
  styleUrl: './flow-page.component.scss',
  animations: [
    trigger('slideDown', [
      state(
        'closed',
        style({
          transform: 'translateY(-100%)',
          opacity: 0,
          visibility: 'hidden',
        }),
      ),
      state(
        'open',
        style({
          transform: 'translateY(0)',
          opacity: 1,
          visibility: 'visible',
        }),
      ),
      transition('closed => open', [
        style({
          visibility: 'visible',
          transform: 'translateY(-100%)',
          opacity: 0,
        }),
        animate(
          '300ms ease-out',
          style({
            transform: 'translateY(0)',
            opacity: 1,
          }),
        ),
      ]),
      transition('open => closed', [
        animate(
          '200ms ease-in',
          style({
            transform: 'translateY(100%)', // Slide down off-screen instead of up
            opacity: 0,
          }),
        ),
      ]),
    ]),
  ],
})
export class FlowPageComponent {
  readonly isOpen = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly canNavigateBack = input(false);
  readonly canClose = input(false);
  readonly showTitle = input(true);
  readonly showBackground = input(true);
  readonly navigateBack = output<void>();
  readonly backdropClick = output<void>();
  readonly close = output<void>();

  // Track animation state to prevent content changes during animation
  isAnimating = false;

  onNavigateBack(): void {
    this.navigateBack.emit();
  }

  onBackdropClick(): void {
    this.backdropClick.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  onAnimationStart(): void {
    this.isAnimating = true;
  }

  onAnimationDone(): void {
    this.isAnimating = false;
  }
}
