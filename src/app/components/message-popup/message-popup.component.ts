import { Component, input, output } from '@angular/core';


export type MessageType = 'success' | 'error' | 'warning' | 'info';

@Component({
    selector: 'app-message-popup',
    imports: [],
    templateUrl: './message-popup.component.html',
    styleUrls: ['./message-popup.component.scss']
})
export class MessagePopupComponent {
  readonly message = input<string>('');
  readonly type = input<MessageType>('info');
  readonly show = input<boolean>(false);
  readonly close = output<void>();

  get icon(): string {
    switch (this.type()) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  }

  onClose(): void {
    // TODO: The 'emit' function requires a mandatory void argument
    this.close.emit();
  }
} 