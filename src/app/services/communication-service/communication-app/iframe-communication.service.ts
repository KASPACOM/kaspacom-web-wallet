import { WalletMessageInterface } from '@kaspacom/wallet-messages';
import { BaseCommunicationApp } from './base-communication-app';

export class IFrameCommunicationApp implements BaseCommunicationApp {
  protected currentUrl: string;
  protected onMessageWithBind: (event: MessageEvent) => void;

  constructor(
  ) {
    this.currentUrl = IFrameCommunicationApp.getTopUrl();
    this.onMessageWithBind = () => undefined;
  }

  
  getName(): string | undefined {
    return new URL(this.currentUrl).hostname;
  }

  async sendMessage(message: WalletMessageInterface): Promise<void> {
    const targetOrigin = IFrameCommunicationApp.getTopUrl() || '*';
    window.parent.postMessage(message, targetOrigin);
  }

  async setOnMessageEventHandler(handler: (message: WalletMessageInterface) => void): Promise<void> {
    this.onMessageWithBind = (event: MessageEvent) => {
      if (this.currentUrl && event.origin !== this.currentUrl) {
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
    return (
      window.self !== window.top || window.location != window.parent.location
    );
  }

  private static getTopUrl(): string {
    const ancestorOrigin = document.location.ancestorOrigins?.[0];
    if (ancestorOrigin) {
      return ancestorOrigin;
    }

    if (document.referrer) {
      return new URL(document.referrer).origin;
    }

    // Fallback: use '*' is unsafe, so return empty and let validation handle it
    return '';
  }

}
