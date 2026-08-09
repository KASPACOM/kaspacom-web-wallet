import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { CovenantTemplateService } from './covenant-template.service';
import { TemplatePatcherService } from '../../../../../services/covenant/template-patcher.service';
import { KaspaL1NetworkService } from '../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { RpcService } from '../../../../../../services/kaspa-netwrok-services/rpc.service';

describe('CovenantTemplateService', () => {
  let service: CovenantTemplateService;
  let templatePatcher: jasmine.SpyObj<TemplatePatcherService>;
  let kaspaL1NetworkService: jasmine.SpyObj<KaspaL1NetworkService>;
  let rpcService: jasmine.SpyObj<RpcService>;

  beforeEach(() => {
    templatePatcher = jasmine.createSpyObj('TemplatePatcherService', [
      'extractPatchDescriptor',
      'kaspaAddressToPubkeyBytes',
    ]);
    kaspaL1NetworkService = jasmine.createSpyObj('KaspaL1NetworkService', [
      'getCurrentNetwork',
    ]);
    kaspaL1NetworkService.getCurrentNetwork.and.returnValue({
      blocksPerSecond: 10,
    } as any);
    rpcService = jasmine.createSpyObj('RpcService', ['getNetwork']);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: HttpClient,
          useValue: jasmine.createSpyObj('HttpClient', ['get']),
        },
        { provide: TemplatePatcherService, useValue: templatePatcher },
        { provide: KaspaL1NetworkService, useValue: kaspaL1NetworkService },
        { provide: RpcService, useValue: rpcService },
      ],
    });
    service = TestBed.inject(CovenantTemplateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('templateById', () => {
    it('finds a known template by id', () => {
      expect(service.templateById('multi-sig-vault')?.name).toBe(
        '2-of-3 MultiSig Vault',
      );
    });

    it('returns undefined for an unknown id', () => {
      expect(service.templateById('not-a-template')).toBeUndefined();
    });
  });

  describe('getAddressListFromRaw', () => {
    it('returns an empty array for blank input', () => {
      expect(service.getAddressListFromRaw(undefined)).toEqual([]);
      expect(service.getAddressListFromRaw('   ')).toEqual([]);
    });

    it('parses a JSON array', () => {
      expect(service.getAddressListFromRaw('["addr1", "addr2", ""]')).toEqual([
        'addr1',
        'addr2',
      ]);
    });

    it('falls back to newline/comma-separated values when not JSON', () => {
      expect(service.getAddressListFromRaw('addr1,addr2\naddr3')).toEqual([
        'addr1',
        'addr2',
        'addr3',
      ]);
    });
  });

  describe('getWhitelistModeFromValues', () => {
    it('respects an explicit mode value', () => {
      expect(
        service.getWhitelistModeFromValues('dest', {
          dest_mode: 'whitelist',
        }),
      ).toBe('whitelist');
      expect(
        service.getWhitelistModeFromValues('dest', { dest_mode: 'anywhere' }),
      ).toBe('anywhere');
    });

    it('infers whitelist mode from non-empty address list when mode is unset', () => {
      expect(
        service.getWhitelistModeFromValues('dest', { dest: 'addr1' }),
      ).toBe('whitelist');
      expect(service.getWhitelistModeFromValues('dest', { dest: '' })).toBe(
        'anywhere',
      );
    });
  });

  describe('getWhitelistCountFromValues', () => {
    it('counts addresses only when in whitelist mode', () => {
      expect(
        service.getWhitelistCountFromValues({
          whitelistedDestinations: 'addr1,addr2',
        }),
      ).toBe(2);
      expect(
        service.getWhitelistCountFromValues({
          whitelistedDestinations: 'addr1,addr2',
          whitelistedDestinations_mode: 'anywhere',
        }),
      ).toBe(0);
    });
  });

  describe('parseWholeNumber', () => {
    it('accepts non-negative whole numbers', () => {
      expect(service.parseWholeNumber('5', 'Field')).toBe(5);
      expect(service.parseWholeNumber('0', 'Field')).toBe(0);
    });

    it('rejects negatives, decimals, and non-numbers', () => {
      expect(() => service.parseWholeNumber('-1', 'Field')).toThrow();
      expect(() => service.parseWholeNumber('1.5', 'Field')).toThrow();
      expect(() => service.parseWholeNumber('abc', 'Field')).toThrow();
    });
  });

  describe('parseHash32', () => {
    it('parses a valid 32-byte hex string into bytes', () => {
      const hex = 'ab'.repeat(32);
      const bytes = service.parseHash32(hex, 'Hash');
      expect(bytes.length).toBe(32);
      expect(bytes[0]).toBe(0xab);
    });

    it('accepts a 0x-prefixed hash and is case-insensitive', () => {
      const bytes = service.parseHash32('0x' + 'AB'.repeat(32), 'Hash');
      expect(bytes[0]).toBe(0xab);
    });

    it('rejects the wrong length or non-hex input', () => {
      expect(() => service.parseHash32('abcd', 'Hash')).toThrow();
      expect(() => service.parseHash32('zz'.repeat(32), 'Hash')).toThrow();
    });
  });

  describe('parsePositiveDecimal', () => {
    it('accepts non-negative decimals', () => {
      expect(service.parsePositiveDecimal('1.5', 'Field')).toBe(1.5);
    });

    it('rejects negatives and non-numbers', () => {
      expect(() => service.parsePositiveDecimal('-1', 'Field')).toThrow();
      expect(() => service.parsePositiveDecimal('abc', 'Field')).toThrow();
    });
  });

  describe('parseDateToUnixMs', () => {
    it('treats large values as already-milliseconds', () => {
      expect(service.parseDateToUnixMs('500000000001', 'Field')).toBe(
        500000000001,
      );
    });

    it('converts unix-seconds input to milliseconds', () => {
      expect(service.parseDateToUnixMs('2000000000', 'Field')).toBe(
        2000000000000,
      );
    });

    it('falls back to parsing a date string', () => {
      const result = service.parseDateToUnixMs('2024-01-01T00:00:00Z', 'Field');
      expect(result).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    });

    it('throws for unparseable input', () => {
      expect(() => service.parseDateToUnixMs('not-a-date', 'Field')).toThrow();
    });
  });

  describe('hoursToSeconds / hoursToDaaDelay / daaDelayToHours', () => {
    it('converts hours to seconds', () => {
      expect(service.hoursToSeconds(1)).toBe(3600);
    });

    it('converts hours to DAA delay using the network blocks-per-second', () => {
      expect(service.hoursToDaaDelay(1)).toBe(36000);
    });

    it('round-trips DAA delay back to hours', () => {
      expect(service.daaDelayToHours(36000)).toBe(1);
    });

    it('clamps hoursToSeconds/hoursToDaaDelay at zero', () => {
      expect(service.hoursToSeconds(-5)).toBe(0);
      expect(service.hoursToDaaDelay(-5)).toBe(0);
    });
  });

  describe('fieldToCtorArgFromValues', () => {
    it('builds an int_days arg, converting days to seconds', () => {
      const arg = service.fieldToCtorArgFromValues(
        { paramName: 'age', label: 'Age', type: 'int_days' } as any,
        { age: '2' },
      );
      expect(arg).toEqual({ kind: 'int', data: 2 * 86400 });
    });

    it('rejects int_days over the 194-day encoding limit', () => {
      expect(() =>
        service.fieldToCtorArgFromValues(
          { paramName: 'age', label: 'Age', type: 'int_days' } as any,
          { age: '195' },
        ),
      ).toThrow();
    });

    it('throws when a required field is missing', () => {
      expect(() =>
        service.fieldToCtorArgFromValues(
          { paramName: 'age', label: 'Age', type: 'int_days' } as any,
          {},
        ),
      ).toThrow();
    });

    it('defaults int_hidden to 0 when blank instead of throwing', () => {
      const arg = service.fieldToCtorArgFromValues(
        { paramName: 'x', label: 'X', type: 'int_hidden' } as any,
        {},
      );
      expect(arg).toEqual({ kind: 'int', data: 0 });
    });

    it('delegates address fields to the template patcher for pubkey bytes', () => {
      templatePatcher.kaspaAddressToPubkeyBytes.and.returnValue(
        new Array(32).fill(1),
      );
      const arg = service.fieldToCtorArgFromValues(
        { paramName: 'addr', label: 'Address', type: 'address' } as any,
        { addr: 'kaspa:sometestaddr' },
      );
      expect(templatePatcher.kaspaAddressToPubkeyBytes).toHaveBeenCalledWith(
        'kaspa:sometestaddr',
      );
      expect((arg as any).kind).toBe('array');
      expect((arg as any).data.length).toBe(32);
    });
  });

  describe('extractTemplateIntField', () => {
    it('extracts constructor int params encoded as script pushdata', async () => {
      spyOn(service, 'getTemplatePatchContext').and.resolveTo({
        compiled: {} as any,
        descriptor: {
          contractName: 'TimeLockVault',
          params: [
            {
              name: 'timeout',
              paramType: 'int',
              positions: [{ offset: 2, length: 7 }],
              placeholderBytes: [],
            },
          ],
        },
      });

      const value = await service.extractTemplateIntField(
        { script: [0, 0, 6, 0, 16, 165, 212, 232, 1] } as any,
        'time-lock-vault',
        'timeout',
      );

      expect(value).toBe(2000000000000n);
    });

    it('extracts fixed-width int fields', async () => {
      spyOn(service, 'getTemplatePatchContext').and.resolveTo({
        compiled: {} as any,
        descriptor: {
          contractName: 'StatefulContract',
          params: [
            {
              name: 'phase',
              paramType: 'int_field',
              positions: [{ offset: 1, length: 8 }],
              placeholderBytes: [],
            },
          ],
        },
      });

      const value = await service.extractTemplateIntField(
        { script: [0, 5, 0, 0, 0, 0, 0, 0, 0] } as any,
        'stateful-contract',
        'phase',
      );

      expect(value).toBe(5n);
    });
  });

  describe('templateForIndexerName', () => {
    it('matches by known keyword substrings', () => {
      expect(service.templateForIndexerName('DeadMansSwitchV2')?.id).toBe(
        'dead-mans-switch',
      );
      expect(service.templateForIndexerName('MyTimeLockThing')?.id).toBe(
        'time-lock-vault',
      );
      expect(service.templateForIndexerName('EscrowWithArbiter')?.id).toBe(
        'escrow-with-arbiter',
      );
    });

    it('falls back to alias/id/name matching', () => {
      expect(service.templateForIndexerName('multisig')?.id).toBe(
        'multi-sig-vault',
      );
    });

    it('returns undefined for an unrecognized name', () => {
      expect(
        service.templateForIndexerName('CompletelyUnknownThing'),
      ).toBeUndefined();
    });
  });
});
