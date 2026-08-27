import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentLayoutComponent } from '../content-layout/content-layout.component';
import { SeoService } from '../../../services/seo.service';
import contentRoutes from '../content-routes.json';

@Component({
  selector: 'app-learn',
  standalone: true,
  imports: [ContentLayoutComponent, RouterLink],
  templateUrl: './learn.component.html',
  styleUrls: ['./learn.component.scss'],
})
export class LearnComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly articles = contentRoutes.articles;

  ngOnInit(): void {
    const page = contentRoutes.pages.find((p) => p.path === '/learn')!;
    this.seo.setPage({
      title: page.title,
      description: page.description,
      path: page.path,
    });
  }
}
