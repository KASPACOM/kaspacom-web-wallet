import { TestBed } from '@angular/core/testing';
import { IframeAccountSelectionService } from './iframe-account-selection.service';
import { IFrameCommunicationApp } from '../../services/communication-service/communication-app/iframe-communication.service';

describe('IframeAccountSelectionService', () => {
  let service: IframeAccountSelectionService;
  let iframeSpy: jasmine.Spy;
  const FORCE_KEY = 'KC_FORCE_ACCOUNT_SELECTION';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IframeAccountSelectionService);
    localStorage.removeItem(FORCE_KEY);
    iframeSpy = spyOn(IFrameCommunicationApp, 'isIframe').and.returnValue(false);
  });

  afterEach(() => {
    localStorage.removeItem(FORCE_KEY);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with overlay closed', () => {
    expect(service.isOverlayOpenValue()).toBe(false);
  });

  it('should open overlay', () => {
    service.openOverlay();
    expect(service.isOverlayOpenValue()).toBe(true);
  });

  it('should close overlay', () => {
    service.openOverlay();
    service.closeOverlay();
    expect(service.isOverlayOpenValue()).toBe(false);
  });

  it('should emit signal changes', (done) => {
    const signal = service.isOverlayOpen();
    expect(signal()).toBe(false);
    
    service.openOverlay();
    expect(signal()).toBe(true);
    
    service.closeOverlay();
    expect(signal()).toBe(false);
    
    done();
  });

  it('should enforce account selection when running inside iframe', () => {
    iframeSpy.and.returnValue(true);
    expect(service.shouldEnforceAccountSelection()).toBe(true);
  });

  it('should enforce account selection when force flag enabled', () => {
    service.enableForceAccountSelection();
    expect(service.shouldEnforceAccountSelection()).toBe(true);
  });

  it('should disable force flag correctly', () => {
    service.enableForceAccountSelection();
    service.disableForceAccountSelection();
    expect(service.shouldEnforceAccountSelection()).toBe(false);
  });
});

