import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ERROR_CODES } from '@kaspacom/wallet-messages';
import { RpcConnectionStatus } from '../types/kaspa-network/rpc-connection-status.enum';
import { WalletAction, WalletActionType } from '../types/wallet-action';
import { EthereumHandleActionRequestService } from './etherium-services/etherium-handle-action-request.service';
import { KaspaNetworkActionsService } from './kaspa-netwrok-services/kaspa-network-actions.service';
import { Krc20WalletActionService } from './protocols/krc20/krc20-wallet-actions.service';
import { BaseProtocolClassesService } from './protocols/base-protocol-classes.service';
import { UtilsHelper } from './utils.service';
import { WalletActionService } from './wallet-action.service';
import { WalletService } from './wallet.service';
import { ApprovalFlowService } from '../v2/services/approval-flow.service';
import { MonitorService } from './monitor.service';

describe('WalletActionService approval gating', () => {
  let service: WalletActionService;
  let kaspaNetworkActions: jasmine.SpyObj<KaspaNetworkActionsService>;
  const connectionStatus = signal(RpcConnectionStatus.CONNECTED);
  const fundedPskt = JSON.stringify({
    inputs: [
      {
        transactionId: 'funding-tx',
        utxo: {
          address: 'kaspatest:qwallet',
          amount: '100000000',
        },
      },
    ],
    outputs: [
      {
        value: '1000000000000',
      },
    ],
  });

  beforeEach(() => {
    kaspaNetworkActions = jasmine.createSpyObj<KaspaNetworkActionsService>(
      'KaspaNetworkActionsService',
      [
        'getConnectionStatusSignal',
        'getMinimalRequiredAmountForAction',
        'getWalletBalanceAndUtxos',
      ],
    );
    kaspaNetworkActions.getConnectionStatusSignal.and.returnValue(
      connectionStatus.asReadonly(),
    );
    kaspaNetworkActions.getMinimalRequiredAmountForAction.and.resolveTo(
      2_000_000_000_000n,
    );
    kaspaNetworkActions.getWalletBalanceAndUtxos.and.resolveTo({
      totalBalance: 100_000_000n,
      utxoEntries: [
        {
          outpoint: {
            transactionId: 'funding-tx',
          },
        },
      ],
    } as never);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: WalletService,
          useValue: {
            getCurrentWallet: () => undefined,
            getWalletByIdAndAccount: () => undefined,
          },
        },
        {
          provide: UtilsHelper,
          useValue: {
            isNullOrEmptyString: (value: unknown) =>
              value === undefined || value === null || value === '',
          },
        },
        { provide: KaspaNetworkActionsService, useValue: kaspaNetworkActions },
        { provide: Krc20WalletActionService, useValue: {} },
        { provide: BaseProtocolClassesService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: EthereumHandleActionRequestService, useValue: {} },
        { provide: ApprovalFlowService, useValue: {} },
        { provide: MonitorService, useValue: {} },
      ],
    });
    service = TestBed.inject(WalletActionService);
  });

  it('keeps iframe action approval pending until the UI resolver is called', async () => {
    const action: WalletAction = {
      type: WalletActionType.SIGN_MESSAGE,
      data: {
        message: 'approve me',
      },
    };
    let isResolved = false;

    const approvalPromise = (
      service as unknown as {
        showApprovalDialogToUser: (
          action: WalletAction,
          isFromIframe: boolean,
        ) => Promise<{ isApproved: boolean }>;
      }
    )
      .showApprovalDialogToUser(action, true)
      .then((result) => {
        isResolved = true;
        return result;
      });

    await Promise.resolve();

    expect(isResolved).toBeFalse();
    expect(service.getActionToApproveSignal()()?.action).toBe(action);

    service.getActionToApproveSignal()()!.resolve({ isApproved: true });

    await expectAsync(approvalPromise).toBeResolvedTo({ isApproved: true });
    expect(isResolved).toBeTrue();
    expect(service.getActionToApproveSignal()()).toBeUndefined();
  });

  it('does not reject sign-only PSKTs because total outputs exceed current mature balance', async () => {
    const action: WalletAction = {
      type: WalletActionType.SIGN_PSKT_TRANSACTION,
      data: {
        psktTransactionJson: fundedPskt,
        signOnly: true,
        signInputs: [{ index: 0 }],
      },
    };
    const wallet = {
      getCurrentWalletStateBalanceSignalValue: () => ({ mature: 1n }),
    };

    const result = await service.validateAction(action, wallet as never);

    expect(result).toEqual({ isValidated: true });
    expect(
      kaspaNetworkActions.getMinimalRequiredAmountForAction,
    ).not.toHaveBeenCalled();
  });

  it('keeps the spend-balance precheck for PSKTs that ask the wallet to fund outputs', async () => {
    const action: WalletAction = {
      type: WalletActionType.SIGN_PSKT_TRANSACTION,
      data: {
        psktTransactionJson: fundedPskt,
        signOnly: false,
        signInputs: [{ index: 0 }],
      },
    };
    const wallet = {
      getCurrentWalletStateBalanceSignalValue: () => ({ mature: 1n }),
    };

    const result = await service.validateAction(action, wallet as never);

    expect(result).toEqual({
      isValidated: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
    });
    expect(
      kaspaNetworkActions.getMinimalRequiredAmountForAction,
    ).toHaveBeenCalledWith(action, wallet as never);
  });
});
