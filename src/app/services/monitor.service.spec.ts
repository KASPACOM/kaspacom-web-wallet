import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { MonitorService } from './monitor.service';

describe('MonitorService', () => {
  let service: MonitorService;
  let trackSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MonitorService,
        { provide: Router, useValue: { events: of() } },
      ],
    });
    service = TestBed.inject(MonitorService);
    trackSpy = jasmine.createSpy('track');
  });

  afterEach(() => {
    delete (window as any).analytics;
  });

  /** Force the post-consent state: tracking enabled + analytics attached. */
  function enableTracking() {
    (service as any).trackingEnabled = true;
    (window as any).analytics = { track: trackSpy };
  }

  /** Properties Segment received on the most recent track call. */
  function lastTrackedProps(): Record<string, unknown> {
    return trackSpy.calls.mostRecent().args[1];
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('does not track when tracking is disabled', () => {
    (window as any).analytics = { track: trackSpy };
    service.track('Wallet Created', { action_source: 'wallet_onboarding' });
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('does not track (or throw) when analytics is not attached yet', () => {
    (service as any).trackingEnabled = true;
    expect(() => service.track('Wallet Created')).not.toThrow();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('drops sensitive properties and keeps safe ones', () => {
    enableTracking();
    service.track('Wallet Created', {
      action_source: 'wallet_onboarding',
      count: 3,
      walletAddress: 'kaspa:qr...',
      auth_provider: 'google',
      password: 'hunter2',
      sessionId: 'abc',
      user_email: 'a@b.com',
      mnemonic: 'seed words',
      tx_hash: '0xdeadbeef',
    });

    const props = lastTrackedProps();
    expect(props['action_source']).toBe('wallet_onboarding');
    expect(props['count']).toBe(3);
    for (const dropped of [
      'walletAddress',
      'auth_provider',
      'password',
      'sessionId',
      'user_email',
      'mnemonic',
      'tx_hash',
    ]) {
      expect(props[dropped]).toBeUndefined();
    }
  });

  it('drops `ip` as a whole token but keeps safe keys containing the substring', () => {
    enableTracking();
    service.track('Wallet Created', {
      client_ip: '1.2.3.4',
      userIp: '5.6.7.8',
      tip_amount: 10,
      zip_code: '90210',
      ship_method: 'air',
    });

    const props = lastTrackedProps();
    expect(props['client_ip']).toBeUndefined();
    expect(props['userIp']).toBeUndefined();
    expect(props['tip_amount']).toBe(10);
    expect(props['zip_code']).toBe('90210');
    expect(props['ship_method']).toBe('air');
  });

  it('does not track when analytics is a stub without a callable track', () => {
    (service as any).trackingEnabled = true;
    (window as any).analytics = {}; // attached but not ready yet
    expect(() => service.track('Wallet Created')).not.toThrow();
  });

  it('converts bigint values to numbers', () => {
    enableTracking();
    service.track('Transaction Succeeded', { amount: BigInt(5) });
    expect(lastTrackedProps()['amount']).toBe(5);
  });

  it('normalizes Error values to error_name, not a string error_code', () => {
    enableTracking();
    service.track('Transaction Failed', { error: new TypeError('boom') });
    const error = lastTrackedProps()['error'] as Record<string, unknown>;
    expect(error['error_name']).toBe('TypeError');
    expect(error['error_code']).toBeUndefined();
  });

  it('attaches common product properties', () => {
    enableTracking();
    service.track('Wallet Created');
    const props = lastTrackedProps();
    expect(props['app']).toBe('wallet');
    expect(props['page_category']).toBeDefined();
    expect(typeof props['is_mobile']).toBe('boolean');
  });
});
