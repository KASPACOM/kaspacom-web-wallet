import fs from 'fs';

try {
    console.log('Starting listing test script...');
    console.log('Current working directory:', process.cwd());
    
    // Enum definitions matching the TypeScript types
    const WalletActionType = {
        KRC20_ACTION: 'KRC20_ACTION'
    };

    const KRC20OperationType = {
        LIST: 'LIST'
    };

    console.log('Reading listing_config.json...');
    // Read listing data from listing_config.json
    const rawData = fs.readFileSync('listing_config.json', 'utf-8');
    console.log('Raw data:', rawData);
    
    const listingData = JSON.parse(rawData);
    console.log('Parsed listing data:', listingData);

    // Create the listing operation data following the same structure as Krc20OperationDataService
    const listingOperationData = {
        p: 'krc-20',
        op: KRC20OperationType.LIST,
        tick: listingData.token,
        amt: listingData.quantity,
    };
    console.log('Created listing operation data:', listingOperationData);

    // Create the wallet action following WalletActionService.createListKrc20Action structure
    const listingAction = {
        type: WalletActionType.KRC20_ACTION,
        data: {
            operationData: listingOperationData,
            psktData: {
                totalPrice: parseFloat(listingData.price),
            },
        },
    };

    // Output the listing action that can be used to create a PSKT order
    console.log('\nFinal Listing Action:');
    console.log(JSON.stringify(listingAction, null, 2));
} catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}
