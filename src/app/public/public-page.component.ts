import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  getPublicPageById,
  getPublicPageFaqs,
  PUBLIC_PAGES,
} from './public-content';
import { PublicFaqEntry, PublicPage } from './public-page.model';
import { PublicSeoService } from './public-seo.service';

@Component({
  selector: 'app-public-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './public-page.component.html',
  styleUrl: './public-page.component.scss',
})
export class PublicPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(PublicSeoService);

  readonly pages = PUBLIC_PAGES;
  page!: PublicPage;
  faqs: PublicFaqEntry[] = [];
  isIframeInfoPage = false;
  isEmbeddedWalletInfoPage = false;
  isOpeningWallet = false;
  showReturnToWalletMessage = false;
  private readonly isBrowser = typeof window !== 'undefined';
  private readonly closeIframeInfoWindow = () => {
    this.showReturnToWalletMessage = true;
    window.close();
  };

  ngOnInit(): void {
    this.page = getPublicPageById(this.route.snapshot.data['pageId']);
    this.faqs = getPublicPageFaqs(this.page.id);
    this.isIframeInfoPage = this.route.snapshot.queryParamMap.has('iframeInfo');
    this.isEmbeddedWalletInfoPage = this.route.snapshot.routeConfig?.path === 'info';
    this.showReturnToWalletMessage = this.isIframeInfoPage;
    this.registerIframeInfoBackHandler();
    this.seo.applyPage(this.page, this.faqs);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) {
      return;
    }

    window.removeEventListener('popstate', this.closeIframeInfoWindow);
  }

  pageHref(path: string): string {
    return `/${path}`.replace(/\/$/, '/') || '/';
  }

  onWalletCtaClick(event: MouseEvent): void {
    if (!this.isBrowser) {
      return;
    }

    if (this.isIframeInfoPage) {
      event.preventDefault();
      this.closeIframeInfoWindow();
      return;
    }

    if (!this.isEmbeddedWalletInfoPage) {
      this.isOpeningWallet = true;
      this.showWalletStartupLoader();
    }
  }

  private registerIframeInfoBackHandler(): void {
    if (!this.isIframeInfoPage || !this.isBrowser) {
      return;
    }

    window.history.replaceState(
      { ...(window.history.state ?? {}), iframeInfoCloseTarget: true },
      '',
      window.location.href,
    );
    window.history.pushState(
      { ...(window.history.state ?? {}), iframeInfoActivePage: true },
      '',
      window.location.href,
    );
    window.addEventListener('popstate', this.closeIframeInfoWindow);
  }

  private showWalletStartupLoader(): void {
    window.dispatchEvent(new CustomEvent('wallet-startup-request'));
  }
}
