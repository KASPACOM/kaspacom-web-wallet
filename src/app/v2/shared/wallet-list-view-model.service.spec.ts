import { TestBed } from '@angular/core/testing';
import { WalletListViewModelService } from './wallet-list-view-model.service';
import { WalletService } from '../../services/wallet.service';
import { signal } from '@angular/core';

describe('WalletListViewModelService', () => {
  let service: WalletListViewModelService;
  let mockWalletService: jasmine.SpyObj<WalletService>;

  beforeEach(() => {
    mockWalletService = jasmine.createSpyObj('WalletService', [
      'getAllWallets',
      'getCurrentWallet',
      'isL2Display',
    ]);

    mockWalletService.getAllWallets.and.returnValue(signal([]));
    mockWalletService.getCurrentWallet.and.returnValue(undefined);
    mockWalletService.isL2Display.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        WalletListViewModelService,
        { provide: WalletService, useValue: mockWalletService },
      ],
    });
    service = TestBed.inject(WalletListViewModelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load wallet groups', () => {
    const groups = service.loadWalletGroups();
    expect(groups).toEqual([]);
    expect(mockWalletService.getAllWallets).toHaveBeenCalledWith(true);
  });

  it('should shorten addresses correctly', () => {
    const address = 'kaspa:qz0123456789abcdefghijklmnop';
    const shortened = service.shortenAddress(address);
    expect(shortened).toBe('kaspa:qz01...klmnop');
  });

  it('should handle empty addresses', () => {
    const shortened = service.shortenAddress('');
    expect(shortened).toBe('');
  });
});

