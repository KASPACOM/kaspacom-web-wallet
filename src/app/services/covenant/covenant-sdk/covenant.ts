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
  type PartiallySignedSpend,
  type SpendOutput,
  type SpendResult,
} from "./types";

const SUBNETWORK_ID_NATIVE = "0000000000000000000000000000000000000000";

/** Domain separation key for covenant ID hashing — must match Rust `CovenantID` hasher */
const COVENANT_ID_KEY = new TextEncoder().encode("CovenantID");

type SupportedSigArg = Uint8Array | bigint;

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

    if (input.type_name === "int" || input.type_name === "bool") {
      if (typeof arg === "bigint") {
        builder.addI64(arg);
      } else {
        throw new Error(
          `Function "${functionName}" param "${input.name}:${input.type_name}" requires a bigint value, got Uint8Array`,
        );
      }
      continue;
    }

    if (input.type_name === "sig") {
      if (typeof arg !== "object" || arg.length !== 65) {
        throw new Error(`Expected sig argument "${input.name}" to be 65 bytes`);
      }
      builder.addData(arg);
      continue;
    }

    if (input.type_name === "pubkey") {
      if (typeof arg !== "object" || arg.length !== 32) {
        throw new Error(`Expected pubkey argument "${input.name}" to be 32 bytes`);
      }
      builder.addData(arg);
      continue;
    }

    if (input.type_name === "byte" || /^byte\[\d+\]$/.test(input.type_name)) {
      if (typeof arg !== "object") {
        throw new Error(`Expected byte argument "${input.name}" to be Uint8Array`);
      }
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
  extraArgs?: Record<string, bigint>,
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
    if (input.type_name === "int" || input.type_name === "bool") {
      const val = extraArgs?.[input.name];
      if (val === undefined) {
        throw new Error(
          `Function "${functionName}" requires "${input.name}:${input.type_name}" — pass it via extraArgs`,
        );
      }
      return val;
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
  extraArgs?: Record<string, bigint>,
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

    // Count sig ops from the ABI — multi-sig functions have > 1 checkSig
    const abiEntry = getAbiEntry(compiled, functionName);
    const sigOpCount = abiEntry.inputs.filter((inp: any) => inp.type_name === 'sig').length || 1;

    const txInputs: ITransactionInput[] = [
      {
        previousOutpoint: entry.outpoint,
        utxo: entry,
        sequence: 0n,
        sigOpCount,
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

    // Determine if this function uses a timelock by checking for time_op in AST body.
    // Kaspa's LOCK_TIME_THRESHOLD = 500,000,000,000:
    //   values < 500B → DAA score, values >= 500B → Unix milliseconds
    // For functions WITH timelocks: use the node's pastMedianTime as lockTime.
    //   CRITICAL: Date.now() may be ahead of the node's virtual pastMedianTime.
    //   Kaspa consensus rejects TX if lockTime >= pastMedianTime ("not finalized").
    //   So we query pastMedianTime from the node and use it directly.
    // For functions WITHOUT timelocks: set lockTime to 0 (no consensus locktime check)
    // Determine lockTime based on AST time_op nodes:
    //   tx_var === 'tx_time' (tx.time) → needs lockTime set to Unix ms
    //   tx_var === 'this_age' (this.age) → DAA block count, does NOT need lockTime
    const astFunction = compiled.ast?.functions?.find((f: any) => f.name === functionName);
    const needsLockTime = astFunction?.body?.some(
      (node: any) => node.kind === 'time_op' && node.data?.tx_var === 'tx_time'
    ) ?? false;
    let lockTime = 0n;
    if (needsLockTime) {
      try {
        const dagInfo = await rpc.getBlockDagInfo();
        // CRITICAL: Kaspa consensus check is STRICTLY LESS THAN (tx.lock_time < pastMedianTime).
        // Using pastMedianTime directly would fail since equal is NOT less than.
        // Subtract 1 to ensure the TX is accepted.
        lockTime = BigInt(dagInfo.pastMedianTime) - 1n;
        console.log('[CovenantSDK] lockTime from pastMedianTime - 1:', lockTime.toString());
      } catch {
        // Fallback: use Date.now() - 10s buffer (less reliable)
        lockTime = BigInt(Date.now() - 10_000);
        console.warn('[CovenantSDK] lockTime fallback (Date.now - 10s):', lockTime.toString());
      }
    }
    console.log('[CovenantSDK] lockTime:', lockTime.toString(), needsLockTime ? '(Unix ms — tx.time lock)' : '(no lockTime needed)');

    const unsignedTx = new Transaction({
      version: 1,
      lockTime,
      inputs: txInputs,
      outputs: txOutputs,
      subnetworkId: SUBNETWORK_ID_NATIVE,
      gas: 0n,
      payload: "",
    });

    const signatureHex = createInputSignature(unsignedTx, 0, privateKey, SighashType.All);
    // createInputSignature returns: [length_prefix(1)] + [schnorr_sig(64)] + [sighash_type(1)] = 66 bytes
    // The contract expects just [schnorr_sig(64)] + [sighash_type(1)] = 65 bytes (no length prefix)
    const sigHexStr = String(signatureHex);
    let signature = hexToBytes(sigHexStr);
    if (signature.length === 66 && signature[0] === 65) {
      // Strip the length prefix byte — 65 means "65 bytes of sig+sighash follow"
      signature = signature.slice(1);
    }
    console.log('[CovenantSDK] signature bytes:', signature.length);
    const functionArgs = resolveSpendFunctionArgs(compiled, functionName, signature, privateKey, extraArgs);
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

// ── Two-Phase Signing ────────────────────────────────────────
// For multi-party contracts (escrow release, multi-sig, x402 settle)
// Phase 1: Build unsigned TX + sign your part → produce PartiallySignedSpend
// Phase 2: Receive PSS, add your sig → complete + broadcast

/**
 * Phase 1: Build a partially signed spend. Signs only the params that match
 * the provided private key. Returns a serializable object that can be
 * shared with the co-signer.
 */
export async function buildPartialSpend(
  compiled: CompiledContract,
  functionName: string,
  outpoint: CovenantOutpoint,
  inputAmountSompi: bigint,
  outputs: SpendOutput[],
  privateKeyHex: string,
  network: string,
  rpcUrl: string,
  existingRpc?: any,
): Promise<PartiallySignedSpend> {
  const covenantAddress = getCovenantAddress(compiled, network);
  const abiEntry = getAbiEntry(compiled, functionName);

  // Determine which sig params this key can sign
  const privateKey = new PrivateKey(privateKeyHex);
  const pubkeyHex = privateKey.toPublicKey().toXOnlyPublicKey().toString();

  // Connect to get UTXO
  const ownRpc = !existingRpc;
  const rpc = existingRpc || connectRpc(rpcUrl, network);

  try {
    if (ownRpc) await rpc.connect();

    const utxos = await getAddressUtxos(rpc, covenantAddress);
    const entry = utxos.find(
      (u: any) => u.outpoint.transactionId === outpoint.txid && Number(u.outpoint.index) === outpoint.vout
    );
    if (!entry) throw new Error(`UTXO ${outpoint.txid}:${outpoint.vout} not found at ${covenantAddress}`);

    // Count sig params for sigOpCount
    const sigParams = abiEntry.inputs.filter(inp => inp.type_name === 'sig');
    const sigOpCount = sigParams.length;

    // Detect timelock: only tx.time needs lockTime, this.age does not
    const astFn = compiled.ast?.functions?.find(f => f.name === functionName);
    const needsLockTime = astFn?.body?.some(
      (n: any) => n.kind === 'time_op' && n.data?.tx_var === 'tx_time'
    ) ?? false;
    let lockTime = 0n;
    if (needsLockTime) {
      try {
        const dagInfo = await rpc.getBlockDagInfo();
        lockTime = BigInt(dagInfo.pastMedianTime) - 1n;
      } catch {
        lockTime = BigInt(Date.now() - 10_000);
      }
    }

    // Build unsigned TX
    const txInputs: ITransactionInput[] = [{
      previousOutpoint: entry.outpoint,
      utxo: entry,
      sequence: 0n,
      sigOpCount,
    }];

    const txOutputs: ITransactionOutput[] = outputs.map(o => ({
      scriptPublicKey: payToAddressScript(o.address),
      value: o.amount,
    }));

    const unsignedTx = new Transaction({
      version: 1,
      lockTime,
      inputs: txInputs,
      outputs: txOutputs,
      subnetworkId: SUBNETWORK_ID_NATIVE,
      gas: 0n,
      payload: "",
    });

    // Sign this key's params
    const signatureHex = createInputSignature(unsignedTx, 0, privateKey, SighashType.All);
    let signature = hexToBytes(String(signatureHex));
    if (signature.length === 66 && signature[0] === 65) signature = signature.slice(1);
    const sigHex = bytesToHex(signature);

    // Match this pubkey to contract params
    const contractPubkeys = extractContractPubkeys(compiled);
    const signatures: Array<{ paramName: string; signatureHex: string }> = [];
    const pendingParams: string[] = [];

    for (const sigParam of sigParams) {
      // Find which contract pubkey this sig param references
      // In the ABI, sig params map to constructor pubkey params by position/name convention
      const matchingPubkey = findMatchingPubkey(compiled, functionName, sigParam.name, contractPubkeys);

      if (matchingPubkey && matchingPubkey === pubkeyHex) {
        signatures.push({ paramName: sigParam.name, signatureHex: sigHex });
      } else {
        pendingParams.push(sigParam.name);
      }
    }

    return {
      compiledJson: JSON.stringify(compiled),
      functionName,
      network,
      outpoint,
      inputAmountSompi: inputAmountSompi.toString(),
      outputs: outputs.map(o => ({ address: o.address, amountSompi: o.amount.toString() })),
      signatures,
      pendingParams,
      lockTime: lockTime.toString(),
      sigOpCount,
    };
  } finally {
    if (ownRpc) await rpc.disconnect().catch(() => undefined);
  }
}

/**
 * Phase 2: Complete a partially signed spend by adding the remaining signature(s)
 * and broadcasting.
 */
export async function completePartialSpend(
  partialSpend: PartiallySignedSpend,
  privateKeyHex: string,
  rpcUrl: string,
  existingRpc?: any,
): Promise<SpendResult> {
  const compiled: CompiledContract = JSON.parse(partialSpend.compiledJson);
  const covenantAddress = getCovenantAddress(compiled, partialSpend.network);

  const privateKey = new PrivateKey(privateKeyHex);
  const ownRpc = !existingRpc;
  const rpc = existingRpc || connectRpc(rpcUrl, partialSpend.network);

  try {
    if (ownRpc) await rpc.connect();

    const utxos = await getAddressUtxos(rpc, covenantAddress);
    const entry = utxos.find(
      (u: any) => u.outpoint.transactionId === partialSpend.outpoint.txid &&
                   Number(u.outpoint.index) === partialSpend.outpoint.vout
    );
    if (!entry) throw new Error(`UTXO not found for completion`);

    // Rebuild the exact same unsigned TX
    const txInputs: ITransactionInput[] = [{
      previousOutpoint: entry.outpoint,
      utxo: entry,
      sequence: 0n,
      sigOpCount: partialSpend.sigOpCount,
    }];

    const txOutputs: ITransactionOutput[] = partialSpend.outputs.map(o => ({
      scriptPublicKey: payToAddressScript(o.address),
      value: BigInt(o.amountSompi),
    }));

    const unsignedTx = new Transaction({
      version: 1,
      lockTime: BigInt(partialSpend.lockTime),
      inputs: txInputs,
      outputs: txOutputs,
      subnetworkId: SUBNETWORK_ID_NATIVE,
      gas: 0n,
      payload: "",
    });

    // Sign our params
    const signatureHex = createInputSignature(unsignedTx, 0, privateKey, SighashType.All);
    let signature = hexToBytes(String(signatureHex));
    if (signature.length === 66 && signature[0] === 65) signature = signature.slice(1);
    const newSigHex = bytesToHex(signature);

    // Merge signatures
    const allSigs = [...partialSpend.signatures];
    for (const paramName of partialSpend.pendingParams) {
      allSigs.push({ paramName, signatureHex: newSigHex });
    }

    // Build the complete sigscript in ABI order
    const abiEntry = getAbiEntry(compiled, partialSpend.functionName);
    const functionArgs: SupportedSigArg[] = [];
    for (const input of abiEntry.inputs) {
      if (input.type_name === 'sig') {
        const sigEntry = allSigs.find(s => s.paramName === input.name);
        if (!sigEntry) throw new Error(`Missing signature for param "${input.name}"`);
        functionArgs.push(hexToBytes(sigEntry.signatureHex));
      } else if (input.type_name === 'pubkey') {
        functionArgs.push(hexToBytes(privateKey.toPublicKey().toXOnlyPublicKey().toString()));
      } else if (input.type_name === 'int' || input.type_name === 'bool') {
        // Extra args are passed through the partial spend's extraArgs field
        const extraVal = partialSpend.extraArgs?.[input.name];
        if (extraVal === undefined) throw new Error(`Missing extra arg "${input.name}" in partial spend`);
        functionArgs.push(BigInt(extraVal));
      } else {
        throw new Error(`Unsupported ABI input type "${input.type_name}" in two-phase signing`);
      }
    }

    const sigPrefix = buildSigScript(compiled, partialSpend.functionName, functionArgs);
    unsignedTx.inputs[0].signatureScript = ScriptBuilder.fromScript(
      toScriptBytes(compiled)
    ).encodePayToScriptHashSignatureScript(sigPrefix);

    const submitted = await rpc.submitTransaction({
      transaction: unsignedTx,
      allowOrphan: false,
    });

    return {
      txid: submitted.transactionId,
      functionName: partialSpend.functionName,
    };
  } finally {
    if (ownRpc) await rpc.disconnect().catch(() => undefined);
  }
}

// ── Helpers for Two-Phase Signing ────────────────────────────

function extractContractPubkeys(compiled: CompiledContract): Map<string, string> {
  // Extract pubkey param names and their placeholder values from the AST
  const pubkeys = new Map<string, string>();
  for (const param of compiled.ast.params) {
    if (param.type_ref.base === 'pubkey') {
      pubkeys.set(param.name, ''); // Value will be matched at runtime
    }
  }
  return pubkeys;
}

function findMatchingPubkey(
  compiled: CompiledContract,
  functionName: string,
  sigParamName: string,
  _contractPubkeys: Map<string, string>,
): string | undefined {
  // In SilverScript, sig params in functions reference constructor pubkeys
  // by convention. E.g., in escrow:
  //   release(sig buyerSig, sig sellerSig) → buyer, seller pubkeys
  // We match by examining the AST require(checkSig(sigParam, pubkeyParam)) calls
  const astFn = compiled.ast.functions.find(f => f.name === functionName);
  if (!astFn) return undefined;

  for (const node of astFn.body) {
    if (node.kind === 'require') {
      const expr = (node.data as any)?.expr;
      if (expr?.kind === 'call' && expr.data?.name === 'checkSig') {
        const args = expr.data.args;
        if (args?.length === 2 && args[0]?.data === sigParamName) {
          // Found: checkSig(sigParamName, pubkeyName)
          // The pubkey name references a constructor param
          return args[1]?.data; // Returns the pubkey param name, not the actual hex
        }
      }
    }
  }
  return undefined;
}
