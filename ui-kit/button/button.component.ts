import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcIconComponent } from '@kaspacom/ui';

export type ButtonSize = 's' | 'm';
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

@Component({
  selector: 'button[kcButton]',
  standalone: true,
  imports: [CommonModule, KcIconComponent],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss']
})
export class ButtonComponent {
  @Input() text?: string;
  @Input() prefixIcon?: string;
  @Input() suffixIcon?: string;
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() loadingText: string = 'Loading';
  @Input() fullWidth: boolean = false;
  @Input() width?: string;
  @Input() size: ButtonSize = 'm';
  @Input() variant: ButtonVariant = 'primary';
  
  @Output() onClick = new EventEmitter<MouseEvent>();
  
  @HostBinding('class')
  get hostClasses(): string {
    const classes = [
      'kc-button',
      `kc-button--${this.variant}`,
      `kc-button--${this.size}`
    ];
    
    if (this.loading) {
      classes.push('kc-button--loading');
    }
    
    if (this.disabled) {
      classes.push('kc-button--disabled');
    }
    
    if (this.fullWidth) {
      classes.push('kc-button--full-width');
    }
    
    return classes.join(' ');
  }
  
  @HostBinding('style.width')
  get buttonWidth(): string | undefined {
    if (this.fullWidth && this.width) {
      console.warn('Both fullWidth and width are set. width will be ignored.');
      return undefined;
    }
    return this.width;
  }
  
  @HostBinding('disabled')
  get isDisabled(): boolean {
    return this.disabled || this.loading;
  }
  
  get displayText(): string {
    return this.loading ? this.loadingText : (this.text || '');
  }
  
  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.onClick.emit(event);
    }
  }
}
