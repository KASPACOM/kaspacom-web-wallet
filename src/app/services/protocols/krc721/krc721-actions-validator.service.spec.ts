import { ERROR_CODES } from "@kaspacom/wallet-messages";
import { of } from "rxjs";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { Krc721ActionsValidatorService } from "./krc721-actions-validator.service";

describe('Krc721ActionsValidatorService', () => {
    let service: Krc721ActionsValidatorService;
    const walletAddress = 'kaspatest:qwalletaddress';
    const wallet = { getAddress: () => walletAddress } as unknown as AppWallet;
    const utils = {
        isNullOrEmptyString: (value: string | undefined | null) => !value || value.trim().length === 0,
        isValidWalletAddress: () => true,
        isNumberString: (value: string) => /^\d+(\.\d+)?$/.test(value),
    };
    const krc721Api = {
        getTokenDetails: jasmine.createSpy('getTokenDetails'),
    };

    function commitRevealAction(protocolAction: object, options?: CommitRevealAction['options']): CommitRevealAction {
        return {
            actionScript: {
                type: 'kspr',
                stringifyAction: JSON.stringify(protocolAction),
            },
            options,
        } as CommitRevealAction;
    }

    beforeEach(() => {
        krc721Api.getTokenDetails.calls.reset();
        krc721Api.getTokenDetails.and.returnValue(of({
            result: {
                owner: walletAddress,
            },
        }));
        service = new Krc721ActionsValidatorService(utils as any, krc721Api as any);
    });

    it('validates KRC721 list actions with ticker and token id', async () => {
        const action = commitRevealAction({
            p: 'krc-721',
            op: 'list',
            tick: 'nftx',
            tokenId: '12',
        });

        await expectAsync(service.validateCommitRevealAction(action, wallet)).toBeResolvedTo({
            isValidated: true,
        });
        expect(krc721Api.getTokenDetails).toHaveBeenCalledWith('nftx', '12');
    });

    it('rejects KRC721 list actions when the wallet is not the NFT owner', async () => {
        krc721Api.getTokenDetails.and.returnValue(of({
            result: {
                owner: 'kaspatest:qotherwallet',
            },
        }));
        const action = commitRevealAction({
            p: 'krc-721',
            op: 'list',
            tick: 'nftx',
            tokenId: '12',
        });

        await expectAsync(service.validateCommitRevealAction(action, wallet)).toBeResolvedTo({
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
        });
    });

    it('validates KRC721 send delist actions when commit transaction id is provided', async () => {
        const action = commitRevealAction({
            p: 'krc-721',
            op: 'send',
            tick: 'nftx',
            tokenId: '12',
        }, {
            commitTransactionId: 'listing-commit-tx',
        });

        await expectAsync(service.validateCommitRevealAction(action, wallet)).toBeResolvedTo({
            isValidated: true,
        });
    });

    it('rejects KRC721 send actions without a commit transaction id', async () => {
        const action = commitRevealAction({
            p: 'krc-721',
            op: 'send',
            tick: 'nftx',
            tokenId: '12',
        });

        await expectAsync(service.validateCommitRevealAction(action, wallet)).toBeResolvedTo({
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.REVEAL_WITH_NO_COMMIT_ACTION,
        });
    });

    it('rejects KRC721 send actions without a token id', async () => {
        const action = commitRevealAction({
            p: 'krc-721',
            op: 'send',
            tick: 'nftx',
        }, {
            commitTransactionId: 'listing-commit-tx',
        });

        await expectAsync(service.validateCommitRevealAction(action, wallet)).toBeResolvedTo({
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
        });
    });
});
