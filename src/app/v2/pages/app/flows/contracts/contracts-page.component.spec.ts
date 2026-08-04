import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { NotificationService } from '@kaspacom/ui-kit';

import { ContractsPageComponent } from './contracts-page.component';
import { WalletService } from '../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../services/wallet-action.service';
import { QrScannerService } from '../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../services/utils.service';
import { CovenantService } from '../../../../../services/covenant/covenant.service';
import { CovenantIndexerService } from '../../../../../services/covenant/covenant-indexer.service';
import { RpcService } from '../../../../../services/kaspa-netwrok-services/rpc.service';
import { ContractRegistryService } from '../../../../../services/covenant/contract-registry.service';
import { TemplatePatcherService } from '../../../../services/covenant/template-patcher.service';
import { KaspaL1NetworkService } from '../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { WideWorkspaceService } from '../../../../services/wide-workspace.service';
import { ApprovalFlowService } from '../../../../services/approval-flow.service';
import { CompiledContract } from '../../../../../services/covenant/covenant-sdk/types';

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

describe("ContractsPageComponent — Dead Man's Switch partial claim", () => {
  let component: ContractsPageComponent;
  let walletActionServiceSpy: jasmine.SpyObj<WalletActionService>;
  let covenantServiceSpy: jasmine.SpyObj<CovenantService>;
  let registryServiceSpy: jasmine.SpyObj<ContractRegistryService>;

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

    const utilsHelperSpy = jasmine.createSpyObj('UtilsHelper', [
      'isValidWalletAddress',
    ]);
    utilsHelperSpy.isValidWalletAddress.and.returnValue(true);

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
    // Rejecting makes trackActionIndexing() bail out after a single attempt
    // instead of looping/delaying in the background after each test.
    covenantIndexerServiceSpy.getTransactionSettlementStatus.and.rejectWith(
      new Error('not mocked'),
    );

    const rpcServiceSpy = jasmine.createSpyObj('RpcService', [
      'getNetwork',
      'getRpc',
      'setNetwork',
    ]);
    rpcServiceSpy.getNetwork.and.returnValue('testnet-10');

    registryServiceSpy = jasmine.createSpyObj('ContractRegistryService', [
      'addContract',
      'deleteContract',
      'generateId',
      'getAllContracts',
      'migrateContractsRegistryFromLocalStorage',
      'updateContract',
    ]);
    registryServiceSpy.getAllContracts.and.resolveTo([]);
    registryServiceSpy.migrateContractsRegistryFromLocalStorage.and.resolveTo();
    registryServiceSpy.updateContract.and.resolveTo();

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

    const wideWorkspaceServiceSpy = jasmine.createSpyObj(
      'WideWorkspaceService',
      ['activate', 'deactivate'],
    );

    const approvalFlowServiceSpy = jasmine.createSpyObj('ApprovalFlowService', [
      'closeApproval',
      'setPendingConfirmation',
    ]);

    const notificationServiceSpy = jasmine.createSpyObj('NotificationService', [
      'success',
    ]);

    const dialogSpy = jasmine.createSpyObj('Dialog', ['open']);
    dialogSpy.open.and.returnValue({ closed: of(undefined) });

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    const activatedRouteStub = {
      paramMap: of(convertToParamMap({})),
      snapshot: { queryParamMap: convertToParamMap({}) },
    };

    await TestBed.configureTestingModule({
      imports: [ContractsPageComponent],
      providers: [
        { provide: WalletService, useValue: walletServiceSpy },
        { provide: WalletActionService, useValue: walletActionServiceSpy },
        { provide: QrScannerService, useValue: qrScannerServiceSpy },
        { provide: UtilsHelper, useValue: utilsHelperSpy },
        { provide: CovenantService, useValue: covenantServiceSpy },
        {
          provide: CovenantIndexerService,
          useValue: covenantIndexerServiceSpy,
        },
        { provide: RpcService, useValue: rpcServiceSpy },
        { provide: ContractRegistryService, useValue: registryServiceSpy },
        { provide: TemplatePatcherService, useValue: templatePatcherSpy },
        {
          provide: HttpClient,
          useValue: jasmine.createSpyObj('HttpClient', ['get']),
        },
        { provide: KaspaL1NetworkService, useValue: kaspaL1NetworkServiceSpy },
        { provide: FlowPagesService, useValue: flowPagesServiceSpy },
        { provide: WideWorkspaceService, useValue: wideWorkspaceServiceSpy },
        { provide: ApprovalFlowService, useValue: approvalFlowServiceSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: routerSpy },
        { provide: Dialog, useValue: dialogSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: NotificationService, useValue: notificationServiceSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ContractsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setUpDmsClaim(options: {
    inputSompi: bigint;
    outputAmountKas: string;
    outputAddress?: string;
  }) {
    component.interactContractJson.set(JSON.stringify(DMS_COMPILED_CONTRACT));
    component.selectedContractId.set('registry-entry-1');
    component.selectedFunction = 'claim';
    component.interactOutpointTxid = 'a'.repeat(64);
    component.interactOutpointVout = '0';
    component.interactInputAmount = options.inputSompi.toString();
    component.interactOutputAddress = options.outputAddress ?? HEIR_ADDRESS;
    component.interactOutputAmount = options.outputAmountKas;
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
      expect(registryServiceSpy.updateContract).toHaveBeenCalledWith(
        'registry-entry-1',
        jasmine.objectContaining({
          outpoint: { txid: 'f'.repeat(64), vout: 1 },
          amountSompi: '100000000',
        }),
      );
      expect(registryServiceSpy.updateContract).not.toHaveBeenCalledWith(
        'registry-entry-1',
        jasmine.objectContaining({ status: 'spent' }),
      );
    });

    it('submits a full claim as a single output and marks the registry entry spent', async () => {
      setUpDmsClaim({ inputSompi: 200_000_000n, outputAmountKas: '2' });

      await component.interactContract();

      expect(lastSpendOutputs()).toEqual([
        { address: HEIR_ADDRESS, amount: 200_000_000n },
      ]);
      expect(registryServiceSpy.updateContract).toHaveBeenCalledWith(
        'registry-entry-1',
        jasmine.objectContaining({
          status: 'spent',
          spendTxid: 'f'.repeat(64),
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
        expect(registryServiceSpy.updateContract).not.toHaveBeenCalled();
      });
    }

    it('rejects a claim amount above the available balance without submitting a transaction', async () => {
      setUpDmsClaim({ inputSompi: 200_000_000n, outputAmountKas: '3' });

      await component.interactContract();

      expect(component.interactError()).toBe(
        'Withdraw amount cannot exceed the contract balance',
      );
      expect(
        walletActionServiceSpy.validateAndDoActionAfterApproval,
      ).not.toHaveBeenCalled();
      expect(registryServiceSpy.updateContract).not.toHaveBeenCalled();
    });
  });

  describe('regression — other DMS actions are unaffected', () => {
    it('still dispatches keepAlive through executeDmsKeepAlive', async () => {
      const keepAliveSpy = spyOn(
        component as any,
        'executeDmsKeepAlive',
      ).and.resolveTo();
      component.interactContractJson.set(JSON.stringify(DMS_COMPILED_CONTRACT));
      component.selectedFunction = 'keepAlive';
      component.interactOutpointTxid = 'a'.repeat(64);
      component.interactOutpointVout = '0';
      component.interactInputAmount = '200000000';

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
      component.selectedFunction = 'changeHeir';
      component.interactOutpointTxid = 'a'.repeat(64);
      component.interactOutpointVout = '0';
      component.interactInputAmount = '200000000';
      component.interactOutputAddress = HEIR_ADDRESS;

      await component.interactContract();

      expect(changeHeirSpy).toHaveBeenCalled();
      expect(
        walletActionServiceSpy.validateAndDoActionAfterApproval,
      ).not.toHaveBeenCalled();
    });
  });
});
