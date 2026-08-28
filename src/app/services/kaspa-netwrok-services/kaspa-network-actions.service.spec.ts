import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProtocolType } from '@kaspacom/wallet-messages';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import { CommitRevealAction } from '../../types/wallet-action';
import { UtilsHelper } from '../utils.service';
import { CovenantService } from '../covenant/covenant.service';
import { KaspaWalletMnemonicActionsService } from './kaspa-wallet-mnemonic-actions.service';
import { KaspaNetworkActionsService } from './kaspa-network-actions.service';
import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';

describe('KaspaNetworkActionsService reveal PSKT script validation', () => {
  let service: KaspaNetworkActionsService;
  const walletAddress = 'kaspatest:qwalletaddress';
  const transactionsManager = {
    createGenericScriptFromString: (
      type: ProtocolType | string,
      stringifyAction: string,
      address: string,
    ) => ({
      scriptAddress: `script-address:${type}:${address}:${stringifyAction}`,
      scriptData: `script-data:${type}:${address}:${stringifyAction}`,
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: KaspaNetworkTransactionsManagerService,
          useValue: transactionsManager,
        },
        {
          provide: UtilsHelper,
          useValue: {
            stringifyProtocolAction: (action: unknown) =>
              JSON.stringify(action, null, 0),
          },
        },
        {
          provide: KaspaWalletMnemonicActionsService,
          useValue: {},
        },
        {
          provide: CovenantService,
          useValue: {},
        },
      ],
    });
    service = TestBed.inject(KaspaNetworkActionsService);
    spyOn(service, 'getConnectionStatusSignal').and.returnValue(
      signal(RpcConnectionStatus.CONNECTED).asReadonly(),
    );
  });

  it('accepts a KRC20 list reveal PSKT only when it matches the local send script', () => {
    const action = commitRevealAction(
      ProtocolType.KASPLEX,
      {
        p: 'krc-20',
        op: 'list',
        tick: 'KAS',
        amt: '10',
      },
      { scriptAddress: '', scriptData: '' },
    );
    const expectedScript = service.getDeterministicRevealPsktScript(
      action,
      walletAddress,
    )!;

    action.options!.revealPskt!.script = expectedScript;
    expect(
      service.isRevealPsktScriptDeterministic(action, walletAddress),
    ).toBeTrue();

    action.options!.revealPskt!.script = {
      ...expectedScript,
      scriptData: `${expectedScript.scriptData}:mutated`,
    };
    expect(
      service.isRevealPsktScriptDeterministic(action, walletAddress),
    ).toBeFalse();
  });

  it('derives KRC721 and KNS reveal send scripts from their list actions', () => {
    const krc721Action = commitRevealAction(
      ProtocolType.KSPR,
      {
        p: 'krc-721',
        op: 'list',
        tick: 'NFTX',
        tokenId: '12',
      },
      { scriptAddress: '', scriptData: '' },
    );
    const knsAction = commitRevealAction(
      ProtocolType.KNS,
      {
        p: 'domain',
        op: 'list',
        id: 'asset-id',
      },
      { scriptAddress: '', scriptData: '' },
    );

    expect(
      service.getDeterministicRevealPsktScript(krc721Action, walletAddress)!
        .scriptData,
    ).toContain('{"p":"krc-721","op":"send","tick":"nftx","tokenId":"12"}');
    expect(
      service.getDeterministicRevealPsktScript(knsAction, walletAddress)!
        .scriptData,
    ).toContain('{"op":"send","id":"asset-id"}');
  });

  it('rejects reveal PSKT scripts for unsupported commit-reveal shapes', () => {
    const action = commitRevealAction(
      ProtocolType.KASPLEX,
      {
        p: 'krc-20',
        op: 'transfer',
        tick: 'kas',
        to: 'kaspatest:qrecipient',
        amt: '1',
      },
      { scriptAddress: 'external-address', scriptData: 'external-script' },
    );

    expect(
      service.isRevealPsktScriptDeterministic(action, walletAddress),
    ).toBeFalse();
  });
});

function commitRevealAction(
  type: ProtocolType,
  protocolAction: object,
  script: { scriptAddress: string; scriptData: string },
): CommitRevealAction {
  return {
    actionScript: {
      type,
      stringifyAction: JSON.stringify(protocolAction),
    },
    options: {
      revealPskt: {
        script,
      },
    },
  } as CommitRevealAction;
}
