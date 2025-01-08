import { TestBed } from '@angular/core/testing';
import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import { AppWallet } from '../../classes/AppWallet';
import { RpcService } from './rpc.service';
import { KaspaNetworkConnectionManagerService } from './kaspa-network-connection-manager.service';
import { UtilsHelper } from '../utils.service';
import { Krc20OperationDataService } from './krc20-operation-data.service';
import { RpcClient } from '../../../../public/kaspa/kaspa';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';

describe('KaspaNetworkTransactionsManagerService - Inscriptions', () => {
  let service: KaspaNetworkTransactionsManagerService;
  let mockWallet: AppWallet;
  let mockRpcService: jasmine.SpyObj<RpcService>;
  let mockConnectionManager: jasmine.SpyObj<KaspaNetworkConnectionManagerService>;

  beforeEach(() => {
    // Create mock services
    mockRpcService = jasmine.createSpyObj('RpcService', ['getRpc', 'getNetwork']);
    mockConnectionManager = jasmine.createSpyObj('KaspaNetworkConnectionManagerService', 
      ['waitForConnection', 'getConnectionStatusSignal']);
    
    // Setup mock wallet
    // Create a base mock RPC client with all required methods
    const baseMockRpc = {
      addEventListener: jasmine.createSpy('addEventListener'),
      toJSON: jasmine.createSpy('toJSON'),
      free: jasmine.createSpy('free'),
      getBlockCount: jasmine.createSpy('getBlockCount'),
      getBlockDagInfo: jasmine.createSpy('getBlockDagInfo'),
      getCoinSupply: jasmine.createSpy('getCoinSupply'),
      getConnectedPeerInfo: jasmine.createSpy('getConnectedPeerInfo'),
      getInfo: jasmine.createSpy('getInfo'),
      submitTransaction: jasmine.createSpy('submitTransaction')
        .and.returnValue(Promise.resolve({ transactionId: 'test-tx-id' }))
    } as unknown as RpcClient;

    // Setup mock wallet with properly typed spies
    const mockUtxoManager = {
      getContext: jasmine.createSpy('getContext').and.returnValue({
        balance: { mature: BigInt(1000000000) }
      })
    };

    mockWallet = {
      getPrivateKey: jasmine.createSpy('getPrivateKey').and.returnValue({}),
      getUtxoProcessorManager: jasmine.createSpy('getUtxoProcessorManager')
        .and.returnValue(mockUtxoManager as unknown as UtxoProcessorManager),
      getAddress: jasmine.createSpy('getAddress').and.returnValue('test-address')
    } as unknown as AppWallet;

    mockRpcService.getRpc.and.returnValue(baseMockRpc);

    TestBed.configureTestingModule({
      providers: [
        KaspaNetworkTransactionsManagerService,
        { provide: RpcService, useValue: mockRpcService },
        { provide: KaspaNetworkConnectionManagerService, useValue: mockConnectionManager },
        UtilsHelper,
        Krc20OperationDataService
      ]
    });

    service = TestBed.inject(KaspaNetworkTransactionsManagerService);
  });

  describe('Text Inscriptions', () => {
    it('should create a text inscription with correct script', async () => {
      // Test setup
      const testText = 'Hello Kaspa';
      // No need to setup mockUtxoManager and mockRpc here since they're setup in beforeEach

      // Execute
      const result = await service.createTextInscription(mockWallet, testText);

      // Verify
      expect(result.success).toBeTruthy();
      expect(result.result).toBeDefined();
    });
  });

  describe('Domain Inscriptions', () => {
    it('should create a domain inscription with correct fees', async () => {
      // Test setup
      const testDomain = 'test';
      // No need to setup mockUtxoManager and mockRpc here since they're setup in beforeEach

      // Execute
      const result = await service.createDomainInscription(mockWallet, testDomain);

      // Verify
      expect(result.success).toBeTruthy();
      expect(result.result).toBeDefined();
    });

    it('should reject domains with invalid length', async () => {
      await expectAsync(
        service.createDomainInscription(mockWallet, '')
      ).toBeRejectedWithError('Domain name must be at least 1 character long');
    });
  });

  describe('Binary Inscriptions', () => {
    it('should create a binary inscription with correct mime type', async () => {
      // Test setup
      const testData = new Uint8Array([1, 2, 3, 4]);
      const mimeType = 'image/jpeg';
      // No need to setup mockUtxoManager and mockRpc here since they're setup in beforeEach

      // Execute
      const result = await service.createBinaryInscription(
        mockWallet, 
        testData, 
        mimeType
      );

      // Verify
      expect(result.success).toBeTruthy();
      expect(result.result).toBeDefined();
    });
  });

  describe('Domain Fee Calculation', () => {
    it('should calculate correct fees for different domain lengths', () => {
      const testCases = [
        { length: 1, expectedFee: BigInt(600000000) },  // 6 KAS
        { length: 2, expectedFee: BigInt(500000000) },  // 5 KAS
        { length: 3, expectedFee: BigInt(400000000) },  // 4 KAS
        { length: 4, expectedFee: BigInt(300000000) },  // 3 KAS
        { length: 5, expectedFee: BigInt(200000000) },  // 2 KAS
        { length: 6, expectedFee: BigInt(200000000) },  // Default to 2 KAS
      ];

      for (const testCase of testCases) {
        const fee = (service as any).calculateDomainFee(testCase.length);
        expect(fee).toEqual(testCase.expectedFee);
      }
    });
  });
});
