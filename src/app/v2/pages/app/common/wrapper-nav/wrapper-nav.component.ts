import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { NavIcons } from './icons/nav-icons';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs';
import { KcTooltipDirective } from 'kaspacom-ui';

export interface INavRoute {
  svgContent: SafeHtml;
  alt: string;
  link: string;
}
@Component({
  selector: 'app-wrapper-nav',
  imports: [CommonModule, RouterModule, KcTooltipDirective],
  templateUrl: './wrapper-nav.component.html',
  styleUrl: './wrapper-nav.component.scss',
})
export class WrapperNavComponent implements AfterViewInit, OnDestroy {
  private readonly domSanitizer = inject(DomSanitizer);

  @ViewChild('navHost') myElementRef!: ElementRef<HTMLElement>;

  private resizeObserver!: ResizeObserver;
  navHostWidth = signal(0);

  routes = signal<INavRoute[]>([
    {
      svgContent: this.domSanitizer.bypassSecurityTrustHtml(NavIcons.home),
      alt: 'Home',
      link: '/app/home',
    },
    {
      svgContent: this.domSanitizer.bypassSecurityTrustHtml(NavIcons.activity),
      alt: 'History',
      link: '/app/activity',
    },
    {
      svgContent: this.domSanitizer.bypassSecurityTrustHtml(NavIcons.contracts),
      alt: 'Contracts',
      link: '/app/contracts',
    },
  ]);
  activeRoute = signal<INavRoute | undefined>(undefined);
  activeRouteIdx = computed(() => {
    const active = this.activeRoute();
    if (!active) return -1;
    return this.routes().findIndex((r) => r.link === active.link);
  });
  selectedIndicatorOffset = computed(() => {
    const idx = this.activeRouteIdx();
    if (idx < 0) return 0;
    const navHostWidth = this.navHostWidth();
    const itemCount = this.routes().length;
    const gap = (navHostWidth - itemCount * 40) / (itemCount * 2);
    const indicatorOverWidth = (70 - 40) / 2;
    const dist = gap + idx * (40 + 2 * gap) - indicatorOverWidth;
    return `${dist}px`;
  });

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((eventGen) => {
        const event = eventGen as NavigationEnd;
        const path = event.urlAfterRedirects;
        //this.currentPath.set(path);
        console.log('Current path:', path);
        const match = this.routes().find((r) => path.startsWith(r.link));
        this.activeRoute.set(match ?? undefined);
      });
  }

  ngAfterViewInit() {
    this.updateWidth();

    this.resizeObserver = new ResizeObserver(() => this.updateWidth());
    this.resizeObserver.observe(this.myElementRef.nativeElement);
  }

  updateWidth() {
    const el = this.myElementRef.nativeElement;
    this.navHostWidth.set(el.offsetWidth);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }
}
