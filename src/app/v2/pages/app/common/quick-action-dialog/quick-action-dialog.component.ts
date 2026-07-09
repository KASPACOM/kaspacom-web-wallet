import { Component, OnChanges, SimpleChanges, input, output } from '@angular/core';

import { KcIconComponent, KcTooltipDirective } from 'kaspacom-ui';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-quick-action-dialog',
  standalone: true,
  imports: [KcIconComponent, KcTooltipDirective],
  templateUrl: './quick-action-dialog.component.html',
  styleUrl: './quick-action-dialog.component.scss',
  animations: [
    trigger('slideUp', [
      state('closed', style({
        transform: 'translateY(600px)',
        opacity: 0
      })),
      state('open', style({
        transform: 'translateY(0)',
        opacity: 1
      })),
      transition('closed => open', [
        style({
          transform: 'translateY(600px)',
          opacity: 0
        }),
        animate('300ms ease-out', style({
          transform: 'translateY(0)',
          opacity: 1
        }))
      ]),
      transition('open => closed', [
        animate('300ms ease-in', style({
          transform: 'translateY(600px)',
          opacity: 0
        }))
      ])
    ])
  ]
})
export class QuickActionDialogComponent implements OnChanges {
  readonly isOpen = input(false);
  readonly title = input<string>();
  readonly isCloseable = input(true);
  readonly backdropClick = output<void>();
  readonly close = output<void>();

  // Track animation state to prevent content changes during animation
  isAnimating = false;

  ngOnChanges(changes: SimpleChanges) {
    // No special overlay logic needed
  }

  onBackdropClick(): void {
    // TODO: The 'emit' function requires a mandatory void argument
    this.backdropClick.emit();
  }

  onClose(): void {
    // TODO: The 'emit' function requires a mandatory void argument
    this.close.emit();
  }

  onAnimationStart(): void {
    this.isAnimating = true;
  }

  onAnimationDone(): void {
    this.isAnimating = false;
  }
}
