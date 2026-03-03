import { Injectable } from '@angular/core';
import { Address, XOnlyPublicKey } from '../../../../../public/kaspa/kaspa';

export type CtorArg =
  | { kind: 'array'; data: { kind: 'byte'; data: number }[] }
  | { kind: 'int'; data: number };

export interface TemplateParam {
  name: string;
  paramType: 'pubkey' | 'byte[32]' | 'int' | 'int_field';
  positions: { offset: number; length: number }[];
  placeholderBytes: number[];
}

export interface TemplatePatch {
  contractName: string;
  params: TemplateParam[];
}

@Injectable({
  providedIn: 'root',
})
export class TemplatePatcherService {
  encodeScriptInt(value: number): number[] {
    if (!Number.isInteger(value)) {
      throw new Error(`Expected integer value, received ${value}`);
    }

    if (value === 0 || value === -1 || (value >= 1 && value <= 16)) {
      return [];
    }

    const negative = value < 0;
    let absValue = Math.abs(value);
    const bytes: number[] = [];

    while (absValue > 0) {
      bytes.push(absValue & 0xff);
      absValue = Math.floor(absValue / 256);
    }

    if ((bytes[bytes.length - 1] & 0x80) !== 0) {
      bytes.push(negative ? 0x80 : 0x00);
    } else if (negative) {
      bytes[bytes.length - 1] |= 0x80;
    }

    return bytes;
  }

  encodeFixedInt(value: number, size: number = 8): number[] {
    if (!Number.isInteger(value)) {
      throw new Error(`Expected integer value, received ${value}`);
    }

    const bytes = new Array<number>(size).fill(0);
    const negative = value < 0;
    let absValue = Math.abs(value);

    for (let index = 0; index < size && absValue > 0; index += 1) {
      bytes[index] = absValue & 0xff;
      absValue = Math.floor(absValue / 256);
    }

    if (absValue > 0) {
      throw new Error(`Value ${value} does not fit in ${size} bytes`);
    }

    if (negative) {
      bytes[size - 1] |= 0x80;
    }

    return bytes;
  }

  extractPatchDescriptor(compiled: any, templateArgs: CtorArg[]): TemplatePatch {
    const script = this.assertNumberArray(compiled?.script, 'compiled.script');
    const params = Array.isArray(compiled?.ast?.params) ? compiled.ast.params : [];
    const fieldInitParams = this.getFieldInitParams(compiled?.ast?.fields, params);

    if (params.length !== templateArgs.length) {
      throw new Error(`Template args mismatch: expected ${params.length}, received ${templateArgs.length}`);
    }

    const descriptorParams: TemplateParam[] = params.map((param: any, index: number) => {
      const arg = templateArgs[index];
      const isFieldInit = fieldInitParams.has(param.name);
      const placeholderBytes = this.argToBytes(arg, isFieldInit);
      const positions = this.findAllOccurrences(script, placeholderBytes).map((offset) => ({
        offset,
        length: placeholderBytes.length,
      }));

      if (positions.length === 0) {
        if (arg.kind === 'int' && placeholderBytes.length === 0) {
          throw new Error(
            `Param "${param.name}" uses a special opcode placeholder (${arg.data}) and cannot be patched in-place`,
          );
        }

        throw new Error(`Could not find bytes for param "${param.name}" in contract script`);
      }

      return {
        name: param.name,
        paramType: this.getParamType(param, arg, isFieldInit),
        positions,
        placeholderBytes,
      };
    });

    return {
      contractName: compiled?.contract_name || 'Unnamed Contract',
      params: descriptorParams,
    };
  }

  applyPatch(template: any, descriptor: TemplatePatch, newArgs: CtorArg[]): any {
    const params = Array.isArray(template?.ast?.params) ? template.ast.params : [];
    const script = this.assertNumberArray(template?.script, 'template.script').slice();

    if (params.length !== newArgs.length) {
      throw new Error(`Replacement args mismatch: expected ${params.length}, received ${newArgs.length}`);
    }

    for (const patch of descriptor.params) {
      const paramIndex = params.findIndex((param: any) => param.name === patch.name);
      if (paramIndex === -1) {
        throw new Error(`Unknown template param "${patch.name}"`);
      }

      const replacementBytes = this.argToBytes(newArgs[paramIndex], patch.paramType === 'int_field');
      if (replacementBytes.length !== patch.placeholderBytes.length) {
        throw new Error(
          `Size mismatch for "${patch.name}": placeholder=${patch.placeholderBytes.length}B, replacement=${replacementBytes.length}B`,
        );
      }

      for (const position of patch.positions) {
        for (let offset = 0; offset < position.length; offset += 1) {
          if (script[position.offset + offset] !== patch.placeholderBytes[offset]) {
            throw new Error(`Script corruption detected while patching "${patch.name}" at ${position.offset + offset}`);
          }
          script[position.offset + offset] = replacementBytes[offset];
        }
      }
    }

    return {
      ...template,
      script,
    };
  }

  kaspaAddressToPubkeyBytes(address: string): number[] {
    const parsed = new Address(address.trim());
    const xOnly = XOnlyPublicKey.fromAddress(parsed).toString();
    const bytes = this.hexToBytes(xOnly);

    if (bytes.length !== 32) {
      throw new Error(`Expected x-only pubkey address payload to be 32 bytes, received ${bytes.length}`);
    }

    return bytes;
  }

  private getFieldInitParams(fields: any[] | undefined, params: any[]): Set<string> {
    const fieldInitParams = new Set<string>();

    for (const field of Array.isArray(fields) ? fields : []) {
      const identifier = field?.expr?.kind === 'identifier' ? field.expr.data : null;
      if (identifier && params.some((param: any) => param.name === identifier)) {
        fieldInitParams.add(identifier);
      }
    }

    return fieldInitParams;
  }

  private getParamType(param: any, arg: CtorArg, isFieldInit: boolean): TemplateParam['paramType'] {
    if (arg.kind === 'int') {
      return isFieldInit ? 'int_field' : 'int';
    }

    if (param?.type_ref?.base === 'pubkey') {
      return 'pubkey';
    }

    const fixedArraySize = param?.type_ref?.array_dims?.[0]?.value;
    if (param?.type_ref?.base === 'byte' && fixedArraySize === 32) {
      return 'byte[32]';
    }

    throw new Error(`Unsupported array template param "${param?.name || 'unknown'}"`);
  }

  private argToBytes(arg: CtorArg, isFieldInit: boolean): number[] {
    if (arg.kind === 'array') {
      return arg.data.map((entry) => entry.data);
    }

    return isFieldInit ? this.encodeFixedInt(arg.data, 8) : this.encodeScriptInt(arg.data);
  }

  private findAllOccurrences(haystack: number[], needle: number[]): number[] {
    if (needle.length === 0) {
      return [];
    }

    const positions: number[] = [];
    for (let index = 0; index <= haystack.length - needle.length; index += 1) {
      let matched = true;
      for (let offset = 0; offset < needle.length; offset += 1) {
        if (haystack[index + offset] !== needle[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        positions.push(index);
      }
    }
    return positions;
  }

  private hexToBytes(hex: string): number[] {
    const normalized = hex.trim().replace(/^0x/i, '').toLowerCase();
    if (normalized.length === 0 || normalized.length % 2 !== 0 || /[^0-9a-f]/.test(normalized)) {
      throw new Error('Invalid hex string');
    }

    const bytes: number[] = [];
    for (let index = 0; index < normalized.length; index += 2) {
      bytes.push(Number.parseInt(normalized.slice(index, index + 2), 16));
    }
    return bytes;
  }

  private assertNumberArray(value: unknown, label: string): number[] {
    if (!Array.isArray(value) || value.some((entry) => !Number.isInteger(entry))) {
      throw new Error(`Invalid ${label}`);
    }
    return value as number[];
  }
}
