import { TestBed } from '@angular/core/testing';
import { ContractsDataService } from './contracts-data.service';
import { CovenantService } from '../../../../../../services/covenant/covenant.service';
import { CovenantIndexerService } from '../../../../../../services/covenant/covenant-indexer.service';
import { ContractDisplayService } from './contract-display.service';
import { CovenantTemplateService } from './covenant-template.service';
import { RpcService } from '../../../../../../services/kaspa-netwrok-services/rpc.service';
import { KaspaL1NetworkService } from '../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import {
  ContractDashboardEntry,
  ContractParticipant,
} from '../contracts-page.models';
import { IndexerCovenantDetails } from '../../../../../../services/covenant/covenant-indexer.service';
import { ContractRegistryEntry } from '../../../../../../services/covenant/contract-registry.service';

describe('ContractsDataService', () => {
  let service: ContractsDataService;
  let templateService: jasmine.SpyObj<CovenantTemplateService>;

  const baseEntry = (
    overrides: Partial<ContractDashboardEntry> = {},
  ): ContractDashboardEntry => ({
    id: 'local:1',
    source: 'local',
    contractName: 'DeadManSwitch',
    displayName: "Dead Man's Switch",
    contractTypeLabel: "Dead Man's Switch",
    status: 'active',
    amountSompi: '0',
    participants: [],
    nextActionLabel: 'Claim',
    actionHint: '',
    ...overrides,
  });

  beforeEach(() => {
    templateService = jasmine.createSpyObj('CovenantTemplateService', [
      'argsArrayToRecord',
      'pubkeyToAddress',
      'templateForIndexerName',
      'extractTemplateParamHex',
      'extractTemplateIntField',
    ]);
    templateService.argsArrayToRecord.and.callFake(
      (args: Array<{ name: string; value: string }> = []) =>
        args.reduce((record: Record<string, string>, arg) => {
          record[arg.name] = arg.value;
          return record;
        }, {}),
    );
    templateService.pubkeyToAddress.and.returnValue('');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: CovenantService,
          useValue: jasmine.createSpyObj('CovenantService', [
            'parseCompiledContract',
          ]),
        },
        {
          provide: CovenantIndexerService,
          useValue: jasmine.createSpyObj('CovenantIndexerService', [
            'listCovenants',
            'getCovenantByCanonicalId',
            'getCovenant',
            'getTransactionActions',
          ]),
        },
        { provide: CovenantTemplateService, useValue: templateService },
        {
          provide: RpcService,
          useValue: jasmine.createSpyObj('RpcService', ['getNetwork']),
        },
        {
          provide: KaspaL1NetworkService,
          useValue: jasmine.createSpyObj('KaspaL1NetworkService', [
            'getKaspaExplorerBaseurl',
            'getCovenantExplorerBaseurl',
          ]),
        },
        ContractDisplayService,
      ],
    });
    service = TestBed.inject(ContractsDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('normalizeIdentity / sameIdentity', () => {
    it('trims and lowercases for comparison', () => {
      expect(service.sameIdentity(' ABC ', 'abc')).toBeTrue();
      expect(service.sameIdentity('abc', 'def')).toBeFalse();
    });

    it('treats two empty identities as not the same', () => {
      expect(service.sameIdentity(undefined, undefined)).toBeFalse();
      expect(service.sameIdentity('', '')).toBeFalse();
    });
  });

  describe('statusFromActiveUtxoCount', () => {
    it('maps 0 active UTXOs to spent', () => {
      expect(service.statusFromActiveUtxoCount(0)).toBe('spent');
    });

    it('maps 1 active UTXO to active', () => {
      expect(service.statusFromActiveUtxoCount(1)).toBe('active');
    });

    it('maps more than 1 or undefined to tracking-incomplete', () => {
      expect(service.statusFromActiveUtxoCount(2)).toBe('tracking-incomplete');
      expect(service.statusFromActiveUtxoCount(undefined)).toBe(
        'tracking-incomplete',
      );
    });
  });

  describe('sortDashboardEntries', () => {
    it('sorts by entry time descending, id as tiebreaker', () => {
      const older = baseEntry({
        id: 'a',
        registryEntry: { deployedAt: 100 } as any,
      });
      const newer = baseEntry({
        id: 'b',
        registryEntry: { deployedAt: 200 } as any,
      });
      expect(service.sortDashboardEntries([older, newer])).toEqual([
        newer,
        older,
      ]);
    });

    it('does not mutate the input array', () => {
      const entries = [baseEntry({ id: 'a' }), baseEntry({ id: 'b' })];
      const original = [...entries];
      service.sortDashboardEntries(entries);
      expect(entries).toEqual(original);
    });
  });

  describe('rolesForCandidates', () => {
    it('matches on the participant value or matchValues, case-insensitively', () => {
      const participants: ContractParticipant[] = [
        { label: 'Owner', value: 'Kaspa:ABC' },
        { label: 'Heir', value: '', matchValues: ['deadbeef'] },
      ];
      expect(service.rolesForCandidates(participants, ['kaspa:abc'])).toEqual([
        'Owner',
      ]);
      expect(service.rolesForCandidates(participants, ['deadbeef'])).toEqual([
        'Heir',
      ]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(
        service.rolesForCandidates(
          [{ label: 'Owner', value: 'kaspa:abc' }],
          ['someone-else'],
        ),
      ).toEqual([]);
    });
  });

  describe('getNextActionLabel', () => {
    it('returns "View history" for non-active contracts', () => {
      expect(service.getNextActionLabel('DeadManSwitch', 'spent', [])).toBe(
        'View history',
      );
    });

    it('picks Keep Alive for the owner and Claim otherwise on a Dead Man Switch', () => {
      expect(
        service.getNextActionLabel('DeadManSwitch', 'active', ['Owner']),
      ).toBe('Keep Alive');
      expect(service.getNextActionLabel('DeadManSwitch', 'active', [])).toBe(
        'Claim',
      );
    });

    it('picks Recover for the recovery role on a Time-Lock Vault, Withdraw otherwise', () => {
      expect(
        service.getNextActionLabel('TimeLockVault', 'active', ['Recovery']),
      ).toBe('Recover');
      expect(service.getNextActionLabel('TimeLockVault', 'active', [])).toBe(
        'Withdraw',
      );
    });

    it('prompts signers to sign on a MultiSig Vault', () => {
      expect(
        service.getNextActionLabel('MultiSigVault', 'active', ['Signer 1']),
      ).toBe('Sign / Complete');
    });

    it('distinguishes arbiter/buyer/seller roles on an Escrow', () => {
      expect(
        service.getNextActionLabel('EscrowWithArbiter', 'active', ['Arbiter']),
      ).toBe('Arbitrate');
      expect(
        service.getNextActionLabel('EscrowWithArbiter', 'active', ['Buyer']),
      ).toBe('Release / Refund');
      expect(
        service.getNextActionLabel('EscrowWithArbiter', 'active', ['Seller']),
      ).toBe('Release');
    });
  });

  describe('extractDeadlineMs', () => {
    it('reads the deadline from claimed args and normalizes seconds to ms', () => {
      const summary: IndexerCovenantDetails = {
        claimedArgs: {
          args: [{ name: 'deadline', type: 'int', value: '2000000000' }],
        },
      };
      expect(service.extractDeadlineMs(summary)).toBe(2000000000000);
    });

    it('returns undefined when no recognizable deadline field is present', () => {
      expect(service.extractDeadlineMs({})).toBeUndefined();
    });

    it('prefers utxoState over claimedArgs/constructor', () => {
      const summary: IndexerCovenantDetails = {
        constructor: { deadline: 1 },
      };
      expect(service.extractDeadlineMs(summary, { deadline: 2000000000 })).toBe(
        2000000000000,
      );
    });
  });

  describe('getContractAlias / getContractAliasOwnerKey / getContractDisplayName', () => {
    it('prefers the alias for the given wallet key', () => {
      const contract = { aliases: { walletA: 'My Vault', walletB: 'Other' } };
      expect(service.getContractAlias(contract, 'walletA')).toBe('My Vault');
    });

    it('falls back to any non-empty alias when the wallet key has none', () => {
      const contract = { aliases: { walletB: 'Other' } };
      expect(service.getContractAlias(contract, 'walletA')).toBe('Other');
    });

    it('falls back to the contract type label when no alias exists', () => {
      const contract = { contractName: 'TimeLockVault' };
      expect(service.getContractDisplayName(contract)).toBe('Time Lock');
    });
  });

  describe('findSavedRegistryEntryForIdentity', () => {
    const registryEntries = [
      {
        network: 'mainnet',
        covenantId: 'cov1',
        deployTxid: 'tx1',
        outpoint: { txid: 'tx1', vout: 0 },
      },
      { network: 'testnet', covenantId: 'cov1' },
    ] as unknown as ContractRegistryEntry[];

    it('matches by covenantId within the same network', () => {
      expect(
        service.findSavedRegistryEntryForIdentity(
          { covenantId: 'cov1' },
          registryEntries,
          'mainnet',
        ),
      ).toBe(registryEntries[0]);
    });

    it('does not match across networks', () => {
      expect(
        service.findSavedRegistryEntryForIdentity(
          { covenantId: 'cov1' },
          registryEntries,
          'devnet',
        ),
      ).toBeUndefined();
    });

    it('matches by outpoint when covenantId/deployTxid are absent', () => {
      expect(
        service.findSavedRegistryEntryForIdentity(
          { outpoint: { txid: 'tx1', vout: 0 } },
          registryEntries,
          'mainnet',
        ),
      ).toBe(registryEntries[0]);
    });
  });

  describe('normalizeIndexerArgs', () => {
    it('expands single-letter aliased keys from an object payload', () => {
      const result = service.normalizeIndexerArgs({ h: 'hotAddr', m: 'w' });
      expect(result).toContain({
        name: 'hotKey',
        type: 'address',
        value: 'hotAddr',
      } as any);
      expect(result.find((arg) => arg.name === 'whitelistMode')?.value).toBe(
        'whitelist',
      );
    });

    it('passes through a full-form array payload', () => {
      const result = service.normalizeIndexerArgs([
        { name: 'owner', value: 'addr1', type: 'address' },
      ]);
      expect(result).toEqual([
        { name: 'owner', type: 'address', value: 'addr1' },
      ]);
    });

    it('returns an empty array for unrecognized input', () => {
      expect(service.normalizeIndexerArgs(null)).toEqual([]);
      expect(service.normalizeIndexerArgs('not an object')).toEqual([]);
    });
  });

  describe('mergeParticipants', () => {
    it('de-dupes by label + identity value, local participants take precedence', () => {
      const local: ContractParticipant[] = [{ label: 'Owner', value: 'addr1' }];
      const indexer: ContractParticipant[] = [
        { label: 'Owner', value: 'addr1' },
        { label: 'Heir', value: 'addr2' },
      ];
      expect(service.mergeParticipants(local, indexer)).toEqual([
        { label: 'Owner', value: 'addr1' },
        { label: 'Heir', value: 'addr2' },
      ]);
    });

    it('skips participants with no identity value', () => {
      const result = service.mergeParticipants(
        [{ label: 'Owner', value: '' }],
        [],
      );
      expect(result).toEqual([]);
    });
  });

  describe('extractScriptHashFromScriptPubKey', () => {
    it('extracts the 32-byte hash from a P2SH covenant scriptPubKey', () => {
      const hash = 'ab'.repeat(32);
      expect(service.extractScriptHashFromScriptPubKey(`aa20${hash}87`)).toBe(
        hash,
      );
    });

    it('returns undefined for a non-matching scriptPubKey', () => {
      expect(
        service.extractScriptHashFromScriptPubKey('76a914deadbeef88ac'),
      ).toBeUndefined();
      expect(
        service.extractScriptHashFromScriptPubKey(undefined),
      ).toBeUndefined();
    });
  });

  describe('indexerSummaryToDashboard', () => {
    it('derives status from activeUtxos and amount from totalAmountSompi', () => {
      const summary: IndexerCovenantDetails = {
        template: 'DeadManSwitch',
        covenantIdHex: 'cov1',
        genesisTxidHex: 'tx1',
        activeUtxos: 1,
        totalAmountSompi: '500000000',
      };
      const entry = service.indexerSummaryToDashboard(summary, {
        localRegistryContracts: [],
        allRegistryContracts: [],
        network: 'mainnet',
        currentRoleCandidates: [],
      });
      expect(entry.status).toBe('active');
      expect(entry.amountSompi).toBe('500000000');
      expect(entry.source).toBe('indexer');
      expect(entry.id).toBe('indexer:cov1');
    });

    it('marks the entry "both" and reuses the registry id/aliases when a matching local entry exists in the registry', () => {
      const registryEntry = {
        network: 'mainnet',
        covenantId: 'cov1',
        aliases: { walletA: 'My Vault' },
      } as unknown as ContractRegistryEntry;
      const summary: IndexerCovenantDetails = {
        template: 'DeadManSwitch',
        covenantIdHex: 'cov1',
        activeUtxos: 1,
        totalAmountSompi: '0',
      };
      const entry = service.indexerSummaryToDashboard(summary, {
        localRegistryContracts: [],
        allRegistryContracts: [registryEntry],
        network: 'mainnet',
        currentRoleCandidates: [],
      });
      expect(entry.registryEntry).toBe(registryEntry);
      expect(entry.aliasName).toBe('My Vault');
    });
  });

  describe('mergeDashboardEntries', () => {
    it('merges a local and indexer entry for the same covenant into one "both" entry, preferring the local id/aliases', () => {
      const local = baseEntry({
        id: 'local:1',
        source: 'local',
        covenantId: 'cov1',
        aliases: { walletA: 'My Vault' },
        amountSompi: '0',
      });
      const indexer = baseEntry({
        id: 'indexer:cov1',
        source: 'indexer',
        covenantId: 'cov1',
        status: 'active',
        amountSompi: '500000000',
      });

      const merged = service.mergeDashboardEntries([indexer], [local]);

      expect(merged.length).toBe(1);
      expect(merged[0].id).toBe('local:1');
      expect(merged[0].source).toBe('both');
      expect(merged[0].amountSompi).toBe('500000000');
      expect(merged[0].aliases).toEqual({ walletA: 'My Vault' });
    });

    it('keeps unrelated local and indexer entries separate', () => {
      const local = baseEntry({ id: 'local:1', covenantId: 'cov1' });
      const indexer = baseEntry({
        id: 'indexer:cov2',
        source: 'indexer',
        covenantId: 'cov2',
      });

      const merged = service.mergeDashboardEntries([indexer], [local]);

      expect(merged.map((entry) => entry.id).sort()).toEqual([
        'indexer:cov2',
        'local:1',
      ]);
    });

    it('prefers a spent local entry over other matching local candidates when merging', () => {
      // Distinct identity keys (one by deployTxid, one by covenantId) so both
      // survive the initial local pass instead of colliding into one entry;
      // the indexer entry then fuzzy-matches both via different fields.
      const spentLocal = baseEntry({
        id: 'local:spent',
        deployTxid: 'tx1',
        status: 'spent',
      });
      const activeLocal = baseEntry({
        id: 'local:active',
        covenantId: 'cov1',
        status: 'active',
      });
      const indexer = baseEntry({
        id: 'indexer:cov1',
        source: 'indexer',
        covenantId: 'cov1',
        deployTxid: 'tx1',
        status: 'active',
      });

      const merged = service.mergeDashboardEntries(
        [indexer],
        [spentLocal, activeLocal],
      );

      expect(merged.length).toBe(1);
      expect(merged[0].id).toBe('local:spent');
    });
  });
});
