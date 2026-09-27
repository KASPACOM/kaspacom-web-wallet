import { TestBed } from '@angular/core/testing';
import type { Nodes, Tx } from '@dotk/sdk-tx';
import { Transaction } from '../../../../public/kaspa/kaspa';
import { AppWallet } from '../../classes/AppWallet';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import { DotkService } from './dotk.service';

describe('DotkService', () => {
  it('uses the fresh proven card when the cached asset missed regular records', async () => {
    TestBed.configureTestingModule({
      providers: [
        DotkService,
        { provide: KaspaL1NetworkService, useValue: {} },
        { provide: RpcService, useValue: {} },
      ],
    });

    const plan = {
      name: 'alice',
      recipient: 'kaspatest:recipient',
      fee: 1000n,
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
      assembled: {
        tx: {
          inputs: [
            {
              previousOutpoint: {
                transactionId: 'current-deed-transaction',
                index: 0,
              },
            },
          ],
        },
      },
    };
    const registrar = {
      planTransfer: jasmine.createSpy('planTransfer').and.resolveTo(plan),
    };
    const dotk = {
      network: 'testnet-10',
      display: () => 'alice.k',
      resolveName: jasmine.createSpy('resolveName').and.resolveTo({
        proven: true,
        card: {
          proven: true,
          outpointTxid: 'current-deed-transaction',
        },
        records: { url: 'https://alice.example' },
      }),
    };
    const service = TestBed.inject(DotkService);
    spyOn<any>(service, 'createRegistrar').and.returnValue({ dotk, registrar });

    const result = await service.planTransfer(
      'alice',
      'kaspatest:recipient',
      {} as AppWallet,
    );

    expect(result.recordsCardRetired).toBeTrue();
    expect(result.recordEffectsUncertain).toBeFalse();
    expect(result.recordKeysDropped).toEqual(['url']);
    expect(dotk.resolveName).toHaveBeenCalledOnceWith('alice');
  });

  it('loads the wallet summary without requiring a Kaspa node', async () => {
    TestBed.configureTestingModule({
      providers: [
        DotkService,
        {
          provide: KaspaL1NetworkService,
          useValue: {},
        },
        {
          provide: RpcService,
          useValue: {},
        },
      ],
    });

    const namesOf = jasmine.createSpy('namesOf').and.resolveTo([
      {
        name: 'alice',
        display: 'alice.k',
        deedAddress: 'kaspatest:deed',
        proven: null,
        primary: false,
        card: null,
        records: {},
      },
    ]);
    const service = TestBed.inject(DotkService);
    const createClient = spyOn<any>(service, 'createClient').and.returnValue({
      namesOf,
      ownerOf: () => ({ ownerType: 0, owner: 'owner' }),
      prefix: 'kaspatest',
    });

    await expectAsync(
      service.getNamesByAddress('kaspatest:wallet'),
    ).toBeResolvedTo([
      {
        name: 'alice',
        display: 'alice.k',
        deedAddress: 'kaspatest:deed',
        proven: null,
        primary: false,
        hasRecordsCard: false,
        recordKeys: [],
        subnames: [],
      },
    ]);
    expect(createClient).toHaveBeenCalledOnceWith(false);
    expect(namesOf).toHaveBeenCalledOnceWith('kaspatest:wallet');
  });

  it('restores safe JSON numbers into a native Kaspa transaction before broadcast', async () => {
    const nativeTransaction = {} as Transaction;
    const submitTransaction = jasmine
      .createSpy('submitTransaction')
      .and.resolveTo({ transactionId: 'dotk-transaction-id' });
    const rpc = { submitTransaction };

    TestBed.configureTestingModule({
      providers: [
        DotkService,
        {
          provide: KaspaL1NetworkService,
          useValue: { getNetworkId: () => 'kaspatest-10' },
        },
        {
          provide: RpcService,
          useValue: { getRpc: () => rpc },
        },
      ],
    });

    const deserialize = spyOn(
      Transaction,
      'deserializeFromSafeJSON',
    ).and.returnValue(nativeTransaction);
    const service = TestBed.inject(DotkService);
    const nodes = (service as unknown as { getNodes(): Nodes }).getNodes();
    const transaction: Tx = {
      version: 1,
      inputs: [],
      outputs: [],
      lockTime: 0n,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0n,
      payload: '',
    };

    await expectAsync(nodes.tx.submit(transaction)).toBeResolvedTo(
      'dotk-transaction-id',
    );

    const safeJson = deserialize.calls.mostRecent().args[0];
    expect(JSON.parse(safeJson).lockTime).toBe('0');
    expect(submitTransaction).toHaveBeenCalledOnceWith({
      transaction: nativeTransaction,
      allowOrphan: false,
    });
  });
});
