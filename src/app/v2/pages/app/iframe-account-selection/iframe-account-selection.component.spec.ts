import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { IframeAccountSelectionComponent } from './iframe-account-selection.component';
import { WalletService } from '../../../../services/wallet.service';
import { AppWallet } from '../../../../classes/AppWallet';

describe('IframeAccountSelectionComponent', () => {
  let component: IframeAccountSelectionComponent;
  let fixture: ComponentFixture<IframeAccountSelectionComponent>;
  let mockWalletService: jasmine.SpyObj<WalletService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockWallet = {
    getId: () => 1,
    getIdWithAccount: () => '1-no-account',
    getName: () => 'Primary Wallet',
    getAccountName: () => 'Account 1',
    getAddress: () => 'kaspa:wallet',
    getL2WalletStateSignal: () => signal(null),
  } as any as AppWallet;

  beforeEach(async () => {
    mockWalletService = jasmine.createSpyObj('WalletService', [
      'selectCurrentWallet',
      'logout',
      'getAllWallets',
      'getCurrentWallet',
      'isL2Display',
    ]);
    mockWalletService.selectCurrentWallet.and.returnValue(Promise.resolve());
    mockWalletService.getAllWallets.and.returnValue(signal([mockWallet]));
    mockWalletService.getCurrentWallet.and.returnValue(undefined);
    mockWalletService.isL2Display.and.returnValue(false);

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [IframeAccountSelectionComponent],
      providers: [
        { provide: WalletService, useValue: mockWalletService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IframeAccountSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load wallets on initialization', () => {
    expect(mockWalletService.getAllWallets).toHaveBeenCalledWith(true);
  });

  it('should auto select wallet when only one group exists', () => {
    expect(component.selectedWalletGroup()?.id).toBe(1);
    expect(component.isWalletSelectionVisible()).toBeFalse();
  });

  it('should allow wallet selection when multiple groups exist', () => {
    const otherWallet = {
      getId: () => 2,
      getName: () => 'Second',
      getAddress: () => 'kaspa:second',
      getL2WalletStateSignal: () => signal(null),
    } as any as AppWallet;

    mockWalletService.getAllWallets.and.returnValue(signal([mockWallet, otherWallet]));
    component.loadWallets();
    fixture.detectChanges();

    expect(component.isWalletSelectionVisible()).toBeTrue();
    const walletGroup = component.walletGroups()[1];
    component.selectWalletGroup(walletGroup);
    expect(component.selectedWalletGroup()?.id).toBe(2);
  });

  it('should select account on click', async () => {
    const accountItem = component.accountItems()[0];
    if (accountItem) {
      await component.selectAccount(accountItem);
      expect(mockWalletService.selectCurrentWallet).toHaveBeenCalled();
    }
  });

  it('should shorten addresses correctly', () => {
    const address = 'kaspa:qz0123456789abcdef';
    const shortened = component.shortenAddress(address);
    expect(shortened).toContain('...');
  });
});

