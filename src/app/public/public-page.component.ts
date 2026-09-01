import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { KcAccordionComponent } from '@kaspacom/ui-kit';
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
  imports: [CommonModule, RouterLink, RouterLinkActive, KcAccordionComponent],
  templateUrl: './public-page.component.html',
  styleUrl: './public-page.component.scss',
})
export class PublicPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(PublicSeoService);

  readonly pages = PUBLIC_PAGES;
  page!: PublicPage;
  faqs: PublicFaqEntry[] = [];
  isEmbeddedWalletInfoPage = false;
  isOpeningWallet = false;
  private readonly isBrowser = typeof window !== 'undefined';

  ngOnInit(): void {
    this.page = getPublicPageById(this.route.snapshot.data['pageId']);
    this.faqs = getPublicPageFaqs(this.page.id);
    this.isEmbeddedWalletInfoPage = this.route.snapshot.routeConfig?.path === 'info';
    this.seo.applyPage(this.page, this.faqs);
  }

  get lastReviewedDate(): Date {
    // page.lastReviewed is a plain 'YYYY-MM-DD' string. Angular's DatePipe parses
    // date-only strings as local midnight, so combined with the 'UTC' display
    // timezone it renders the wrong calendar day in any timezone ahead of UTC.
    // Building the Date explicitly as UTC midnight avoids that mismatch.
    return new Date(`${this.page.lastReviewed}T00:00:00Z`);
  }

  pageHref(path: string): string {
    return `/${path}`.replace(/\/$/, '/') || '/';
  }

  get heroLead(): string {
    const words = this.page.h1.trim().split(/\s+/);
    return words.slice(0, -1).join(' ');
  }

  get heroAccentWord(): string {
    const words = this.page.h1.trim().split(/\s+/);
    return words[words.length - 1] ?? '';
  }

  onWalletCtaClick(event: MouseEvent): void {
    if (!this.isBrowser) {
      return;
    }

    if (!this.isEmbeddedWalletInfoPage) {
      this.isOpeningWallet = true;
      this.showWalletStartupLoader();
    }
  }

  private showWalletStartupLoader(): void {
    window.dispatchEvent(new CustomEvent('wallet-startup-request'));
  }
}
