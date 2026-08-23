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
  private readonly isBrowser = typeof window !== 'undefined';
  private readonly closeIframeInfoWindow = () => window.close();

  ngOnInit(): void {
    this.page = getPublicPageById(this.route.snapshot.data['pageId']);
    this.faqs = getPublicPageFaqs(this.page.id);
    this.isIframeInfoPage = this.route.snapshot.queryParamMap.has('iframeInfo');
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
    if (!this.isIframeInfoPage || !this.isBrowser) {
      return;
    }

    event.preventDefault();
    window.close();
  }

  private registerIframeInfoBackHandler(): void {
    if (!this.isIframeInfoPage || !this.isBrowser) {
      return;
    }

    window.history.pushState({ iframeInfo: true }, '', window.location.href);
    window.addEventListener('popstate', this.closeIframeInfoWindow);
  }
}
