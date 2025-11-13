import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcIconComponent, KcTooltipDirective } from '@kaspacom/ui';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-flow-page',
  standalone: true,
  imports: [CommonModule, KcIconComponent, KcTooltipDirective],
  templateUrl: './flow-page.component.html',
  styleUrl: './flow-page.component.scss',
  animations: [
    trigger('slideDown', [
      state('closed', style({
        transform: 'translateY(-100%)',
        opacity: 0,
        visibility: 'hidden'
      })),
      state('open', style({
        transform: 'translateY(0)',
        opacity: 1,
        visibility: 'visible'
      })),
      transition('closed => open', [
        style({
          visibility: 'visible',
          transform: 'translateY(-100%)',
          opacity: 0
        }),
        animate('300ms ease-out', style({
          transform: 'translateY(0)',
          opacity: 1
        }))
      ]),
      transition('open => closed', [
        animate('200ms ease-in', style({
          transform: 'translateY(100%)', // Slide down off-screen instead of up
          opacity: 0
        }))
      ])
    ])
  ]
})
export class FlowPageComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() canNavigateBack = false;
  @Input() canClose = false;
  @Input() showTitle = true;
  @Input() showBackground = true;
  @Output() navigateBack = new EventEmitter<void>();
  @Output() backdropClick = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

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
