import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WalletService } from '../../../../../../services/wallet.service';
import { QuickActionDialogService } from '../../../../../services/quick-action-dialog.service';
import { FlowPagesService } from '../../../../../services/flow-pages.service';
import { WalletManagementPageComponent } from './wallet-management-page.component';

describe('WalletManagementPageComponent recovery notice', () => {
  const unusableWallets = signal<Array<{ name?: string }>>([]);

  function setup() {
    TestBed.configureTestingModule({
      imports: [WalletManagementPageComponent],
      providers: [
        {
          provide: WalletService,
          useValue: {
            getUnusableWallets: () => unusableWallets.asReadonly(),
            getAllWallets: () => signal(undefined).asReadonly(),
            getCurrentWallet: () => undefined,
          },
        },
        { provide: QuickActionDialogService, useValue: {} },
        { provide: FlowPagesService, useValue: {} },
      ],
    });

    const fixture = TestBed.createComponent(WalletManagementPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    unusableWallets.set([]);
    TestBed.resetTestingModule();
  });

  it('shows nothing when every wallet loaded', () => {
    const fixture = setup();

    expect(
      fixture.nativeElement.querySelector('.wallet-recovery-notice'),
    ).toBeNull();
  });

  it('names the skipped wallet and announces it', () => {
    unusableWallets.set([{ name: 'Savings' }]);
    const fixture = setup();

    const notice = fixture.nativeElement.querySelector(
      '.wallet-recovery-notice',
    );
    expect(notice).not.toBeNull();
    // Polite, not assertive: pre-existing state must not interrupt a reader.
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain('This wallet is');
    expect(notice.textContent).toContain('Savings');
    expect(notice.textContent).toContain('other wallets are');
    // The body must agree in number with the heading, not just mention wallets.
    expect(notice.textContent).toContain('Its recovery phrase is');
    expect(notice.textContent).toContain('Restore it from');
    expect(notice.textContent).not.toContain('Their recovery phrases');
  });

  it('pluralises and lists every skipped wallet', () => {
    unusableWallets.set([{ name: 'Savings' }, { name: 'Cold storage' }]);
    const fixture = setup();

    const notice = fixture.nativeElement.querySelector(
      '.wallet-recovery-notice',
    );
    expect(notice.textContent).toContain('These wallets are');
    expect(notice.textContent).toContain('Savings, Cold storage');
    expect(notice.textContent).toContain('Their recovery phrases are');
    expect(notice.textContent).toContain('Restore them from');
    expect(notice.textContent).not.toContain('Its recovery phrase is');
  });
});
