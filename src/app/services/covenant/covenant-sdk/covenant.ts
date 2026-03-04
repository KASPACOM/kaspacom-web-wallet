import {
  Address,
  addressFromScriptPublicKey,
  createInputSignature,
  createTransaction,
  createTransactions,
  CovenantBinding,
  Encoding,
  Hash,
  payToAddressScript,
  payToScriptHashScript,
  PrivateKey,
  RpcClient,
  ScriptBuilder,
  SighashType,
  Transaction,
  TransactionOutput,
  type ITransactionInput,
  type ITransactionOutput,
  type UtxoEntryReference,
} from "../../../../../public/kaspa/kaspa";
import { blake2b } from "@noble/hashes/blake2b";
import {
  type CompiledContract,
  type CovenantOutpoint,
  type DeployResult,
  type SpendOutput,
  type SpendResult,
} from "./types";

const SUBNETWORK_ID_NATIVE = "0000000000000000000000000000000000000000";

/** Domain separation key for covenant ID hashing — must match Rust `CovenantID` hasher */
const COVENANT_ID_KEY = new TextEncoder().encode("CovenantID");

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const utxoPromise = rpc.getUtxosByAddresses([address]);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('UTXO query timed out after 20 seconds — RPC may not be connected')), 20000)
  );
  const utxos = await Promise.race([utxoPromise, timeoutPromise]);
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

// ─── Little-endian encoding helpers ───────────────────────────────────
function writeU16LE(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = value & 0xff;
  buf[1] = (value >>> 8) & 0xff;
  return buf;
}

function writeU32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >>> 8) & 0xff;
  buf[2] = (value >>> 16) & 0xff;
  buf[3] = (value >>> 24) & 0xff;
  return buf;
}

function writeU64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

// ─── Covenant ID computation ──────────────────────────────────────────

/**
 * Compute the genesis covenant ID matching Rust's `hashing::covenant_id::covenant_id()`.
 *
 * Uses Blake2b-256 with key "CovenantID" (domain-separated, matching kaspa-hashes).
 * Feeds:
 *   outpoint.transaction_id (32 bytes) +
 *   outpoint.index (u32 LE) +
 *   num_auth_outputs (u64 LE) +
 *   for each auth output: index (u32 LE) + value (u64 LE) +
 *     spk_version (u16 LE) + spk_script_len (u64 LE) + spk_script_bytes
 *
 * @param outpointTxId - Transaction ID being spent (hex string, 64 chars)
 * @param outpointIndex - Output index in the spent transaction
 * @param authOutputs - Array of {index, value, scriptPublicKey} for authorized outputs
 * @returns 32-byte covenant ID as hex string
 */
export function computeCovenantId(
  outpointTxId: string,
  outpointIndex: number,
  authOutputs: Array<{
    index: number;
    value: bigint;
    scriptVersion: number;
    scriptBytes: Uint8Array;
  }>,
): string {
  // Build the preimage matching the Rust hasher feed order
  const parts: Uint8Array[] = [];

  // outpoint.transaction_id (32 bytes raw)
  parts.push(hexToBytes(outpointTxId));

  // outpoint.index (u32 LE)
  parts.push(writeU32LE(outpointIndex));

  // write_len(auth_outputs.len()) — written as u64 LE
  parts.push(writeU64LE(BigInt(authOutputs.length)));

  for (const out of authOutputs) {
    // write_u32(index)
    parts.push(writeU32LE(out.index));
    // write_u64(value)
    parts.push(writeU64LE(out.value));
    // write_u16(spk_version)
    parts.push(writeU16LE(out.scriptVersion));
    // write_var_bytes(spk_script) = write_len(len) + script_bytes
    parts.push(writeU64LE(BigInt(out.scriptBytes.length)));
    parts.push(out.scriptBytes);
  }

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const preimage = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    preimage.set(p, offset);
    offset += p.length;
  }

  // Blake2b-256 with key "CovenantID"
  const hash = blake2b(preimage, { key: COVENANT_ID_KEY, dkLen: 32 });
  return bytesToHex(hash);
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
 *
 * Flow:
 *   1. Select sender UTXOs
 *   2. Build the P2SH output with CovenantBinding (genesis)
 *   3. Compute covenant_id from the funding outpoint + output
 *   4. Sign and submit
 *
 * Uses createTransactions() for UTXO selection + fee calculation,
 * then attaches CovenantBinding to the covenant output before signing.
 */
export async function deployContract(
  compiled: CompiledContract,
  amountSompi: bigint,
  rpcUrl: string,
  privateKeyHex: string,
  network: string,
  existingRpc?: RpcClient,
): Promise<DeployResult> {
  console.log('[CovenantSDK] deployContract start', { network, rpcUrl: rpcUrl || '(using existing)', hasExistingRpc: !!existingRpc });
  const privateKey = new PrivateKey(privateKeyHex);
  const senderAddress = privateKey.toAddress(network).toString();
  const contractAddress = getCovenantAddress(compiled, network);
  const contractScriptPubKey = payToScriptHashScript(toScriptBytes(compiled));
  console.log('[CovenantSDK] senderAddress:', senderAddress, 'contractAddress:', contractAddress);

  const ownRpc = !existingRpc;
  const rpc = existingRpc || connectRpc(rpcUrl, network);

  try {
    if (ownRpc) {
      console.log('[CovenantSDK] Connecting new RPC client...');
      const connectPromise = rpc.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC connection timed out after 15 seconds')), 15000)
      );
      await Promise.race([connectPromise, timeoutPromise]);
      console.log('[CovenantSDK] RPC connected');
    } else {
      console.log('[CovenantSDK] Using existing RPC, isConnected:', rpc.isConnected);
    }

    console.log('[CovenantSDK] Fetching UTXOs for', senderAddress);
    const entries = await getAddressUtxos(rpc, senderAddress);
    console.log('[CovenantSDK] Found', entries.length, 'UTXOs');
    if (entries.length === 0) {
      throw new Error(`No spendable UTXOs found for ${senderAddress}`);
    }

    console.log('[CovenantSDK] Creating transactions...');
    const created = await createTransactions({
      entries,
      outputs: [{ address: contractAddress, amount: amountSompi }],
      changeAddress: senderAddress,
      priorityFee: 0n,
      networkId: network,
    } as never);

    console.log('[CovenantSDK] Transactions created:', created.transactions.length, 'tx(s)');
    let finalTxId = created.summary.finalTransactionId;
    let finalTransaction = created.transactions[created.transactions.length - 1]?.transaction;

    // For multi-tx batch, sign and submit all compound/consolidation TXs first
    for (let i = 0; i < created.transactions.length; i++) {
      const pending = created.transactions[i];
      const isLast = i === created.transactions.length - 1;

      // Attach CovenantBinding to the covenant output in the FINAL transaction
      if (isLast) {
        const covenantOutputIdx = findOutputIndex(pending.transaction, contractAddress, network);
        if (covenantOutputIdx !== -1) {
          // Compute genesis covenant ID
          // The authorizing input is input[0] of this final TX
          const authInput = pending.transaction.inputs[0];
          const outpointTxId = authInput.previousOutpoint.transactionId;
          const outpointIdx = authInput.previousOutpoint.index;

          // ScriptPublicKey for the covenant output
          const spk = contractScriptPubKey;
          const spkScript = spk.script;
          const spkVersion = spk.version;

          const covenantId = computeCovenantId(
            outpointTxId,
            outpointIdx,
            [{
              index: covenantOutputIdx,
              value: amountSompi,
              scriptVersion: spkVersion,
              scriptBytes: typeof spkScript === 'string' ? hexToBytes(spkScript) : spkScript,
            }],
          );

          console.log('[CovenantSDK] Genesis covenant ID:', covenantId);

          // Attach CovenantBinding to the covenant output
          try {
            const hashObj = new Hash(covenantId);
            const binding = new CovenantBinding(covenantOutputIdx, hashObj);
            // Create new TransactionOutput with covenant binding
            const existingOutput = pending.transaction.outputs[covenantOutputIdx];
            const newOutput = new TransactionOutput(existingOutput.value, existingOutput.scriptPublicKey, binding);
            // Replace the output
            pending.transaction.outputs[covenantOutputIdx] = newOutput;
            console.log('[CovenantSDK] CovenantBinding attached to output', covenantOutputIdx);
          } catch (bindErr) {
            // If CovenantBinding attachment fails (e.g., API incompatibility),
            // fall back to standard deploy without binding — still works for P2SH
            console.warn('[CovenantSDK] CovenantBinding attachment failed, deploying without binding:', bindErr);
          }
        }
      }

      console.log(`[CovenantSDK] Signing tx ${i + 1}/${created.transactions.length}...`);
      pending.sign([privateKey]);
      console.log(`[CovenantSDK] Submitting tx ${i + 1}...`);
      finalTxId = await pending.submit(rpc);
      console.log(`[CovenantSDK] Submitted tx ${i + 1}:`, finalTxId);
      finalTransaction = pending.transaction;
    }

    if (!finalTxId || !finalTransaction) {
      throw new Error("Failed to submit deployment transaction");
    }

    const outputIndex = findOutputIndex(finalTransaction, contractAddress, network);
    if (outputIndex === -1) {
      throw new Error("Deployment transaction did not contain the covenant output");
    }

    // Try to extract covenant ID from the output
    let covenantId: string | undefined;
    try {
      const covOutput = finalTransaction.outputs[outputIndex];
      if (covOutput && 'covenant' in covOutput) {
        const cov = (covOutput as any).covenant;
        if (cov?.covenant_id) {
          covenantId = cov.covenant_id.toString();
        }
      }
    } catch {
      // covenant ID extraction is best-effort
    }

    return {
      txid: finalTxId,
      contractAddress,
      outpoint: {
        txid: finalTxId,
        vout: outputIndex,
      },
      covenantId,
    };
  } finally {
    if (ownRpc) await rpc.disconnect().catch(() => undefined);
  }
}

/**
 * Spend a covenant UTXO by calling one of its entrypoint functions.
 *
 * Supports covenant continuation: if the spent UTXO has a covenantId and
 * outputs go to a covenant address, attaches CovenantBinding for continuation.
 *
 * Flow:
 *   1. Build unsigned TX
 *   2. Attach CovenantBinding to continuation outputs
 *   3. Calculate sighash
 *   4. Sign with privateKey
 *   5. Build sigscript via encodePayToScriptHashSignatureScript
 *   6. Submit
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
  existingRpc?: RpcClient,
  covenantId?: string,
): Promise<SpendResult> {
  const privateKey = new PrivateKey(privateKeyHex);
  const covenantAddress = getCovenantAddress(compiled, network);
  const ownRpc = !existingRpc;
  const rpc = existingRpc || connectRpc(rpcUrl, network);

  try {
    if (ownRpc) await rpc.connect();
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

    // Try to get covenant ID from the UTXO entry (new in v1.1.0-rc.3)
    let utxoCovenantId: string | undefined = covenantId;
    if (!utxoCovenantId) {
      try {
        const entryCovId = (entry as any).covenantId;
        if (entryCovId) {
          utxoCovenantId = entryCovId.toString();
          console.log('[CovenantSDK] UTXO covenantId:', utxoCovenantId);
        }
      } catch {
        // covenantId not available on this UTXO
      }
    }

    const txInputs: ITransactionInput[] = [
      {
        previousOutpoint: entry.outpoint,
        utxo: entry,
        sequence: 0n,
        sigOpCount: 1,
      },
    ];

    // Build outputs, attaching CovenantBinding for continuation outputs
    const txOutputs: ITransactionOutput[] = outputs.map((output, idx) => {
      const spk = payToAddressScript(output.address);
      const baseOutput: ITransactionOutput = {
        scriptPublicKey: spk,
        value: output.amount,
      };

      // If this output goes to the same covenant address and we have a covenant ID,
      // attach a continuation CovenantBinding
      if (utxoCovenantId && output.address === covenantAddress) {
        try {
          const hashObj = new Hash(utxoCovenantId);
          const binding = new CovenantBinding(0, hashObj); // authorizing_input = 0 (our covenant input)
          const txOutput = new TransactionOutput(output.amount, spk, binding);
          console.log('[CovenantSDK] Continuation CovenantBinding on output', idx);
          return txOutput as any;
        } catch (err) {
          console.warn('[CovenantSDK] Failed to attach continuation binding:', err);
        }
      }

      return baseOutput;
    });

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
      covenantId: utxoCovenantId,
    };
  } finally {
    if (ownRpc) await rpc.disconnect().catch(() => undefined);
  }
}

/**
 * Query UTXOs for a covenant address and return covenant-specific information.
 * Leverages the new covenantId field on UtxoEntry (v1.1.0-rc.3).
 */
export async function getCovenantUtxos(
  compiled: CompiledContract,
  rpcUrl: string,
  network: string,
  existingRpc?: RpcClient,
): Promise<Array<{
  outpoint: CovenantOutpoint;
  amount: bigint;
  covenantId?: string;
  blockDaaScore: bigint;
}>> {
  const covenantAddress = getCovenantAddress(compiled, network);
  const ownRpc = !existingRpc;
  const rpc = existingRpc || connectRpc(rpcUrl, network);

  try {
    if (ownRpc) {
      const connectPromise = rpc.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC connection timed out after 15 seconds')), 15000)
      );
      await Promise.race([connectPromise, timeoutPromise]);
    }

    const utxos = await getAddressUtxos(rpc, covenantAddress);

    return utxos.map((entry) => {
      let entryCovenantId: string | undefined;
      try {
        const cid = (entry as any).covenantId;
        if (cid) entryCovenantId = cid.toString();
      } catch {
        // covenantId not available
      }

      return {
        outpoint: {
          txid: entry.outpoint.transactionId,
          vout: entry.outpoint.index,
        },
        amount: entry.amount,
        covenantId: entryCovenantId,
        blockDaaScore: entry.blockDaaScore,
      };
    });
  } finally {
    if (ownRpc) await rpc.disconnect().catch(() => undefined);
  }
}
