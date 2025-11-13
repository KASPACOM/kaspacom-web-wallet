import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcIconComponent, KcTooltipDirective } from '@kaspacom/ui';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-quick-action-dialog',
  standalone: true,
  imports: [CommonModule, KcIconComponent, KcTooltipDirective],
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
  @Input() isOpen = false;
  @Input() title?: string;
  @Input() isCloseable = true;
  @Output() backdropClick = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  // Track animation state to prevent content changes during animation
  isAnimating = false;

  ngOnChanges(changes: SimpleChanges) {
    // No special overlay logic needed
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
