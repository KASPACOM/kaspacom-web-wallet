import { Component, Input, Output, EventEmitter } from '@angular/core';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-message-popup',
  imports: [],
  templateUrl: './message-popup.component.html',
  styleUrls: ['./message-popup.component.scss'],
})
export class MessagePopupComponent {
  @Input() message: string = '';
  @Input() type: MessageType = 'info';
  @Input() show: boolean = false;
  @Output() close = new EventEmitter<void>();

  get icon(): string {
    switch (this.type) {
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
    this.close.emit();
  }
}
