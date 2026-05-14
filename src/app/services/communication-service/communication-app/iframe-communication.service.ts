import { WalletMessageInterface } from '@kaspacom/wallet-messages';
import { BaseCommunicationApp } from './base-communication-app';

export class IFrameCommunicationApp implements BaseCommunicationApp {
  protected currentUrl: string;
  protected onMessageWithBind: (event: MessageEvent) => void;

  constructor() {
    this.currentUrl = IFrameCommunicationApp.getTopUrl();
    this.onMessageWithBind = () => undefined;
  }

  getName(): string | undefined {
    if (!this.currentUrl) {
      return undefined;
    }
    try {
      return new URL(this.currentUrl).hostname;
    } catch {
      return undefined;
    }
  }

  async sendMessage(message: WalletMessageInterface): Promise<void> {
    if (!this.currentUrl) {
      console.error('Cannot send message: parent origin unknown');
      return;
    }
    window.parent.postMessage(message, this.currentUrl);
  }

  async setOnMessageEventHandler(handler: (message: WalletMessageInterface) => void): Promise<void> {
    this.onMessageWithBind = (event: MessageEvent) => {
      if (!this.currentUrl || event.origin !== this.currentUrl) {
        return;
      }

      if (event.source !== window.parent) {
        return;
      }

      const message = event.data as WalletMessageInterface;
      handler(message);
    };

    window.addEventListener('message', this.onMessageWithBind);
  }

  disconnect(): void {
    window.removeEventListener('message', this.onMessageWithBind);
  }

  getApplicationId(): string {
    return this.currentUrl;
  }

  static isIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  private static getTopUrl(): string {
    const ancestorOrigin = document.location.ancestorOrigins?.[0];
    if (ancestorOrigin) {
      return ancestorOrigin;
    }

    if (document.referrer) {
      try {
        const origin = new URL(document.referrer).origin;
        if (origin && origin !== 'null' && origin.startsWith('http')) {
          return origin;
        }
      } catch {
        // Invalid referrer URL — fall through
      }
    }

    return '';
  }
}
