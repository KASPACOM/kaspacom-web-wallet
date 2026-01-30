import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenLogoComponent } from './token-logo.component';
import { DEFI_API_BASE_URL, LOGOS_URL } from '../../config/injection-tokens';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('TokenLogoComponent', () => {
  let component: TokenLogoComponent;
  let fixture: ComponentFixture<TokenLogoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenLogoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEFI_API_BASE_URL, useValue: 'https://dev-api-defi.kaspa.com' },
        { provide: LOGOS_URL, useValue: 'https://erc20-logo-dev.s3.eu-central-1.amazonaws.com/' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TokenLogoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ticker', 'KAS');
    fixture.componentRef.setInput('address', '0x0');
    fixture.componentRef.setInput('size', 'md');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
