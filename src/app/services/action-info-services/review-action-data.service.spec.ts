import { TestBed } from '@angular/core/testing';
import { hexlify, toUtf8Bytes } from 'ethers';
import { EIP1193RequestType } from '@kaspacom/wallet-messages';
import { ReviewActionDataService } from './review-action-data.service';
import { KaspaNetworkActionsService } from '../kaspa-netwrok-services/kaspa-network-actions.service';
import { BaseProtocolClassesService } from '../protocols/base-protocol-classes.service';
import { AppWallet } from '../../classes/AppWallet';
import { WalletAction, WalletActionType } from '../../types/wallet-action';
import { areRequiredAcknowledgementsAccepted } from '../../types/action-display.type';

describe('ReviewActionDataService', () => {
  const walletAddress = '0xWalletAddress';
  const wallet = { getAddress: () => walletAddress } as unknown as AppWallet;
  let service: ReviewActionDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: KaspaNetworkActionsService,
          useValue: { sompiToNumber: (value: bigint) => Number(value) / 1e8 },
        },
        { provide: BaseProtocolClassesService, useValue: {} },
      ],
    });
    service = TestBed.inject(ReviewActionDataService);
  });

  function personalSignAction(params: [string, string]): WalletAction {
    return {
      type: WalletActionType.EIP1193_PROVIDER_REQUEST,
      data: {
        method: EIP1193RequestType.PERSONAL_SIGN,
        params,
      },
    } as unknown as WalletAction;
  }

  describe('Dot.K transfer display', () => {
    it('shows dropped subnames and requires destructive-action acknowledgement', () => {
      const action = {
        type: WalletActionType.SIGN_PSKT_TRANSACTION,
        data: {
          psktTransactionJson: '{}',
          dotkTransfer: {
            name: 'alice',
            displayName: 'alice.k',
            recipient: 'kaspa:recipient',
            feeSompi: 1000n,
            network: 'mainnet',
            recordsCardRetired: true,
            recordEffectsUncertain: false,
            recordKeysDropped: ['url'],
            plan: {
              cards: {
                minted: false,
                swept: 1,
                value: 0n,
                carried: [],
                dropped: [],
                subnames: [],
                subnamesDropped: [
                  {
                    label: 'bob',
                    address: 'kaspa:subname-wallet',
                  },
                ],
                cardRead: true,
                complete: true,
              },
            },
          },
        },
      } as unknown as WalletAction;

      const display = service.getActionDisplay(action, wallet);
      const droppedSubnames = display?.rows.find(
        (row) => row.fieldName === 'Subnames that will stop resolving',
      );
      const acknowledgement = display?.rows.find(
        (row) => row.inputField?.fieldParam === 'acknowledgeDotkDataLoss',
      );

      expect(display?.warning).toContain('subnames can stop resolving');
      expect(droppedSubnames?.fieldValue).toContain(
        'bob.alice.k -> kaspa:subname-wallet',
      );
      expect(acknowledgement?.inputField?.requiredToApprove).toBeTrue();
      expect(areRequiredAcknowledgementsAccepted(display, {})).toBeFalse();
      expect(
        areRequiredAcknowledgementsAccepted(display, {
          acknowledgeDotkDataLoss: true,
        }),
      ).toBeTrue();
    });

    it('requires acknowledgement for a live regular-record card with no subnames', () => {
      const action = {
        type: WalletActionType.SIGN_PSKT_TRANSACTION,
        data: {
          psktTransactionJson: '{}',
          dotkTransfer: {
            name: 'alice',
            displayName: 'alice.k',
            recipient: 'kaspa:recipient',
            feeSompi: 1000n,
            network: 'mainnet',
            recordsCardRetired: true,
            recordEffectsUncertain: false,
            recordKeysDropped: ['url'],
            plan: {
              cards: {
                minted: false,
                swept: 0,
                value: 0n,
                carried: [],
                dropped: [],
                subnames: [],
                subnamesDropped: [],
                cardRead: true,
                complete: true,
              },
            },
          },
        },
      } as unknown as WalletAction;

      const display = service.getActionDisplay(action, wallet);

      expect(
        display?.rows.find((row) => row.fieldName === 'Records removed')
          ?.fieldValue,
      ).toBe('url');
      expect(
        display?.rows.find(
          (row) => row.inputField?.fieldParam === 'acknowledgeDotkDataLoss',
        )?.inputField?.requiredToApprove,
      ).toBeTrue();
    });
  });

  describe('personal_sign display', () => {
    const messageText = 'Sign in with Ethereum';
    const messageHex = hexlify(toUtf8Bytes(messageText));
    const signerAddress = '0x1234567890123456789012345678901234567890';

    it('decodes the message when params are [data, address] (canonical order)', () => {
      const display = service.getActionDisplay(
        personalSignAction([messageHex, signerAddress]),
        wallet,
      );

      expect(display?.title).toBe('Signature Request');
      expect(display?.rows).toContain(
        jasmine.objectContaining({
          fieldName: 'Message',
          fieldValue: messageText,
        }),
      );
    });

    it('decodes the message when params are [address, data] (legacy eth_sign order)', () => {
      const display = service.getActionDisplay(
        personalSignAction([signerAddress, messageHex]),
        wallet,
      );

      expect(display?.rows).toContain(
        jasmine.objectContaining({
          fieldName: 'Message',
          fieldValue: messageText,
        }),
      );
    });

    it('falls back to the raw hex when the message is not valid UTF-8', () => {
      const invalidUtf8Hex = '0xff';

      const display = service.getActionDisplay(
        personalSignAction([invalidUtf8Hex, signerAddress]),
        wallet,
      );

      expect(display?.rows).toContain(
        jasmine.objectContaining({
          fieldName: 'Message',
          fieldValue: invalidUtf8Hex,
        }),
      );
    });
  });
});
