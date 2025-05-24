import { Component, input, output, EventEmitter, HostBinding } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { ComponentSize } from '../../enums/sizing.enum';
import { SpinnerComponent } from '../spinner/spinner.component';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'gradient_1' | 'gradient_2';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass, NgIf, SpinnerComponent],
  template: `
    <button
      class="app-button"
      [ngClass]="[
        variant(),
        size(),
        isFullWidth() ? 'full-width' : '',
        isDisabled() || isLoading() ? 'disabled' : '',
        isLoading() ? 'loading' : '',
        role() ? 'role-' + role() : '',
        getTypographyClass()
      ]"
      [disabled]="isDisabled() || isLoading()"
      (click)="handleClick()"
    >
      <app-spinner *ngIf="isLoading()" [size]="getSpinnerSize()"></app-spinner>
      <span [ngClass]="{'hidden': isLoading()}">{{ text() }}</span>
    </button>
  `,
  styleUrls: ['./button.component.scss'],
  host: {
    '[style.display]': "isFullWidth() ? 'block' : 'inline-block'",
    '[style.width]': "isFullWidth() ? '100%' : 'auto'"
  }
})
export class ButtonComponent {
  text = input<string>('');
  variant = input<ButtonVariant>('primary');
  size = input<ComponentSize>(ComponentSize.MD);
  isLoading = input<boolean>(false);
  isFullWidth = input<boolean>(false);
  isDisabled = input<boolean>(false);
  role = input<'success' | 'info' | 'warning' | 'danger' | 'neutral' | null>(null);

  buttonClick = output<void>();

  handleClick(): void {
    if (!this.isDisabled() && !this.isLoading()) {
      this.buttonClick.emit();
    }
  }

  getSpinnerSize(): ComponentSize {
    // Map button size to appropriate spinner size
    const sizeMap: Record<ComponentSize, ComponentSize> = {
      [ComponentSize.XS]: ComponentSize.XS,
      [ComponentSize.SM]: ComponentSize.XS,
      [ComponentSize.MD]: ComponentSize.SM,
      [ComponentSize.LG]: ComponentSize.MD,
      [ComponentSize.XLG]: ComponentSize.LG
    };

    return sizeMap[this.size()];
  }

  getTypographyClass(): string {
    // Map button size to appropriate typography class
    const typographyMap: Record<ComponentSize, string> = {
      [ComponentSize.XS]: 'typo-button-small',
      [ComponentSize.SM]: 'typo-button-small',
      [ComponentSize.MD]: 'typo-button-medium',
      [ComponentSize.LG]: 'typo-button-large',
      [ComponentSize.XLG]: 'typo-button-large'
    };

    return typographyMap[this.size()];
  }
}
