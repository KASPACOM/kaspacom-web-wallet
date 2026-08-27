import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentLayoutComponent } from '../../../content-layout/content-layout.component';
import { SeoService, SITE_URL } from '../../../../../services/seo.service';
import contentRoutes from '../../../content-routes.json';

const SLUG = 'what-is-kns';

@Component({
  selector: 'app-what-is-kns',
  standalone: true,
  imports: [ContentLayoutComponent, RouterLink],
  templateUrl: './what-is-kns.component.html',
  styleUrls: ['../article-prose.component.scss'],
})
export class WhatIsKnsComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    const article = contentRoutes.articles.find((a) => a.slug === SLUG)!;
    this.seo.setPage({
      title: article.title,
      description: article.description,
      path: `/learn/${SLUG}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        author: { '@type': 'Organization', name: 'KaspaCom' },
        publisher: { '@type': 'Organization', name: 'KaspaCom' },
        mainEntityOfPage: `${SITE_URL}/learn/${SLUG}`,
      },
    });
  }
}
