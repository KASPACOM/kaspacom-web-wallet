import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentLayoutComponent } from '../content-layout/content-layout.component';
import { SeoService } from '../../../services/seo.service';
import contentRoutes from '../content-routes.json';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [ContentLayoutComponent, RouterLink],
  templateUrl: './features.component.html',
  styleUrls: ['./features.component.scss'],
})
export class FeaturesComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    const page = contentRoutes.pages.find((p) => p.path === '/features')!;
    this.seo.setPage({
      title: page.title,
      description: page.description,
      path: page.path,
    });
  }
}
