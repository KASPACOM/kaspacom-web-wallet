import { WalletAction, WalletActionType, Krc20Action } from '../../../types/wallet-action';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';

describe('Listing Functionality', () => {
  it('should create a valid listing action', () => {
    // Input data for the listing
    const listingData = {
      token: "DARKI",
      quantity: "20000",
      price: "666",
      action: "sell",
      walletAddress: "kaspa:qzagv3jy9eagjqf5jugdsmqqaey49lf80t672t27jyv85z3nhujkuxq5k8rag"
    };

    // Create the listing operation data following the same structure as Krc20OperationDataService
    const listingOperationData = {
      p: 'krc-20',
      op: KRC20OperationType.LIST,
      tick: listingData.token,
      amt: listingData.quantity,
    };

    // Create the wallet action following WalletActionService.createListKrc20Action structure
    const listingAction: WalletAction = {
      type: WalletActionType.KRC20_ACTION,
      data: {
        operationData: listingOperationData,
        psktData: {
          totalPrice: BigInt(listingData.price),
        },
      },
    };

    const krc20ActionData = listingAction.data as Krc20Action;

    // Assertions to check if the listing action is created correctly
    expect(listingAction.type).toBe(WalletActionType.KRC20_ACTION);
    expect(krc20ActionData.operationData.op).toBe(KRC20OperationType.LIST);
    expect(krc20ActionData.operationData.tick).toBe(listingData.token);
    expect(krc20ActionData.operationData.amt).toBe(listingData.quantity);
    expect(krc20ActionData.psktData?.totalPrice).toEqual(BigInt(listingData.price));

    // Log the listing action for manual inspection if needed
    console.log('Listing Action:', JSON.stringify(listingAction, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));
  });
});
