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
import { CovenantIndexerService } from '../../../../../../../services/covenant/covenant-indexer.service';
import { RpcService } from '../../../../../../../services/kaspa-netwrok-services/rpc.service';
import { TemplatePatcherService } from '../../../../../../services/covenant/template-patcher.service';
import { KaspaL1NetworkService } from '../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { FlowPagesService } from '../../../../../../services/flow-pages.service';
import { ApprovalFlowService } from '../../../../../../services/approval-flow.service';
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

    const covenantIndexerServiceSpy = jasmine.createSpyObj(
      'CovenantIndexerService',
      [
        'getCovenant',
        'getCovenantActions',
        'getCovenantByCanonicalId',
        'getCovenantUtxos',
        'getTransactionActions',
        'getTransactionSettlementStatus',
        'listCovenants',
        'search',
      ],
    );
    covenantIndexerServiceSpy.listCovenants.and.resolveTo([]);
    covenantIndexerServiceSpy.getTransactionSettlementStatus.and.rejectWith(
      new Error('not mocked'),
    );

    const rpcServiceSpy = jasmine.createSpyObj('RpcService', [
      'getNetwork',
      'getRpc',
      'setNetwork',
    ]);
    rpcServiceSpy.getNetwork.and.returnValue('testnet-10');

    const templatePatcherSpy = jasmine.createSpyObj('TemplatePatcherService', [
      'applyPatch',
      'extractPatchDescriptor',
      'kaspaAddressToPubkeyBytes',
    ]);

    const kaspaL1NetworkServiceSpy = jasmine.createSpyObj(
      'KaspaL1NetworkService',
      ['getCovenantExplorerBaseurl', 'getKaspaExplorerBaseurl'],
    );

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
        {
          provide: CovenantIndexerService,
          useValue: covenantIndexerServiceSpy,
        },
        { provide: RpcService, useValue: rpcServiceSpy },
        { provide: TemplatePatcherService, useValue: templatePatcherSpy },
        {
          provide: HttpClient,
          useValue: jasmine.createSpyObj('HttpClient', ['get']),
        },
        { provide: KaspaL1NetworkService, useValue: kaspaL1NetworkServiceSpy },
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
