import {
  Address,
  addressFromScriptPublicKey,
  createInputSignature,
  createTransactions,
  Encoding,
  payToAddressScript,
  payToScriptHashScript,
  PrivateKey,
  RpcClient,
  ScriptBuilder,
  SighashType,
  Transaction,
  type ITransactionInput,
  type ITransactionOutput,
  type UtxoEntryReference,
} from "../../../../../public/kaspa/kaspa";
import {
  type CompiledContract,
  type CovenantOutpoint,
  type DeployResult,
  type SpendOutput,
  type SpendResult,
} from "./types";

const SUBNETWORK_ID_NATIVE = "0000000000000000000000000000000000000000";

type SupportedSigArg = Uint8Array;

function toScriptBytes(compiled: CompiledContract): Uint8Array {
  return Uint8Array.from(compiled.script);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/i, "");
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: "${hex}"`);
  }

  const out = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    out[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return out;
}

function connectRpc(rpcUrl: string, network: string): RpcClient {
  return new RpcClient({
    url: rpcUrl,
    encoding: Encoding.Borsh,
    networkId: network,
  });
}

function requireAddress(value: Address | undefined, context: string): Address {
  if (!value) {
    throw new Error(`${context} did not resolve to a Kaspa address`);
  }
  return value;
}

function getAbiEntry(compiled: CompiledContract, functionName: string) {
  const entry = compiled.abi.find((candidate) => candidate.name === functionName);
  if (!entry) {
    throw new Error(`Function "${functionName}" not found in compiled ABI`);
  }
  return entry;
}

function getFunctionSelector(compiled: CompiledContract, functionName: string): bigint | undefined {
  if (compiled.without_selector) {
    return undefined;
  }

  const selector = compiled.abi.findIndex((candidate) => candidate.name === functionName);
  if (selector === -1) {
    throw new Error(`Function "${functionName}" not found in compiled ABI`);
  }
  return BigInt(selector);
}

function encodeAbiBytesArray(typeName: string, value: Uint8Array): Uint8Array {
  const match = /^byte\[(\d+)\]$/.exec(typeName);
  if (!match) {
    return value;
  }

  const expectedLength = Number.parseInt(match[1], 10);
  if (value.length !== expectedLength) {
    throw new Error(`Expected ${typeName} but received ${value.length} bytes`);
  }
  return value;
}

function buildSigScript(
  compiled: CompiledContract,
  functionName: string,
  functionArgs: SupportedSigArg[],
): string {
  const abiEntry = getAbiEntry(compiled, functionName);
  if (abiEntry.inputs.length !== functionArgs.length) {
    throw new Error(`Function "${functionName}" expects ${abiEntry.inputs.length} arguments`);
  }

  const builder = new ScriptBuilder();

  for (let index = 0; index < abiEntry.inputs.length; index += 1) {
    const input = abiEntry.inputs[index];
    const arg = functionArgs[index];

    if (input.type_name === "int" || input.type_name === "bool" || input.type_name === "string") {
      throw new Error(
        `Function "${functionName}" requires "${input.name}:${input.type_name}", but spendContract() only derives sig/pubkey arguments`,
      );
    }

    if (input.type_name === "sig") {
      if (arg.length !== 65) {
        throw new Error(`Expected sig argument "${input.name}" to be 65 bytes`);
      }
      builder.addData(arg);
      continue;
    }

    if (input.type_name === "pubkey") {
      if (arg.length !== 32) {
        throw new Error(`Expected pubkey argument "${input.name}" to be 32 bytes`);
      }
      builder.addData(arg);
      continue;
    }

    if (input.type_name === "byte" || /^byte\[\d+\]$/.test(input.type_name)) {
      builder.addData(encodeAbiBytesArray(input.type_name, arg));
      continue;
    }

    throw new Error(`Unsupported ABI argument type "${input.type_name}" for "${functionName}"`);
  }

  const selector = getFunctionSelector(compiled, functionName);
  if (selector !== undefined) {
    builder.addI64(selector);
  }

  return builder.drain();
}

async function getAddressUtxos(rpc: RpcClient, address: string): Promise<UtxoEntryReference[]> {
  const utxos = await rpc.getUtxosByAddresses([address]);
  return utxos.entries;
}

function findOutputIndex(transaction: Transaction, address: string, network: string): number {
  return transaction.outputs.findIndex((output) => {
    const resolved = addressFromScriptPublicKey(output.scriptPublicKey, network);
    return resolved?.toString() === address;
  });
}

function resolveSpendFunctionArgs(
  compiled: CompiledContract,
  functionName: string,
  signature: Uint8Array,
  privateKey: PrivateKey,
): SupportedSigArg[] {
  const entry = getAbiEntry(compiled, functionName);
  const xOnlyPubkey = hexToBytes(privateKey.toPublicKey().toXOnlyPublicKey().toString());

  return entry.inputs.map((input) => {
    if (input.type_name === "sig") {
      return signature;
    }
    if (input.type_name === "pubkey") {
      return xOnlyPubkey;
    }

    throw new Error(
      `Function "${functionName}" requires "${input.name}:${input.type_name}", but spendContract() only derives sig/pubkey arguments`,
    );
  });
}

/**
 * Get the P2SH address for a compiled covenant contract.
 * Uses payToScriptHashScript() to hash the contract bytecode.
 */
export function getCovenantAddress(compiled: CompiledContract, network: string): string {
  const scriptPublicKey = payToScriptHashScript(toScriptBytes(compiled));
  return requireAddress(addressFromScriptPublicKey(scriptPublicKey, network), compiled.contract_name).toString();
}

/**
 * Deploy a covenant: lock KAS into a P2SH UTXO guarded by the contract.
 * Uses createTransactions() with the P2SH address as output.
 */
export async function deployContract(
  compiled: CompiledContract,
  amountSompi: bigint,
  rpcUrl: string,
  privateKeyHex: string,
  network: string,
): Promise<DeployResult> {
  const privateKey = new PrivateKey(privateKeyHex);
  const senderAddress = privateKey.toAddress(network).toString();
  const contractAddress = getCovenantAddress(compiled, network);
  const rpc = connectRpc(rpcUrl, network);

  try {
    await rpc.connect();
    const entries = await getAddressUtxos(rpc, senderAddress);
    if (entries.length === 0) {
      throw new Error(`No spendable UTXOs found for ${senderAddress}`);
    }

    const created = await createTransactions({
      entries,
      outputs: [{ address: contractAddress, amount: amountSompi }],
      changeAddress: senderAddress,
      priorityFee: 0n,
      networkId: network,
    } as never);

    let finalTxId = created.summary.finalTransactionId;
    let finalTransaction = created.transactions[created.transactions.length - 1]?.transaction;

    for (const pending of created.transactions) {
      pending.sign([privateKey]);
      finalTxId = await pending.submit(rpc);
      finalTransaction = pending.transaction;
    }

    if (!finalTxId || !finalTransaction) {
      throw new Error("Failed to submit deployment transaction");
    }

    const outputIndex = findOutputIndex(finalTransaction, contractAddress, network);
    if (outputIndex === -1) {
      throw new Error("Deployment transaction did not contain the covenant output");
    }

    return {
      txid: finalTxId,
      contractAddress,
      outpoint: {
        txid: finalTxId,
        vout: outputIndex,
      },
    };
  } finally {
    await rpc.disconnect().catch(() => undefined);
  }
}

/**
 * Spend a covenant UTXO by calling one of its entrypoint functions.
 * Mirrors kascov's spend-contract-signed flow:
 * 1. Build unsigned TX
 * 2. Calculate sighash
 * 3. Sign with privateKey
 * 4. Append SIG_HASH_ALL byte
 * 5. Build sigscript via encodePayToScriptHashSignatureScript
 * 6. Submit
 */
export async function spendContract(
  compiled: CompiledContract,
  outpoint: CovenantOutpoint,
  inputAmountSompi: bigint,
  functionName: string,
  outputs: SpendOutput[],
  rpcUrl: string,
  privateKeyHex: string,
  network: string,
): Promise<SpendResult> {
  const privateKey = new PrivateKey(privateKeyHex);
  const covenantAddress = getCovenantAddress(compiled, network);
  const rpc = connectRpc(rpcUrl, network);

  try {
    await rpc.connect();
    const utxos = await getAddressUtxos(rpc, covenantAddress);
    const entry = utxos.find(
      (candidate) =>
        candidate.outpoint.transactionId === outpoint.txid && candidate.outpoint.index === outpoint.vout,
    );

    if (!entry) {
      throw new Error(`Covenant outpoint ${outpoint.txid}:${outpoint.vout} was not found for ${covenantAddress}`);
    }

    if (entry.amount !== inputAmountSompi) {
      throw new Error(
        `Input amount mismatch for ${outpoint.txid}:${outpoint.vout}: expected ${inputAmountSompi}, found ${entry.amount}`,
      );
    }

    const txInputs: ITransactionInput[] = [
      {
        previousOutpoint: entry.outpoint,
        utxo: entry,
        sequence: 0n,
        sigOpCount: 1,
      },
    ];

    const txOutputs: ITransactionOutput[] = outputs.map((output) => ({
      scriptPublicKey: payToAddressScript(output.address),
      value: output.amount,
    }));

    const unsignedTx = new Transaction({
      version: 0,
      lockTime: 0n,
      inputs: txInputs,
      outputs: txOutputs,
      subnetworkId: SUBNETWORK_ID_NATIVE,
      gas: 0n,
      payload: "",
    });

    const signatureHex = createInputSignature(unsignedTx, 0, privateKey, SighashType.All);
    const signature = hexToBytes(signatureHex);
    const functionArgs = resolveSpendFunctionArgs(compiled, functionName, signature, privateKey);
    const sigPrefix = buildSigScript(compiled, functionName, functionArgs);

    unsignedTx.inputs[0].signatureScript = ScriptBuilder.fromScript(toScriptBytes(compiled)).encodePayToScriptHashSignatureScript(
      sigPrefix,
    );

    const submitted = await rpc.submitTransaction({
      transaction: unsignedTx,
      allowOrphan: false,
    });

    return {
      txid: submitted.transactionId,
      functionName,
    };
  } finally {
    await rpc.disconnect().catch(() => undefined);
  }
}
