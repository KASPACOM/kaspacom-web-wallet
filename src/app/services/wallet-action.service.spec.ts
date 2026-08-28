import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
  const connectionStatus = signal(RpcConnectionStatus.CONNECTED);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WalletService,
          useValue: {
            getCurrentWallet: () => undefined,
            getWalletByIdAndAccount: () => undefined,
          },
        },
        { provide: UtilsHelper, useValue: {} },
        {
          provide: KaspaNetworkActionsService,
          useValue: {
            getConnectionStatusSignal: () => connectionStatus.asReadonly(),
          },
        },
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
});
