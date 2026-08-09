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
import { RpcService } from '../../../../../../services/kaspa-netwrok-services/rpc.service';
import { PublicKey } from '../../../../../../../../public/kaspa/kaspa';

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
  private rpcService = inject(RpcService);

  private templatePatchContextCache = new Map<
    string,
    Promise<{ compiled: CompiledContract; descriptor: TemplatePatch }>
  >();

  private readonly contractsDebugEnabled = false;

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
    promise.catch(() => this.templatePatchContextCache.delete(templateId));
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
    return Math.max(
      0,
      Math.round(hours * 3600 * this.networkBlocksPerSecond()),
    );
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
    return {
      kind: 'array',
      data: addresses.map((address) =>
        this.bytesArg(this.templatePatcher.kaspaAddressToPubkeyBytes(address)),
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
    const delayDaaValue = values['unvaultDelaySeconds'];
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
    if (!this.contractsDebugEnabled) return;
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

  /**
   * Convert an x-only 32-byte pubkey hex into a Kaspa P2PK address for the current network.
   */
  pubkeyToAddress(pkHex: string): string {
    try {
      return new PublicKey(pkHex)
        .toAddress(this.rpcService.getNetwork())
        .toString();
    } catch {
      return '';
    }
  }

  async extractTemplateIntField(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
  ): Promise<bigint | undefined> {
    try {
      const { descriptor } = await this.getTemplatePatchContext(templateId);
      const param = descriptor.params.find((entry) => entry.name === paramName);
      const position = param?.positions[0];
      if (
        !param ||
        (param.paramType !== 'int_field' && param.paramType !== 'int') ||
        !position
      ) {
        return undefined;
      }

      const encodedBytes = compiled.script.slice(
        position.offset,
        position.offset + position.length,
      );
      const bytes =
        param.paramType === 'int'
          ? this.extractScriptIntPushData(encodedBytes)
          : encodedBytes;
      if (!bytes) return undefined;

      let value = 0n;
      for (let index = 0; index < bytes.length; index += 1) {
        value += BigInt(bytes[index] & 0xff) << BigInt(index * 8);
      }
      return value;
    } catch {
      return undefined;
    }
  }

  private extractScriptIntPushData(bytes: number[]): number[] | undefined {
    const opcode = bytes[0];
    if (opcode === undefined) return undefined;

    if (opcode <= 75) {
      return bytes.length === opcode + 1 ? bytes.slice(1) : undefined;
    }

    if (opcode === 76) {
      const length = bytes[1];
      return length !== undefined && bytes.length === length + 2
        ? bytes.slice(2)
        : undefined;
    }

    if (opcode === 77) {
      const low = bytes[1];
      const high = bytes[2];
      if (low === undefined || high === undefined) return undefined;
      const length = low + (high << 8);
      return bytes.length === length + 3 ? bytes.slice(3) : undefined;
    }

    return undefined;
  }

  async extractTemplatePubkeyHex(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
  ): Promise<string | undefined> {
    return this.extractTemplateParamHex(
      compiled,
      templateId,
      paramName,
      'pubkey',
    );
  }

  async extractTemplateParamHex(
    compiled: CompiledContract,
    templateId: string,
    paramName: string,
    paramType: TemplatePatch['params'][number]['paramType'],
  ): Promise<string | undefined> {
    try {
      const { descriptor } = await this.getTemplatePatchContext(templateId);
      const param = descriptor.params.find((entry) => entry.name === paramName);
      const position = param?.positions[0];
      if (!param || param.paramType !== paramType || !position) {
        return undefined;
      }

      return compiled.script
        .slice(position.offset, position.offset + position.length)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return undefined;
    }
  }

  private normalizeTemplateName(value: string): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  templateForIndexerName(templateName: string): ContractTemplate | undefined {
    const normalized = this.normalizeTemplateName(templateName);
    if (normalized.includes('deadman')) {
      return this.templateById('dead-mans-switch');
    }
    if (normalized.includes('timelock')) {
      return this.templateById('time-lock-vault');
    }
    if (normalized.includes('multisig')) {
      return this.templateById('multi-sig-vault');
    }
    if (normalized.includes('escrow')) {
      return this.templateById('escrow-with-arbiter');
    }
    if (normalized.includes('selfcustody')) {
      return this.templateById('self-custody-vault');
    }

    const aliases: Record<string, string> = {
      timelockvault: 'time-lock-vault',
      multisigvault: 'multi-sig-vault',
      multisig: 'multi-sig-vault',
      escrowwitharbiter: 'escrow-with-arbiter',
      escrow: 'escrow-with-arbiter',
      deadmansswitch: 'dead-mans-switch',
      deadmans: 'dead-mans-switch',
      deadman: 'dead-mans-switch',
      selfcustodyvault: 'self-custody-vault',
      selfcustody: 'self-custody-vault',
    };
    const templateId = aliases[normalized];
    return CONTRACT_TEMPLATES.find(
      (template) =>
        template.id === templateId ||
        this.normalizeTemplateName(template.id) === normalized ||
        this.normalizeTemplateName(template.name) === normalized,
    );
  }
}
