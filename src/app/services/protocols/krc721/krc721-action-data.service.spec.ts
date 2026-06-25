import { WalletActionResultType } from "@kaspacom/wallet-messages";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { Krc721CompletedActionDataService } from "./krc721-completed-action-data.service";
import { Krc721ReviewActionDataService } from "./krc721-review-action-data.service";

describe('KRC721 action display services', () => {
    const walletAddress = 'kaspatest:qwalletaddress';
    const wallet = { getAddress: () => walletAddress } as unknown as AppWallet;
    const kaspaNetworkActionsService = {
        sompiToNumber: (amount: bigint) => Number(amount) / 100_000_000,
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

    describe('Krc721ReviewActionDataService', () => {
        let service: Krc721ReviewActionDataService;

        beforeEach(() => {
            service = new Krc721ReviewActionDataService(kaspaNetworkActionsService as any);
        });

        it('displays KRC721 list actions with collection, token id, wallet, and PSKT price', () => {
            const display = service.getActionDisplay(commitRevealAction({
                p: 'krc-721',
                op: 'list',
                tick: 'nftx',
                tokenId: '12',
            }, {
                revealPskt: {
                    outputs: [
                        { address: walletAddress, amount: 150_000_000n },
                        { address: 'kaspatest:qcommission', amount: 10_000_000n },
                    ],
                    script: {} as any,
                }
            }), wallet);

            expect(display?.title).toBe('List KRC721 NFT');
            expect(display?.rows).toContain(jasmine.objectContaining({
                fieldName: 'Collection',
                fieldValue: 'NFTX',
            }));
            expect(display?.rows).toContain(jasmine.objectContaining({
                fieldName: 'Token ID',
                fieldValue: '12',
            }));
            expect(display?.rows).toContain(jasmine.objectContaining({
                fieldName: 'Price',
                fieldValue: '1.5 KAS',
            }));
        });

        it('displays KRC721 send with commit transaction id as cancel listing', () => {
            const display = service.getActionDisplay(commitRevealAction({
                p: 'krc-721',
                op: 'send',
                tick: 'nftx',
                tokenId: '12',
            }, {
                commitTransactionId: 'listing-commit-tx',
            }), wallet);

            expect(display?.title).toBe('Cancel KRC721 NFT Listing');
            expect(display?.rows).toContain(jasmine.objectContaining({
                fieldName: 'List Transaction Id',
                fieldValue: 'listing-commit-tx',
            }));
        });
    });

    describe('Krc721CompletedActionDataService', () => {
        let service: Krc721CompletedActionDataService;

        beforeEach(() => {
            service = new Krc721CompletedActionDataService();
        });

        it('displays completed KRC721 send as a cancel listing transaction', () => {
            const display = service.getActionDisplay({
                type: WalletActionResultType.CommitReveal,
                performedByWallet: walletAddress,
                commitTransactionId: 'listing-commit-tx',
                revealTransactionId: 'reveal-tx',
                protocol: 'kspr',
                protocolAction: JSON.stringify({
                    p: 'krc-721',
                    op: 'send',
                    tick: 'nftx',
                    tokenId: '12',
                }),
            });

            expect(display?.title).toBe('Cancel KRC721 NFT Listing Transaction');
            expect(display?.rows).toContain(jasmine.objectContaining({
                fieldName: 'Reveal Transaction Id',
                fieldValue: 'reveal-tx',
            }));
        });
    });
});
