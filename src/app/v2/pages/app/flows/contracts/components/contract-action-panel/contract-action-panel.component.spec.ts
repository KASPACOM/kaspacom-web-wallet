import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Dialog } from '@angular/cdk/dialog';
import { NotificationService } from '@kaspacom/ui-kit';
import { ContractActionPanelComponent } from './contract-action-panel.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../services/wallet-action.service';
import { QrScannerService } from '../../../../../../../services/qr-scanner.service';
import { CovenantService } from '../../../../../../../services/covenant/covenant.service';
import { TemplatePatcherService } from '../../../../../../services/covenant/template-patcher.service';
import { FlowPagesService } from '../../../../../../services/flow-pages.service';
import { ApprovalFlowService } from '../../../../../../services/approval-flow.service';
import { ContractDisplayService } from '../../services/contract-display.service';
import { CovenantTemplateService } from '../../services/covenant-template.service';
import { ContractsDataService } from '../../services/contracts-data.service';

// Long, realistic testnet addresses — long enough that the raw address
// (rather than a shortened label) would visibly overflow a 375px-wide
// dropdown if kc-dropdown-select's overlay sizing used it directly.
const WHITELIST_ADDRESS_1 =
  'kaspatest:qpglk4khgvnwn7fdfpnfq7v5edjyy7glw8e2rgh7ur2q3uwdlg5dznh824dvr';
const WHITELIST_ADDRESS_2 =
  'kaspatest:qq2ez0mgpg0hp082hlpqvcnrx8m0quwnh8hf5nc7f2z2q9nxfj9vv0y8dzgn';

describe('ContractActionPanelComponent', () => {
  let component: ContractActionPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ContractActionPanelComponent],
      providers: [
        { provide: CovenantService, useValue: {} },
        { provide: WalletActionService, useValue: {} },
        { provide: TemplatePatcherService, useValue: {} },
        { provide: CovenantTemplateService, useValue: {} },
        { provide: ContractsDataService, useValue: {} },
        { provide: HttpClient, useValue: {} },
        { provide: ApprovalFlowService, useValue: {} },
        { provide: FlowPagesService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: QrScannerService, useValue: {} },
        { provide: Dialog, useValue: {} },
        { provide: WalletService, useValue: {} },
        { provide: ContractDisplayService, useValue: {} },
      ],
    });

    component = TestBed.createComponent(ContractActionPanelComponent)
      .componentInstance;
  });

  describe('getSelfCustodySweepDropdownOptions', () => {
    // Regression test for a review finding on the whitelist wallet selector
    // dropdown: kc-dropdown-select sizes its overlay off DropdownOption.label
    // via calculateLongestOptionWidth() — it measures the raw label text, not
    // what optionTemplate actually renders. Passing the full address as label
    // (instead of the shortened text shown in the row) forces an oversized
    // minWidth that overflows/clips the overlay on narrow screens even though
    // the rendered row itself is short. `value` must stay the full address
    // (used for selection/equality); only `label` must be shortened.
    it('uses a shortened label for sizing while keeping the full address as value', () => {
      spyOn(
        component,
        'getSelfCustodyInteractWhitelistWallets',
      ).and.returnValue([WHITELIST_ADDRESS_1, WHITELIST_ADDRESS_2]);

      const options = component.getSelfCustodySweepDropdownOptions();

      expect(options.length).toBe(2);
      expect(options[0].value).toBe(WHITELIST_ADDRESS_1);
      expect(options[1].value).toBe(WHITELIST_ADDRESS_2);
      for (const option of options) {
        const fullAddress = option.value as string;
        expect(option.label).not.toBe(fullAddress);
        expect(option.label.length).toBeLessThan(fullAddress.length);
        expect(option.label).toContain('...');
      }
    });

    it('returns no options when there is no whitelist', () => {
      spyOn(
        component,
        'getSelfCustodyInteractWhitelistWallets',
      ).and.returnValue([]);

      expect(component.getSelfCustodySweepDropdownOptions()).toEqual([]);
    });
  });

  describe('getSelfCustodyWhitelistIndex', () => {
    it('resolves the index of an address within the whitelist', () => {
      spyOn(
        component,
        'getSelfCustodyInteractWhitelistWallets',
      ).and.returnValue([WHITELIST_ADDRESS_1, WHITELIST_ADDRESS_2]);

      expect(component.getSelfCustodyWhitelistIndex(WHITELIST_ADDRESS_2)).toBe(
        1,
      );
    });

    it('falls back to 0 for an address not in the whitelist', () => {
      spyOn(
        component,
        'getSelfCustodyInteractWhitelistWallets',
      ).and.returnValue([WHITELIST_ADDRESS_1]);

      expect(component.getSelfCustodyWhitelistIndex('unknown')).toBe(0);
    });
  });
});
