import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReferralService, REFERRAL_STORAGE_KEY as REF_KEY } from './referral.service';
import { DEFI_API_BASE_URL } from '../config/injection-tokens';

describe('ReferralService', () => {
  let service: ReferralService;
  let httpMock: HttpTestingController;
  const apiBase = 'https://api-defi.test';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEFI_API_BASE_URL, useValue: apiBase },
      ],
    });
    service = TestBed.inject(ReferralService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.removeItem(REF_KEY);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(REF_KEY);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('captureReferralCode', () => {
    let originalHref: string;

    beforeEach(() => {
      originalHref = window.location.href;
    });

    afterEach(() => {
      history.replaceState(null, '', originalHref);
    });

    it('persists a valid ref, normalizes case, and removes ref from the URL', () => {
      const path = window.location.pathname || '/';
      history.replaceState(null, '', `${path}?ref=My_Code-1&keep=y`);
      service.captureReferralCode();
      expect(localStorage.getItem(REF_KEY)).toBe('my_code-1');
      expect(window.location.search).toBe('?keep=y');
    });

    it('does not persist or rewrite URL for an invalid ref', () => {
      const path = window.location.pathname || '/';
      history.replaceState(null, '', `${path}?ref=bad%3Cscript%3E`);
      const before = window.location.href;
      service.captureReferralCode();
      expect(localStorage.getItem(REF_KEY)).toBeNull();
      expect(window.location.href).toBe(before);
    });

    it('does nothing when ref query param is absent', () => {
      const path = window.location.pathname || '/';
      history.replaceState(null, '', `${path}?x=1`);
      service.captureReferralCode();
      expect(localStorage.getItem(REF_KEY)).toBeNull();
    });
  });

  describe('registerWallet', () => {
    it('POSTs referredBy when localStorage has a valid code, then clears storage', async () => {
      localStorage.setItem(REF_KEY, '  REF_ABC  ');
      const wallet = 'kaspa:testaddr';
      const promise = service.registerWallet(wallet);

      const req = httpMock.expectOne(
        (r) =>
          r.method === 'POST' &&
          r.url ===
            `${apiBase}/user-referrals/user-referral?walletAddress=${encodeURIComponent(wallet)}`,
      );
      expect(req.request.body).toEqual({ referredBy: 'ref_abc' });

      req.flush({});
      await promise;

      expect(localStorage.getItem(REF_KEY)).toBeNull();
    });

    it('POSTs empty body when stored ref is invalid after normalization', async () => {
      localStorage.setItem(REF_KEY, 'not valid!!!');
      const wallet = 'kaspa:addr2';
      const promise = service.registerWallet(wallet);

      const req = httpMock.expectOne(
        `${apiBase}/user-referrals/user-referral?walletAddress=${encodeURIComponent(wallet)}`,
      );
      expect(req.request.body).toEqual({});

      req.flush({});
      await promise;

      expect(localStorage.getItem(REF_KEY)).toBeNull();
    });

    it('does not clear localStorage when the request fails', async () => {
      localStorage.setItem(REF_KEY, 'valid-ref');
      const wallet = 'kaspa:addr3';
      const promise = service.registerWallet(wallet);

      const req = httpMock.expectOne(
        `${apiBase}/user-referrals/user-referral?walletAddress=${encodeURIComponent(wallet)}`,
      );
      req.flush('error', { status: 500, statusText: 'Server Error' });

      await promise;

      expect(localStorage.getItem(REF_KEY)).toBe('valid-ref');
    });
  });
});
