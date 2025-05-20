import { Injectable, signal } from '@angular/core';
import { MessageType } from '../components/message-popup/message-popup.component';

export interface MessagePopupData {
  message: string;
  type: MessageType;
  show: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MessagePopupService {
  private messageSignal = signal<MessagePopupData>({
    message: '',
    type: 'info',
    show: false
  });

  message = this.messageSignal.asReadonly();

  showMessage(message: string, type: MessageType = 'info'): void {
    this.messageSignal.set({
      message,
      type,
      show: true
    });
  }

  hideMessage(): void {
    const current = this.messageSignal();
    this.messageSignal.set({
      ...current,
      show: false
    });
  }

  showSuccess(message: string): void {
    this.showMessage(message, 'success');
  }

  showError(message: string): void {
    this.showMessage(message, 'error');
  }

  showWarning(message: string): void {
    this.showMessage(message, 'warning');
  }

  showInfo(message: string): void {
    this.showMessage(message, 'info');
  }
} 