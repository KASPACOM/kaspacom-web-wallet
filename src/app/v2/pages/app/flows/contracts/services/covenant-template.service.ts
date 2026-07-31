import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CONTRACT_TEMPLATES,
  ContractTemplate,
  TemplateField,
} from '../../../../../services/covenant/contract-templates';
import {
  CtorArg,
  TemplatePatch,
  TemplatePatcherService,
} from '../../../../../services/covenant/template-patcher.service';
import { CompiledContract } from '../../../../../../services/covenant/covenant-sdk/types';
import { IndexerCovenantArg } from '../../../../../../services/covenant/covenant-indexer.service';
import { KaspaL1NetworkService } from '../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { SELF_CUSTODY_WHITELIST_CAPACITY } from '../contracts-page.models';

/**
 * Compiling/patching a covenant template and building its constructor
 * args is shared across the deploy form, the indexer-import preview, and
 * the action-execution engine (continuation building) — none of these are
 * exclusive owners, so this logic lives here rather than in any one of them.
 */
@Injectable({
  providedIn: 'root',
})
export class CovenantTemplateService {
  private http = inject(HttpClient);
  private templatePatcher = inject(TemplatePatcherService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);

  private templatePatchContextCache = new Map<
    string,
    Promise<{ compiled: CompiledContract; descriptor: TemplatePatch }>
  >();

  templateById(id: string): ContractTemplate | undefined {
    return CONTRACT_TEMPLATES.find((template) => template.id === id);
  }

  async getTemplatePatchContext(
    templateId: string,
  ): Promise<{ compiled: CompiledContract; descriptor: TemplatePatch }> {
    const cached = this.templatePatchContextCache.get(templateId);
    if (cached) return cached;

    const promise = (async () => {
      const template = this.templateById(templateId);
      if (!template) {
        throw new Error(`Unknown covenant template "${templateId}".`);
      }
      const compiled = (await firstValueFrom(
        this.http.get<any>(template.assetPath),
      )) as CompiledContract;
      return {
        compiled,
        descriptor: this.templatePatcher.extractPatchDescriptor(
          compiled,
          template.placeholderArgs,
        ),
      };
    })();
    this.templatePatchContextCache.set(templateId, promise);
    return promise;
  }

  argsArrayToRecord(args: IndexerCovenantArg[]): Record<string, string> {
    return args.reduce<Record<string, string>>((record, arg) => {
      record[arg.name] = String(arg.value);
      return record;
    }, {});
  }

  getAddressListFromRaw(rawValue: string | undefined): string[] {
    const raw = String(rawValue ?? '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => String(value ?? '').trim())
          .filter(Boolean);
      }
    } catch {
      return raw
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean);
    }
    return [];
  }

  getWhitelistModeFromValues(
    paramName: string,
    values: Record<string, string>,
  ): 'anywhere' | 'whitelist' {
    const mode = values[paramName + '_mode'];
    if (mode === 'whitelist') return 'whitelist';
    if (mode === 'anywhere') return 'anywhere';
    return this.getAddressListFromRaw(values[paramName]).length > 0
      ? 'whitelist'
      : 'anywhere';
  }

  getWhitelistCountFromValues(values: Record<string, string>): number {
    return this.getWhitelistModeFromValues(
      'whitelistedDestinations',
      values,
    ) === 'whitelist'
      ? this.getAddressListFromRaw(values['whitelistedDestinations']).length
      : 0;
  }

  parseWholeNumber(value: string, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative whole number`);
    }
    return parsed;
  }

  parseHash32(value: string, label: string): number[] {
    const normalized = value.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error(`${label} must be a 32-byte hex string`);
    }

    const bytes: number[] = [];
    for (let index = 0; index < normalized.length; index += 2) {
      bytes.push(Number.parseInt(normalized.slice(index, index + 2), 16));
    }
    return bytes;
  }

  parsePositiveDecimal(value: string, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative number`);
    }
    return parsed;
  }

  parseDateToUnixMs(value: string, label: string): number {
    // Kaspa LOCK_TIME_THRESHOLD = 500,000,000,000:
    //   values < 500B → DAA score, values >= 500B → Unix milliseconds
    // We convert user input (seconds) to milliseconds to stay above the threshold.
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      if (asNumber >= 500_000_000_000) {
        // Already in milliseconds
        return Math.floor(asNumber);
      }
      if (asNumber > 946684800) {
        // Unix seconds → convert to milliseconds
        return Math.floor(asNumber * 1000);
      }
    }

    // Fallback: try parsing as date string
    const timestampMs = new Date(value).getTime();
    if (!Number.isFinite(timestampMs)) {
      throw new Error(`${label} must be a valid date and time.`);
    }

    return timestampMs;
  }

  hoursToSeconds(hours: number): number {
    return Math.max(0, Math.round(hours * 3600));
  }

  private networkBlocksPerSecond(): number {
    return this.kaspaL1NetworkService.getCurrentNetwork().blocksPerSecond || 10;
  }

  hoursToDaaDelay(hours: number): number {
    return Math.max(0, Math.round(hours * 3600 * this.networkBlocksPerSecond()));
  }

  daaDelayToHours(daaScore: number): number {
    return daaScore / (3600 * this.networkBlocksPerSecond());
  }

  intArg(value: number): CtorArg {
    return {
      kind: 'int',
      data: value,
    };
  }

  bytesArg(bytes: number[]): CtorArg {
    return {
      kind: 'array',
      data: bytes.map((byte) => ({ kind: 'byte' as const, data: byte })),
    };
  }

  pubkeyListArg(paramName: string, values: Record<string, string>): CtorArg {
    const addresses =
      this.getWhitelistModeFromValues(paramName, values) === 'whitelist'
        ? this.getAddressListFromRaw(values[paramName])
        : [];
    const selectedAddresses = addresses.slice(
      0,
      SELF_CUSTODY_WHITELIST_CAPACITY,
    );
    const paddedAddresses = [
      ...selectedAddresses,
      ...new Array<string>(
        Math.max(0, SELF_CUSTODY_WHITELIST_CAPACITY - selectedAddresses.length),
      ).fill(''),
    ];

    return {
      kind: 'array',
      data: paddedAddresses.map((address) =>
        this.bytesArg(
          address
            ? this.templatePatcher.kaspaAddressToPubkeyBytes(address)
            : new Array<number>(32).fill(0),
        ),
      ),
    };
  }

  fieldToCtorArg(
    field: TemplateField,
    rawValue: string | number | undefined,
  ): CtorArg {
    return this.fieldToCtorArgFromValues(field, {
      [field.paramName]: String(rawValue ?? ''),
    });
  }

  fieldToCtorArgFromValues(
    field: TemplateField,
    values: Record<string, string>,
  ): CtorArg {
    const rawValue = values[field.paramName];
    const value = String(rawValue ?? '').trim();
    if (
      !value &&
      field.type !== 'address_list' &&
      field.type !== 'whitelist_count' &&
      field.type !== 'int_hidden'
    ) {
      throw new Error(`${field.label} is required`);
    }

    switch (field.type) {
      case 'address':
        return this.bytesArg(
          this.templatePatcher.kaspaAddressToPubkeyBytes(value),
        );
      case 'address_list':
        return this.pubkeyListArg(field.paramName, values);
      case 'hash32':
        return this.bytesArg(this.parseHash32(value, field.label));
      case 'int_days': {
        // this.age in SilverScript = DAA score difference (virtual blue score)
        // On mainnet (1 BPS): DAA ≈ 1/sec → 86,400/day (days * 86400 is correct)
        // Max ~194 days (3-byte encoding limit: 16,777,215 / 86400 ≈ 194)
        const days = this.parseWholeNumber(value, field.label);
        if (days > 194) {
          throw new Error(
            `${field.label}: maximum is 194 days (template encoding limit)`,
          );
        }
        return this.intArg(days * 86400);
      }
      case 'int_hours': {
        const hours = this.parsePositiveDecimal(value, field.label);
        if (hours > 4660) {
          throw new Error(
            `${field.label}: maximum is 4660 hours (template encoding limit)`,
          );
        }
        return this.intArg(this.hoursToSeconds(hours));
      }
      case 'int_daa_delay': {
        const daaScore = this.parseWholeNumber(value, field.label);
        if (daaScore > 0xffffff) {
          throw new Error(
            `${field.label}: maximum is 16,777,215 DAA score units (template encoding limit)`,
          );
        }
        return this.intArg(daaScore);
      }
      case 'int_count':
        return this.intArg(this.parseWholeNumber(value, field.label));
      case 'whitelist_count':
        return this.intArg(this.getWhitelistCountFromValues(values));
      case 'int_hidden':
        return this.intArg(
          value ? this.parseWholeNumber(value, field.label) : 0,
        );
      case 'int_timestamp':
        return this.intArg(this.parseDateToUnixMs(value, field.label));
      default:
        throw new Error(
          `Unsupported template field type: ${(field as { type: string }).type}`,
        );
    }
  }

  buildSelfCustodyArgsPayload(
    values: Record<string, string>,
  ): IndexerCovenantArg[] {
    const whitelistMode = this.getWhitelistModeFromValues(
      'whitelistedDestinations',
      values,
    );
    const whitelistedDestinations =
      whitelistMode === 'whitelist'
        ? this.getAddressListFromRaw(values['whitelistedDestinations']).join(
            ',',
          )
        : '';
    const delayDaaValue =
      values['initUnvaultDelaySeconds'] ?? values['unvaultDelaySeconds'];
    const delayDaaScore = this.parseWholeNumber(
      String(delayDaaValue ?? '').trim() || String(this.hoursToDaaDelay(24)),
      'Unvault Delay',
    );
    const initPhase = values['initPhase']
      ? this.parseWholeNumber(
          String(values['initPhase']).trim(),
          'Initial Phase',
        )
      : 0;

    return [
      {
        name: 'hotKey',
        type: 'address',
        value: String(values['hotKey'] ?? ''),
      },
      {
        name: 'coldKey',
        type: 'address',
        value: String(values['coldKey'] ?? ''),
      },
      {
        name: 'whitelistMode',
        type: 'string',
        value: whitelistMode,
      },
      {
        name: 'whitelistedDestinations',
        type: 'address[]',
        value: whitelistedDestinations,
      },
      {
        name: 'unvaultDelaySeconds',
        type: 'blueScore',
        value: String(delayDaaScore),
      },
      {
        name: 'initPhase',
        type: 'int',
        value: String(initPhase),
      },
    ];
  }

  logSelfCustodyContractParams(
    context: string,
    details: Record<string, unknown>,
  ): void {
    console.log(
      `[SelfCustodyVault] ${context}`,
      JSON.parse(
        JSON.stringify(details, (_key, value) => {
          if (typeof value === 'bigint') return value.toString();
          if (value instanceof Uint8Array) return Array.from(value);
          return value;
        }),
      ),
    );
  }
}
