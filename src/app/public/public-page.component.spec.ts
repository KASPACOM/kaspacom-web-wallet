import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { getPublicPageById } from './public-content';
import { PublicPageComponent } from './public-page.component';

describe('PublicPageComponent', () => {
  function createComponent(pageId: string): PublicPageComponent {
    TestBed.configureTestingModule({
      imports: [PublicPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { pageId }, routeConfig: null } },
        },
      ],
    });

    const fixture = TestBed.createComponent(PublicPageComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('renders lastReviewedDate as the same calendar day regardless of local timezone', () => {
    const component = createComponent('home');
    const [year, month, day] = getPublicPageById('home').lastReviewed
      .split('-')
      .map(Number);

    const date = component.lastReviewedDate;

    expect(date.getUTCFullYear()).toBe(year);
    expect(date.getUTCMonth()).toBe(month - 1);
    expect(date.getUTCDate()).toBe(day);
  });
});
