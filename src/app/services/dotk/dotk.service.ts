import { Injectable, inject } from '@angular/core';
import { Dotk, SUBNAME_PREFIX, subnames, type Records } from '@dotk/sdk';
import {
  Registrar,
  nodesOver,
  patchPlaceholder,
  toSafeJson,
  type SignRequest,
  type Signer,
  type TxWasmRpcClient,
} from '@dotk/sdk-tx';
import {
  ScriptBuilder,
  SighashType,
  Transaction,
  createInputSignature,
} from '../../../../public/kaspa/kaspa';
import { AppWallet } from '../../classes/AppWallet';
import { KaspaL1NetworkService } from '../kaspa-netwrok-services/kaspa-l1-network.service';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import {
  DotkNameAsset,
  DotkNameDetail,
  DotkResolution,
  DotkSubname,
  DotkTransferActionData,
} from './dotk.types';
import { dotkSignatureBytes } from './dotk-signing';

@Injectable({ providedIn: 'root' })
export class DotkService {
  private readonly networkService = inject(KaspaL1NetworkService);
  private readonly rpcService = inject(RpcService);

  async resolveRecipient(input: string): Promise<DotkResolution> {
    const dotk = this.createClient(true);
    const recipient = await dotk.recipientFor(input);

    if (recipient.kind === 'neither') {
      return {
        address: null,
        display: input.trim(),
        error: recipient.reason,
      };
    }

    if (recipient.kind === 'address') {
      return { address: recipient.address, display: recipient.address };
    }

    const display = recipient.display;
    if (recipient.address) {
      return { address: recipient.address, display };
    }

    return {
      address: null,
      display,
      error: this.resolutionFaultMessage(recipient.fault),
    };
  }

  async getNamesByAddress(address: string): Promise<DotkNameAsset[]> {
    // The wallet summary must not depend on the Kaspa RPC being connected.
    // Detail and transfer flows still use a node-backed client for on-chain
    // verification; the owner endpoint is sufficient to populate this list.
    const dotk = this.createClient(false);
    const owner = dotk.ownerOf(address);
    const names = await dotk.namesOf(address);

    return names.map((name) => ({
      name: name.name,
      display: name.display,
      deedAddress: name.deedAddress,
      proven: name.proven,
      primary: name.primary,
      hasRecordsCard: name.card !== null,
      recordKeys: this.regularRecordKeys(name.records),
      subnames: this.subnamesFor(
        name.display,
        owner.ownerType,
        name.records,
        dotk.prefix,
      ),
    }));
  }

  async getNameDetail(name: string): Promise<DotkNameDetail | null> {
    const dotk = this.createClient(true);
    const resolved = await dotk.resolveName(name);
    if (!resolved) return null;

    return {
      name: resolved.name,
      display: resolved.display,
      address: resolved.address,
      ownerCovenantId: resolved.ownerCovenantId,
      ownerType: resolved.ownerType,
      owner: resolved.owner,
      deedAddress: resolved.deedAddress,
      proven: resolved.proven,
      records: Object.entries(resolved.records)
        .filter(([key]) => !key.startsWith(SUBNAME_PREFIX))
        .map(([key, value]) => ({
          key,
          value:
            typeof value === 'object'
              ? `Opaque (${value.opaque})`
              : String(value),
        })),
      subnames: this.subnamesFor(
        resolved.display,
        resolved.ownerType,
        resolved.records,
        dotk.prefix,
      ),
    };
  }

  async planTransfer(
    name: string,
    recipient: string,
    wallet: AppWallet,
  ): Promise<DotkTransferActionData> {
    const { dotk, registrar } = this.createRegistrar(wallet);
    const plan = await registrar.planTransfer(name, recipient);
    const resolved = await dotk.resolveName(plan.name);

    // A live card is output 1 of the transaction that created the current
    // deed. Matching its transaction id to an input of this exact plan ties
    // the freshly proven records to the deed the transfer will actually
    // spend, instead of trusting the cached wallet-list snapshot.
    const plannedInputTransactionIds = new Set(
      plan.assembled.tx.inputs.map(
        (input) => input.previousOutpoint.transactionId,
      ),
    );
    const cardMatchesPlan =
      resolved?.proven === true &&
      resolved.card?.proven === true &&
      plannedInputTransactionIds.has(resolved.card.outpointTxid);
    const noCardConfirmed =
      plan.cards.cardRead &&
      resolved?.proven === true &&
      resolved.card === null;
    const recordEffectsUncertain =
      !plan.cards.cardRead || (!cardMatchesPlan && !noCardConfirmed);

    return {
      name: plan.name,
      displayName: dotk.display(plan.name),
      recipient: plan.recipient,
      feeSompi: plan.fee,
      network: dotk.network,
      recordsCardRetired:
        cardMatchesPlan || plan.cards.subnamesDropped.length > 0,
      recordEffectsUncertain,
      recordKeysDropped: cardMatchesPlan
        ? this.regularRecordKeys(resolved?.records ?? {})
        : [],
      plan,
    };
  }

  async submitTransfer(
    transfer: DotkTransferActionData,
    wallet: AppWallet,
  ): Promise<string> {
    if (transfer.network !== this.networkService.getNetworkId()) {
      throw new Error(
        `The Dot.K transfer was planned for ${transfer.network}, but the wallet is now on ${this.networkService.getNetworkId()}`,
      );
    }

    const { registrar } = this.createRegistrar(wallet);
    return registrar.submit(transfer.plan);
  }

  private createRegistrar(wallet: AppWallet): {
    dotk: Dotk;
    registrar: Registrar;
  } {
    const dotk = this.createClient(true);
    const nodes = this.getNodes();
    const account = {
      address: wallet.getAddress(),
      ...dotk.ownerOf(wallet.getAddress()),
    };

    const registrar = new Registrar({
      dotk,
      node: nodes.tx,
      account,
      signer: this.createSigner(wallet, account.ownerType),
    });

    return { dotk, registrar };
  }

  private createClient(includeNode: boolean): Dotk {
    const versionedApiBase = this.networkService.getDotkApiBaseurl();
    if (!versionedApiBase) {
      throw new Error('Dot.K is not supported on the selected network');
    }

    // @dotk/sdk appends /v1 itself; the wallet configuration intentionally
    // stores the complete public API URL supplied by Dot.K.
    const apiBase = versionedApiBase.replace(/\/v1\/?$/i, '');
    const nodes = includeNode ? this.getNodes() : undefined;

    return new Dotk({
      network: this.networkService.getNetworkId(),
      api: apiBase,
      node: nodes?.read,
    });
  }

  private getNodes(): ReturnType<typeof nodesOver> {
    const rpc = this.rpcService.getRpc();
    if (!rpc) {
      throw new Error('Kaspa RPC is not connected');
    }

    const nodes = nodesOver(() => {
      const currentRpc = this.rpcService.getRpc();
      if (!currentRpc) {
        throw new Error('Kaspa RPC is not connected');
      }
      return currentRpc as unknown as TxWasmRpcClient;
    }, this.networkService.getNetworkId());

    return {
      ...nodes,
      tx: {
        ...nodes.tx,
        submit: async (tx) => {
          const currentRpc = this.rpcService.getRpc();
          if (!currentRpc) {
            throw new Error('Kaspa RPC is not connected');
          }

          // The Dot.K WASM adapter parses its safe JSON before submission,
          // leaving u64 fields such as lockTime as strings. This Kaspa WASM
          // build accepts an actual Transaction, so restore the typed object
          // from the same safe JSON before handing it to the RPC client.
          const transaction = Transaction.deserializeFromSafeJSON(
            toSafeJson(tx),
          );
          const answer = await currentRpc.submitTransaction({
            transaction,
            allowOrphan: false,
          });

          if (!answer?.transactionId) {
            throw new Error(
              'The node accepted the Dot.K transaction without returning its id',
            );
          }

          return answer.transactionId;
        },
      },
    };
  }

  private createSigner(wallet: AppWallet, accountOwnerType: number): Signer {
    return {
      supportsOwnerScheme: (ownerType: number) =>
        ownerType === accountOwnerType,
      sign: async (request: SignRequest): Promise<string> => {
        const transaction = Transaction.deserializeFromSafeJSON(request.txJson);

        for (const inputIndex of request.fundingInputs) {
          const signature = dotkSignatureBytes(
            createInputSignature(
              transaction,
              inputIndex,
              wallet.getPrivateKey(),
              SighashType.All,
            ),
          );
          transaction.inputs[inputIndex].signatureScript = new ScriptBuilder()
            .addData(signature)
            .drain();
        }

        for (const inputIndex of request.ownerSigInputs) {
          const signature = dotkSignatureBytes(
            createInputSignature(
              transaction,
              inputIndex,
              wallet.getPrivateKey(),
              SighashType.All,
            ),
          );
          const signatureScript =
            transaction.inputs[inputIndex].signatureScript;
          if (!signatureScript) {
            throw new Error(
              `Dot.K owner input ${inputIndex} has no signature placeholder`,
            );
          }
          const currentScript = this.hexToBytes(signatureScript);
          transaction.inputs[inputIndex].signatureScript = this.bytesToHex(
            patchPlaceholder(currentScript, signature),
          );
        }

        return transaction.serializeToSafeJSON();
      },
    };
  }

  private resolutionFaultMessage(fault: string | undefined): string {
    switch (fault) {
      case 'unresolved':
        return 'Dot.K name not found';
      case 'parent-unresolved':
        return 'Dot.K parent name not found';
      case 'in-covenant':
      case 'parent-in-covenant':
      case 'held-by-covenant':
        return 'Dot.K name does not resolve to a wallet address';
      default:
        return fault
          ? `Dot.K name cannot receive payments (${fault})`
          : 'Dot.K name does not resolve to a wallet address';
    }
  }

  private regularRecordKeys(records: Records): string[] {
    return Object.keys(records).filter(
      (key) => !key.startsWith(SUBNAME_PREFIX),
    );
  }

  private subnamesFor(
    parentDisplay: string,
    ownerType: number,
    records: Records,
    prefix: string,
  ): DotkSubname[] {
    return subnames(ownerType, records, prefix).map((subname) => ({
      label: subname.label,
      display: `${subname.label}.${parentDisplay}`,
      address: subname.address,
      ...(subname.fault ? { fault: subname.fault } : {}),
    }));
  }

  private hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
      throw new Error('Dot.K transaction contains invalid hexadecimal data');
    }

    return Uint8Array.from(
      hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
    );
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }
}
