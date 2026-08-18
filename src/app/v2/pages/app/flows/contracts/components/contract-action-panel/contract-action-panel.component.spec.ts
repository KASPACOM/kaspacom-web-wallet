import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
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
import { CompiledContract } from '../../../../../../../services/covenant/covenant-sdk/types';

const MIN_CONTINUATION_AMOUNT_SOMPI = 50_000_000n; // 0.5 KAS

const DMS_COMPILED_CONTRACT: CompiledContract = {
  contract_name: 'DeadManSwitch',
  script: [],
  without_selector: false,
  ast: {
    name: 'DeadManSwitch',
    params: [],
    constants: {},
    functions: [
      {
        name: 'keepAlive',
        params: [],
        entrypoint: true,
        return_types: [],
        body: [],
      },
      {
        name: 'changeHeir',
        params: [],
        entrypoint: true,
        return_types: [],
        body: [],
      },
      {
        name: 'topUp',
        params: [],
        entrypoint: true,
        return_types: [],
        body: [],
      },
      {
        name: 'claim',
        params: [],
        entrypoint: true,
        return_types: [],
        body: [],
      },
    ],
  },
  abi: [
    {
      name: 'keepAlive',
      inputs: [
        { name: 's', type_name: 'sig' },
        { name: 'newDeadline', type_name: 'int' },
      ],
    },
    {
      name: 'changeHeir',
      inputs: [
        { name: 's', type_name: 'sig' },
        { name: 'newHeir', type_name: 'pubkey' },
      ],
    },
    { name: 'topUp', inputs: [] },
    { name: 'claim', inputs: [{ name: 's', type_name: 'sig' }] },
  ],
};

const COVENANT_ADDRESS = 'kaspatest:qzcovenantaddressmock';
const HEIR_ADDRESS = 'kaspatest:qzheiraddressmock';

describe("ContractActionPanelComponent — Dead Man's Switch partial claim", () => {
  let component: ContractActionPanelComponent;
  let walletActionServiceSpy: jasmine.SpyObj<WalletActionService>;
  let covenantServiceSpy: jasmine.SpyObj<CovenantService>;
  let registryEntryUpdatedSpy: jasmine.Spy;

  beforeEach(async () => {
    const walletServiceSpy = jasmine.createSpyObj('WalletService', [
      'getAllWalletsByIdAndAccount',
      'getCurrentWallet',
      'selectCurrentWallet',
    ]);
    walletServiceSpy.getCurrentWallet.and.returnValue({
      getAddress: () => 'kaspatest:qzownerheiraddressmock',
      getPrivateKey: () => ({
        toString: () => 'fakeprivatekeyhex',
        toPublicKey: () => ({
          toXOnlyPublicKey: () => ({ toString: () => 'fakepubkeyhex' }),
        }),
      }),
      getIdWithAccount: () => 'wallet-0',
      getDisplayName: () => 'Test Wallet',
    } as any);

    walletActionServiceSpy = jasmine.createSpyObj('WalletActionService', [
      'validateAndApproveAction',
      'validateAndDoActionAfterApproval',
    ]);
    walletActionServiceSpy.validateAndDoActionAfterApproval.and.resolveTo({
      success: true,
      result: { txid: 'f'.repeat(64), functionName: 'claim' },
    } as any);

    const qrScannerServiceSpy = jasmine.createSpyObj('QrScannerService', [
      'isCurrentlyScanning',
      'startScanning',
      'stopScanning',
    ]);

    covenantServiceSpy = jasmine.createSpyObj('CovenantService', [
      'buildPartial',
      'getContractAddress',
      'parseCompiledContract',
    ]);
    covenantServiceSpy.getContractAddress.and.returnValue(COVENANT_ADDRESS);
    covenantServiceSpy.parseCompiledContract.and.callFake((json: string) =>
      JSON.parse(json),
    );

    const templatePatcherSpy = jasmine.createSpyObj('TemplatePatcherService', [
      'applyPatch',
      'extractPatchDescriptor',
      'kaspaAddressToPubkeyBytes',
    ]);

    const flowPagesServiceSpy = jasmine.createSpyObj('FlowPagesService', [
      'getTransientState',
      'saveTransientState',
    ]);
    flowPagesServiceSpy.getTransientState.and.returnValue(undefined);

    const approvalFlowServiceSpy = jasmine.createSpyObj('ApprovalFlowService', [
      'closeApproval',
      'setPendingConfirmation',
    ]);

    const notificationServiceSpy = jasmine.createSpyObj('NotificationService', [
      'success',
    ]);

    const dialogSpy = jasmine.createSpyObj('Dialog', ['open']);
    dialogSpy.open.and.returnValue({ closed: of(undefined) });

    await TestBed.configureTestingModule({
      imports: [ContractActionPanelComponent],
      providers: [
        { provide: WalletService, useValue: walletServiceSpy },
        { provide: WalletActionService, useValue: walletActionServiceSpy },
        { provide: QrScannerService, useValue: qrScannerServiceSpy },
        { provide: CovenantService, useValue: covenantServiceSpy },
        { provide: TemplatePatcherService, useValue: templatePatcherSpy },
        {
          provide: HttpClient,
          useValue: jasmine.createSpyObj('HttpClient', ['get']),
        },
        { provide: ContractDisplayService, useValue: {} },
        { provide: CovenantTemplateService, useValue: {} },
        { provide: ContractsDataService, useValue: {} },
        { provide: FlowPagesService, useValue: flowPagesServiceSpy },
        { provide: ApprovalFlowService, useValue: approvalFlowServiceSpy },
        { provide: Dialog, useValue: dialogSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ContractActionPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    registryEntryUpdatedSpy = spyOn(component.registryEntryUpdated, 'emit');
  });

  function setUpDmsClaim(options: {
    inputSompi: bigint;
    outputAmountKas: string;
    outputAddress?: string;
  }) {
    component.interactContractJson.set(JSON.stringify(DMS_COMPILED_CONTRACT));
    component.selectedContractId.set('registry-entry-1');
    component.selectedFunction.set('claim');
    component.interactOutpointTxid.set('a'.repeat(64));
    component.interactOutpointVout.set('0');
    component.interactInputAmount.set(options.inputSompi.toString());
    component.interactOutputAddress.set(options.outputAddress ?? HEIR_ADDRESS);
    component.interactOutputAmount.set(options.outputAmountKas);
  }

  function lastSpendOutputs(): {
    address: string;
    amount: bigint;
    covenantId?: string;
  }[] {
    const call =
      walletActionServiceSpy.validateAndDoActionAfterApproval.calls.mostRecent();
    return (call.args[0] as any).data.outputs;
  }

  function lastRegistryUpdate() {
    return registryEntryUpdatedSpy.calls.mostRecent().args[0];
  }

  describe('buildWithdrawalOutputs() — shared partial-withdrawal engine', () => {
    it('splits a partial withdrawal into a payout output plus a continuation output', () => {
      const outputs = (component as any).buildWithdrawalOutputs(
        DMS_COMPILED_CONTRACT,
        200_000_000n,
        HEIR_ADDRESS,
        100_000_000n,
      );
      expect(outputs).toEqual([
        { address: HEIR_ADDRESS, amount: 100_000_000n },
        {
          address: COVENANT_ADDRESS,
          amount: 100_000_000n,
          covenantId: undefined,
        },
      ]);
    });

    it('returns a single output for a full-balance withdrawal (no continuation)', () => {
      const outputs = (component as any).buildWithdrawalOutputs(
        DMS_COMPILED_CONTRACT,
        200_000_000n,
        HEIR_ADDRESS,
        200_000_000n,
      );
      expect(outputs).toEqual([
        { address: HEIR_ADDRESS, amount: 200_000_000n },
      ]);
    });

    it('supports multiple sequential partial withdrawals against the shrinking balance', () => {
      const first = (component as any).buildWithdrawalOutputs(
        DMS_COMPILED_CONTRACT,
        200_000_000n,
        HEIR_ADDRESS,
        50_000_000n,
      );
      expect(first[1].amount).toBe(150_000_000n);

      const second = (component as any).buildWithdrawalOutputs(
        DMS_COMPILED_CONTRACT,
        first[1].amount,
        HEIR_ADDRESS,
        100_000_000n,
      );
      // Remainder lands exactly on the 0.5 KAS minimum — boundary is inclusive.
      expect(second).toEqual([
        { address: HEIR_ADDRESS, amount: 100_000_000n },
        {
          address: COVENANT_ADDRESS,
          amount: MIN_CONTINUATION_AMOUNT_SOMPI,
          covenantId: undefined,
        },
      ]);
    });

    it('rejects a withdrawal amount above the available balance', () => {
      const outputs = (component as any).buildWithdrawalOutputs(
        DMS_COMPILED_CONTRACT,
        200_000_000n,
        HEIR_ADDRESS,
        300_000_000n,
      );
      expect(outputs).toBeUndefined();
      expect(component.interactError()).toBe(
        'Withdraw amount cannot exceed the contract balance',
      );
    });

    it('rejects a partial withdrawal that would leave a remainder below 0.5 KAS', () => {
      const outputs = (component as any).buildWithdrawalOutputs(
        DMS_COMPILED_CONTRACT,
        200_000_000n,
        HEIR_ADDRESS,
        180_000_000n,
      );
      expect(outputs).toBeUndefined();
      expect(component.interactError()).toContain(
        'must leave at least 0.5 KAS',
      );
    });
  });

  describe('interactContract() — DMS claim', () => {
    it('submits a partial claim as [payout, continuation] and keeps the registry entry active', async () => {
      setUpDmsClaim({ inputSompi: 200_000_000n, outputAmountKas: '1' });

      await component.interactContract();

      expect(lastSpendOutputs()).toEqual([
        { address: HEIR_ADDRESS, amount: 100_000_000n },
        {
          address: COVENANT_ADDRESS,
          amount: 100_000_000n,
          covenantId: undefined,
        },
      ]);
      expect(lastRegistryUpdate()).toEqual(
        jasmine.objectContaining({
          id: 'registry-entry-1',
          updates: jasmine.objectContaining({
            outpoint: { txid: 'f'.repeat(64), vout: 1 },
            amountSompi: '100000000',
          }),
        }),
      );
      expect(registryEntryUpdatedSpy).not.toHaveBeenCalledWith(
        jasmine.objectContaining({
          updates: jasmine.objectContaining({ status: 'spent' }),
        }),
      );
    });

    it('submits a full claim as a single output and marks the registry entry spent', async () => {
      setUpDmsClaim({ inputSompi: 200_000_000n, outputAmountKas: '2' });

      await component.interactContract();

      expect(lastSpendOutputs()).toEqual([
        { address: HEIR_ADDRESS, amount: 200_000_000n },
      ]);
      expect(lastRegistryUpdate()).toEqual(
        jasmine.objectContaining({
          id: 'registry-entry-1',
          updates: jasmine.objectContaining({
            status: 'spent',
            spendTxid: 'f'.repeat(64),
          }),
        }),
      );
    });

    for (const bad of ['0', '-1', 'abc']) {
      it(`rejects a claim amount of "${bad}" without submitting a transaction`, async () => {
        setUpDmsClaim({ inputSompi: 200_000_000n, outputAmountKas: bad });

        await component.interactContract();

        expect(component.interactError()).toBe(
          'Output amount must be greater than 0',
        );
        expect(
          walletActionServiceSpy.validateAndDoActionAfterApproval,
        ).not.toHaveBeenCalled();
        expect(registryEntryUpdatedSpy).not.toHaveBeenCalled();
      });
    }

    it('rejects a claim amount that rounds down to 0 sompi without submitting a transaction', async () => {
      setUpDmsClaim({
        inputSompi: 200_000_000n,
        outputAmountKas: '0.000000001',
      });

      await component.interactContract();

      expect(component.interactError()).toBe(
        'Output amount must be at least 0.00000001 KAS',
      );
      expect(
        walletActionServiceSpy.validateAndDoActionAfterApproval,
      ).not.toHaveBeenCalled();
      expect(registryEntryUpdatedSpy).not.toHaveBeenCalled();
    });

    it('rejects a claim amount above the available balance without submitting a transaction', async () => {
      setUpDmsClaim({ inputSompi: 200_000_000n, outputAmountKas: '3' });

      await component.interactContract();

      expect(component.interactError()).toBe(
        'Withdraw amount cannot exceed the contract balance',
      );
      expect(
        walletActionServiceSpy.validateAndDoActionAfterApproval,
      ).not.toHaveBeenCalled();
      expect(registryEntryUpdatedSpy).not.toHaveBeenCalled();
    });
  });

  describe('regression — other DMS actions are unaffected', () => {
    it('still dispatches keepAlive through executeDmsKeepAlive', async () => {
      const keepAliveSpy = spyOn(
        component as any,
        'executeDmsKeepAlive',
      ).and.resolveTo();
      component.interactContractJson.set(JSON.stringify(DMS_COMPILED_CONTRACT));
      component.selectedFunction.set('keepAlive');
      component.interactOutpointTxid.set('a'.repeat(64));
      component.interactOutpointVout.set('0');
      component.interactInputAmount.set('200000000');

      await component.interactContract();

      expect(keepAliveSpy).toHaveBeenCalled();
      expect(
        walletActionServiceSpy.validateAndDoActionAfterApproval,
      ).not.toHaveBeenCalled();
    });

    it('still dispatches changeHeir through executeDmsChangeHeir', async () => {
      const changeHeirSpy = spyOn(
        component as any,
        'executeDmsChangeHeir',
      ).and.resolveTo();
      component.interactContractJson.set(JSON.stringify(DMS_COMPILED_CONTRACT));
      component.selectedFunction.set('changeHeir');
      component.interactOutpointTxid.set('a'.repeat(64));
      component.interactOutpointVout.set('0');
      component.interactInputAmount.set('200000000');
      component.interactOutputAddress.set(HEIR_ADDRESS);

      await component.interactContract();

      expect(changeHeirSpy).toHaveBeenCalled();
      expect(
        walletActionServiceSpy.validateAndDoActionAfterApproval,
      ).not.toHaveBeenCalled();
    });
  });
});

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

    component = TestBed.createComponent(
      ContractActionPanelComponent,
    ).componentInstance;
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

    it('uses longer shortened labels on wider screens', () => {
      spyOn(
        component,
        'getSelfCustodyInteractWhitelistWallets',
      ).and.returnValue([WHITELIST_ADDRESS_1]);

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 375,
      });
      component.onResize();
      const narrowLabel =
        component.getSelfCustodySweepDropdownOptions()[0].label;

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1400,
      });
      component.onResize();
      const wideLabel = component.getSelfCustodySweepDropdownOptions()[0].label;

      expect(narrowLabel.length).toBeLessThan(wideLabel.length);
      expect(wideLabel.length).toBeLessThan(WHITELIST_ADDRESS_1.length);
      expect(wideLabel).toBe(
        component.formatResponsiveDropdownAddress(WHITELIST_ADDRESS_1),
      );
    });

    it('returns no options when there is no whitelist', () => {
      spyOn(
        component,
        'getSelfCustodyInteractWhitelistWallets',
      ).and.returnValue([]);

      expect(component.getSelfCustodySweepDropdownOptions()).toEqual([]);
    });
  });

  describe('coSignerOptions', () => {
    it('uses a shortened participant address in the label while keeping signer role as value', () => {
      spyOn<any>(component, 'getCurrentSignerRole').and.returnValue('Signer 1');
      spyOn(component, 'getParticipantValueForRole').and.callFake((role) =>
        role === 'Signer 2' ? WHITELIST_ADDRESS_1 : WHITELIST_ADDRESS_2,
      );

      const options = component.coSignerOptions();

      expect(options.length).toBe(2);
      expect(options[0].value).toBe('Signer 2');
      expect(options[0].label).toContain('Signer 2');
      expect(options[0].label).not.toContain(WHITELIST_ADDRESS_1);
      expect(options[0].label).toContain('...');
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
