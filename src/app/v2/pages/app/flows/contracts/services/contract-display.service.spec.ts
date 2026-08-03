import { TestBed } from '@angular/core/testing';
import { ContractDisplayService } from './contract-display.service';
import { RpcService } from '../../../../../../services/kaspa-netwrok-services/rpc.service';
import { KaspaL1NetworkService } from '../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { ContractDashboardEntry } from '../contracts-page.models';

describe('ContractDisplayService', () => {
  let service: ContractDisplayService;
  let rpcService: jasmine.SpyObj<RpcService>;
  let kaspaL1NetworkService: jasmine.SpyObj<KaspaL1NetworkService>;

  beforeEach(() => {
    rpcService = jasmine.createSpyObj('RpcService', ['getNetwork']);
    kaspaL1NetworkService = jasmine.createSpyObj('KaspaL1NetworkService', [
      'getKaspaExplorerBaseurl',
      'getCovenantExplorerBaseurl',
    ]);
    kaspaL1NetworkService.getKaspaExplorerBaseurl.and.returnValue(
      'https://explorer.kaspa.org',
    );
    kaspaL1NetworkService.getCovenantExplorerBaseurl.and.returnValue(
      undefined,
    );
    rpcService.getNetwork.and.returnValue('mainnet');

    TestBed.configureTestingModule({
      providers: [
        { provide: RpcService, useValue: rpcService },
        { provide: KaspaL1NetworkService, useValue: kaspaL1NetworkService },
      ],
    });
    service = TestBed.inject(ContractDisplayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getExplorerAddressLink', () => {
    it('builds an address link off the kaspa explorer base url', () => {
      expect(service.getExplorerAddressLink('kaspa:abc')).toBe(
        'https://explorer.kaspa.org/addresses/kaspa:abc',
      );
    });
  });

  describe('getExplorerLink', () => {
    it('falls back to the kaspa explorer when no covenant explorer is configured', () => {
      expect(service.getExplorerLink('tx123')).toBe(
        'https://explorer.kaspa.org/txs/tx123',
      );
    });

    it('prefers the covenant explorer when configured', () => {
      kaspaL1NetworkService.getCovenantExplorerBaseurl.and.returnValue(
        'https://covenants.kaspa.com',
      );
      expect(service.getExplorerLink('tx123')).toBe(
        'https://covenants.kaspa.com/tx/tx123',
      );
    });
  });

  describe('getCovenantExplorerLink', () => {
    it('returns undefined when no covenant explorer is configured', () => {
      expect(service.getCovenantExplorerLink('cov1')).toBeUndefined();
    });

    it('builds a covenant link when configured', () => {
      kaspaL1NetworkService.getCovenantExplorerBaseurl.and.returnValue(
        'https://covenants.kaspa.com',
      );
      expect(service.getCovenantExplorerLink('cov1')).toBe(
        'https://covenants.kaspa.com/covenants/cov1',
      );
    });
  });

  describe('truncate', () => {
    it('returns short strings unchanged', () => {
      expect(service.truncate('abc')).toBe('abc');
    });

    it('truncates long strings to head...tail', () => {
      const value = 'a'.repeat(10) + 'b'.repeat(10);
      expect(service.truncate(value, 8)).toBe(
        'a'.repeat(8) + '...' + 'b'.repeat(6),
      );
    });

    it('is null-safe', () => {
      expect(service.truncate(null)).toBe('');
      expect(service.truncate(undefined)).toBe('');
    });
  });

  describe('formatSompiToKas', () => {
    it('converts sompi to KAS and trims trailing zeros', () => {
      expect(service.formatSompiToKas('100000000')).toBe('1');
      expect(service.formatSompiToKas('150000000')).toBe('1.5');
    });

    it('returns "0" for empty/invalid input', () => {
      expect(service.formatSompiToKas('')).toBe('0');
      expect(service.formatSompiToKas('not-a-number')).toBe('0');
    });
  });

  describe('getSourceLabel / getSourceLabels', () => {
    const entry = (source: ContractDashboardEntry['source']) =>
      ({ source }) as ContractDashboardEntry;

    it('labels a local-only entry', () => {
      expect(service.getSourceLabels(entry('local'))).toEqual(['Local']);
      expect(service.getSourceLabel(entry('local'))).toBe('Local');
    });

    it('labels an indexer-only entry', () => {
      expect(service.getSourceLabels(entry('indexer'))).toEqual(['Indexer']);
    });

    it('labels an entry sourced from both', () => {
      expect(service.getSourceLabels(entry('both'))).toEqual([
        'Local',
        'Indexer',
      ]);
      expect(service.getSourceLabel(entry('both'))).toBe('Local + Indexer');
    });
  });

  describe('getStatusLabel', () => {
    it('maps known statuses to labels', () => {
      expect(
        service.getStatusLabel({ status: 'active' } as ContractDashboardEntry),
      ).toBe('Active');
      expect(
        service.getStatusLabel({ status: 'spent' } as ContractDashboardEntry),
      ).toBe('Spent');
      expect(
        service.getStatusLabel({
          status: 'tracking-incomplete',
        } as ContractDashboardEntry),
      ).toBe('Tracking incomplete');
    });
  });

  describe('formatTimestamp', () => {
    it('returns "Unknown" for falsy/invalid values', () => {
      expect(service.formatTimestamp(undefined)).toBe('Unknown');
      expect(service.formatTimestamp(null)).toBe('Unknown');
      expect(service.formatTimestamp(0)).toBe('Unknown');
    });

    it('formats a valid timestamp', () => {
      const ts = new Date('2024-01-01T00:00:00Z').getTime();
      expect(service.formatTimestamp(ts)).toBe(new Date(ts).toLocaleString());
    });
  });

  describe('formatActionName', () => {
    it('maps known actions to display labels', () => {
      expect(service.formatActionName('spend12')).toBe('MultiSig Spend');
      expect(service.formatActionName('unvault')).toBe('Start Unvault');
    });

    it('falls back to the raw action name when unmapped', () => {
      expect(service.formatActionName('someCustomAction')).toBe(
        'someCustomAction',
      );
    });
  });

  describe('normalizeContractName', () => {
    it('strips non-alphanumeric characters and applies aliases', () => {
      expect(service.normalizeContractName("Dead Man's Switch")).toBe(
        'DeadManSwitch',
      );
      expect(service.normalizeContractName('Escrow')).toBe(
        'EscrowWithArbiter',
      );
      expect(service.normalizeContractName('SelfCustody')).toBe(
        'SelfCustodyVault',
      );
    });

    it('passes through unrecognized names unchanged (after stripping)', () => {
      expect(service.normalizeContractName('Some-Weird_Name!')).toBe(
        'SomeWeirdName',
      );
    });
  });

  describe('getTemplateDisplayName', () => {
    it('maps normalized names to display labels', () => {
      expect(service.getTemplateDisplayName('DeadManSwitch')).toBe(
        "Dead Man's Switch",
      );
      expect(service.getTemplateDisplayName('Escrow')).toBe('Escrow');
    });

    it('falls back to the raw name, then "Covenant", when unmapped', () => {
      expect(service.getTemplateDisplayName('SomethingElse')).toBe(
        'SomethingElse',
      );
      expect(service.getTemplateDisplayName('')).toBe('Covenant');
    });
  });

  describe('getContractTypeLabel', () => {
    it('derives the label from contractName', () => {
      expect(
        service.getContractTypeLabel({ contractName: 'TimeLockVault' }),
      ).toBe('Time Lock');
    });
  });

  describe('getTemplateKey', () => {
    it('classifies by template id first', () => {
      expect(service.getTemplateKey({ id: 'multi-sig-vault' })).toBe(
        'multisig',
      );
      expect(service.getTemplateKey({ id: 'self-custody-vault' })).toBe(
        'default',
      );
    });

    it('falls back to contractName/name when no matching id', () => {
      expect(
        service.getTemplateKey({ contractName: 'EscrowWithArbiter' }),
      ).toBe('escrow');
      expect(service.getTemplateKey({ name: 'DeadManSwitch' })).toBe(
        'deadman',
      );
    });

    it('defaults when nothing matches', () => {
      expect(service.getTemplateKey({})).toBe('default');
    });
  });

  describe('buildShareLink', () => {
    it('builds a link carrying only the covenant id and network', () => {
      const link = service.buildShareLink('cov123');
      const url = new URL(link);
      expect(url.pathname).toBe('/app/contracts/cov123');
      expect(url.searchParams.get('network')).toBe('mainnet');
    });
  });
});
