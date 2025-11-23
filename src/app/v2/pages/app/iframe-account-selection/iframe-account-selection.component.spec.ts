import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IframeAccountSelectionComponent } from './iframe-account-selection.component';
import { WalletService } from '../../../../services/wallet.service';
import { WalletAccountItem, WalletListViewModelService, WalletGroupItem } from '../../../shared/wallet-list-view-model.service';

describe('IframeAccountSelectionComponent', () => {
  let component: IframeAccountSelectionComponent;
  let fixture: ComponentFixture<IframeAccountSelectionComponent>;
  let mockWalletService: jasmine.SpyObj<WalletService>;
  let mockWalletListViewModel: jasmine.SpyObj<WalletListViewModelService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const walletStub: WalletGroupItem = {
    id: 1,
    name: 'Primary Wallet',
    address: 'kaspa:wallet',
    isSelected: false,
    group: [] as any,
  };

  const accountWalletStub = {
    getIdWithAccount: () => '1-no-account',
  } as any;

  const accountStub: WalletAccountItem = {
    id: '1-no-account',
    name: 'Account 1',
    address: 'kaspa:account',
    isSelected: false,
    wallet: accountWalletStub,
  };

  beforeEach(async () => {
    mockWalletService = jasmine.createSpyObj('WalletService', [
      'selectCurrentWallet',
      'logout',
    ]);
    mockWalletService.selectCurrentWallet.and.returnValue(Promise.resolve());

    mockWalletListViewModel = jasmine.createSpyObj('WalletListViewModelService', [
      'loadWalletGroups',
      'shortenAddress',
      'buildAccountItems',
    ]);

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockWalletListViewModel.loadWalletGroups.and.returnValue([walletStub]);
    mockWalletListViewModel.shortenAddress.and.callFake((address: string) => address);
    mockWalletListViewModel.buildAccountItems.and.returnValue([accountStub]);

    await TestBed.configureTestingModule({
      imports: [IframeAccountSelectionComponent],
      providers: [
        { provide: WalletService, useValue: mockWalletService },
        { provide: WalletListViewModelService, useValue: mockWalletListViewModel },
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
    expect(mockWalletListViewModel.loadWalletGroups).toHaveBeenCalled();
  });

  it('should auto select wallet when only one group exists', () => {
    expect(component.selectedWalletGroup()).toEqual(walletStub);
    expect(component.isWalletSelectionVisible()).toBeFalse();
    expect(component.accountItems().length).toBe(1);
    expect(mockWalletListViewModel.buildAccountItems).toHaveBeenCalledWith(walletStub);
  });

  it('should allow wallet selection when multiple groups exist', () => {
    const otherWallet: WalletGroupItem = {
      id: 2,
      name: 'Second',
      address: 'kaspa:second',
      isSelected: false,
      group: [] as any,
    };

    component.walletGroups.set([walletStub, otherWallet]);
    component.selectedWalletGroup.set(undefined);
    fixture.detectChanges();

    expect(component.isWalletSelectionVisible()).toBeTrue();
    component.selectWalletGroup(otherWallet);
    expect(component.selectedWalletGroup()).toEqual(otherWallet);
  });

  it('should select account on click', async () => {
    await component.selectAccount(accountStub);
    expect(mockWalletService.selectCurrentWallet).toHaveBeenCalledWith('1-no-account');
  });

  it('should shorten addresses using the view model service', () => {
    const address = 'kaspa:qz0123456789abcdef';
    component.shortenAddress(address);
    expect(mockWalletListViewModel.shortenAddress).toHaveBeenCalledWith(address);
  });
});

