import { WalletAction, WalletActionType } from '../../../types/wallet-action';
import { KRC20OperationType } from '../../../types/kaspa-network/krc20-operations-data.interface';
import * as fs from 'fs';

// Read listing data from listing_config.json
const rawData = fs.readFileSync('listing_config.json', 'utf-8');
const listingData = JSON.parse(rawData);

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
        totalPrice: parseFloat(listingData.price),
      },
  },
};

// Output the listing action that can be used to create a PSKT order
console.log('Listing Action:', JSON.stringify(listingAction, (_, value) =>
  typeof value === 'bigint' ? value.toString() : value
, 2));

/*
This creates a listing action that matches the frontend implementation:
1. Uses KRC20_ACTION type
2. Contains listing operation data with:
   - Protocol: krc-20
   - Operation: LIST
   - Token ticker: from listing_config.json
   - Amount: from listing_config.json
3. Includes PSKT data with:
   - Total price: from listing_config.json (as bigint)

This action can be used with the Kaspiano API to create and confirm the PSKT order.
*/
