import { WalletAction, WalletActionType } from '../../../types/wallet-action';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';

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

// The listing action can now be used to create a PSKT order
console.log('Listing Action:', JSON.stringify(listingAction, (_, value) =>
  typeof value === 'bigint' ? value.toString() : value
, 2));

/*
This creates a listing action that matches the frontend implementation:
1. Uses KRC20_ACTION type
2. Contains listing operation data with:
   - Protocol: krc-20
   - Operation: LIST
   - Token ticker: DARKI
   - Amount: 20000
3. Includes PSKT data with:
   - Total price: 666 (as bigint)

This action can be used with the Kaspiano API to create and confirm the PSKT order.
*/
