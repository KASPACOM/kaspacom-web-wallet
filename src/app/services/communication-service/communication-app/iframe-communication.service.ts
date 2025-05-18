import { WalletMessageInterface } from 'kaspacom-wallet-messages';
import { BaseCommunicationApp } from './base-communication-app';
import { environment } from '../../../../environments/environment';

export class IFrameCommunicationApp implements BaseCommunicationApp {
  protected currentUrl: string;
  protected onMessageWithBind: (event: MessageEvent) => void;

  constructor(
  ) {
    this.currentUrl = IFrameCommunicationApp.getTopUrl();
    this.onMessageWithBind = () => undefined;
  }

  async sendMessage(message: WalletMessageInterface): Promise<void> {
    if (this.isIframeAllowedDomain(IFrameCommunicationApp.getTopUrl())) {
      window.parent.postMessage(message, IFrameCommunicationApp.getTopUrl());
    }
  }

  async setOnMessageEventHandler(handler: (message: WalletMessageInterface) => void): Promise<void> {
    this.onMessageWithBind = (event: MessageEvent) => {
      if (event.origin !== this.currentUrl) {
        return;
      }

      if (!this.isIframeAllowedDomain(event.origin)) {
        console.error('Message from not allowed origin', event.origin);
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

  getUrl(): string {
    return this.currentUrl;
  }

  static isIframe(): boolean {
    return (
      window.self !== window.top || window.location != window.parent.location
    );
  }

  private static getTopUrl(): string {
    return document.location.ancestorOrigins[0] || document.referrer;
  }

  isIframeAllowedDomain(domain: string): boolean {
    const hostname = new URL(domain).hostname;
    return environment.allowedIframeDomains.includes(hostname);
  }

}
