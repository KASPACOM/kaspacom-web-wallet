import {
  Address,
  addressFromScriptPublicKey,
  calculateTransactionFee,
  createInputSignature,
  createTransactions,
  CovenantBinding,
  Hash,
  payToAddressScript,
  payToScriptHashScript,
  PrivateKey,
  RpcClient,
  ScriptBuilder,
  SighashType,
  signTransaction,
  Transaction,
  TransactionInput,
  TransactionOutput,
  type ITransactionInput,
  type ITransactionOutput,
  type UtxoEntryReference,
} from '../../../../../public/kaspa/kaspa';
import {
  type CompiledContract,
  type CovenantOutpoint,
  type DeployResult,
  type PartiallySignedSpend,
  type SpendOutput,
  type SpendResult,
} from './types';

const SUBNETWORK_ID_NATIVE = '0000000000000000000000000000000000000000';
const DUMMY_SIGNATURE_BYTES = new Uint8Array(65);

type SupportedSigArg = Uint8Array | bigint;

function toScriptBytes(compiled: CompiledContract): Uint8Array {
  return Uint8Array.from(compiled.script);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/i, '');
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: "${hex}"`);
  }
  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`Invalid hex string: "${hex}"`);
  }

  const out = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    out[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function requireAddress(value: Address | undefined, context: string): Address {
  if (!value) {
    throw new Error(`${context} did not resolve to a Kaspa address`);
  }
  return value;
}

function getAbiEntry(compiled: CompiledContract, functionName: string) {
  const entry = compiled.abi.find(
    (candidate) => candidate.name === functionName,
  );
  if (!entry) {
    throw new Error(`Function "${functionName}" not found in compiled ABI`);
  }
  return entry;
}

function getFunctionSelector(
  compiled: CompiledContract,
  functionName: string,
): bigint | undefined {
  if (compiled.without_selector) {
    return undefined;
  }

  const selector = compiled.abi.findIndex(
    (candidate) => candidate.name === functionName,
  );
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
    throw new Error(
      `Function "${functionName}" expects ${abiEntry.inputs.length} arguments`,
    );
  }

  const builder = new ScriptBuilder();

  for (let index = 0; index < abiEntry.inputs.length; index += 1) {
    const input = abiEntry.inputs[index];
    const arg = functionArgs[index];

    if (input.type_name === 'int' || input.type_name === 'bool') {
      if (typeof arg === 'bigint') {
        builder.addI64(arg);
      } else {
        throw new Error(
          `Function "${functionName}" param "${input.name}:${input.type_name}" requires a bigint value, got Uint8Array`,
        );
      }
      continue;
    }

    if (input.type_name === 'sig') {
      if (typeof arg !== 'object' || arg.length !== 65) {
        throw new Error(`Expected sig argument "${input.name}" to be 65 bytes`);
      }
      builder.addData(arg);
      continue;
    }

    if (input.type_name === 'pubkey') {
      if (typeof arg !== 'object' || arg.length !== 32) {
        throw new Error(
          `Expected pubkey argument "${input.name}" to be 32 bytes`,
        );
      }
      builder.addData(arg);
      continue;
    }

    if (input.type_name === 'byte' || /^byte\[\d+\]$/.test(input.type_name)) {
      if (typeof arg !== 'object') {
        throw new Error(
          `Expected byte argument "${input.name}" to be Uint8Array`,
        );
      }
      builder.addData(encodeAbiBytesArray(input.type_name, arg));
      continue;
    }

    throw new Error(
      `Unsupported ABI argument type "${input.type_name}" for "${functionName}"`,
    );
  }

  const selector = getFunctionSelector(compiled, functionName);
  if (selector !== undefined) {
    builder.addI64(selector);
  }

  return builder.drain();
}

async function getAddressUtxos(
  rpc: RpcClient,
  address: string,
): Promise<UtxoEntryReference[]> {
  const utxoPromise = rpc.getUtxosByAddresses([address]);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'UTXO query timed out after 20 seconds — RPC may not be connected',
          ),
        ),
      20000,
    ),
  );
  const utxos = await Promise.race([utxoPromise, timeoutPromise]);
  return utxos.entries;
}

function findOutputIndex(
  transaction: Transaction,
  address: string,
  network: string,
): number {
  return transaction.outputs.findIndex((output) => {
    const resolved = addressFromScriptPublicKey(
      output.scriptPublicKey,
      network,
    );
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
  const xOnlyPubkey = hexToBytes(
    privateKey.toPublicKey().toXOnlyPublicKey().toString(),
  );

  return entry.inputs.map((input) => {
    if (input.type_name === 'sig') {
      return signature;
    }
    if (input.type_name === 'pubkey') {
      return xOnlyPubkey;
    }
    if (input.type_name === 'int' || input.type_name === 'bool') {
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

// ─── Covenant ID computation ──────────────────────────────────────────
// The covenant id is no longer computed locally. It is derived at deploy time
// by the kaspa library's tx.populateGenesisCovenants() and read back from the
// bound output's covenant.covenantId field (see deployContract()).

function applyEstimatedSignatureScripts(
  tx: Transaction,
  compiled: CompiledContract,
  functionName: string,
  privateKey: PrivateKey,
  extraArgs?: Record<string, bigint>,
): void {
  const functionArgs = resolveSpendFunctionArgs(
    compiled,
    functionName,
    DUMMY_SIGNATURE_BYTES,
    privateKey,
    extraArgs,
  );
  const sigPrefix = buildSigScript(compiled, functionName, functionArgs);

  tx.inputs[0].signatureScript = ScriptBuilder.fromScript(
    toScriptBytes(compiled),
  ).encodePayToScriptHashSignatureScript(sigPrefix);

  for (let i = 1; i < tx.inputs.length; i += 1) {
    tx.inputs[i].signatureScript = new ScriptBuilder()
      .addData(DUMMY_SIGNATURE_BYTES)
      .drain();
  }
}

function applyEstimatedStandardSignatureScripts(tx: Transaction): void {
  for (const input of tx.inputs) {
    input.signatureScript = new ScriptBuilder()
      .addData(DUMMY_SIGNATURE_BYTES)
      .drain();
  }
}

function getTransactionInputAmount(tx: Transaction): bigint {
  return tx.inputs.reduce((sum, input) => sum + (input.utxo?.amount ?? 0n), 0n);
}

function getTransactionOutputAmount(tx: Transaction): bigint {
  return tx.outputs.reduce((sum, output) => sum + output.value, 0n);
}

function reconcileDeployFee(
  tx: Transaction,
  network: string,
  senderAddress: string,
  priorityFee: bigint,
): void {
  applyEstimatedStandardSignatureScripts(tx);

  const transactionFee = calculateTransactionFee(network, tx);
  if (!transactionFee) {
    throw new Error('Transaction fee not calculated');
  }

  const requiredFee = transactionFee + priorityFee;
  const currentFee =
    getTransactionInputAmount(tx) - getTransactionOutputAmount(tx);
  if (currentFee >= requiredFee) {
    return;
  }

  const feeShortfall = requiredFee - currentFee;
  const changeOutputIdx = findOutputIndex(tx, senderAddress, network);
  if (changeOutputIdx === -1) {
    throw new Error(
      `Insufficient deploy funds for post-binding fee. Need ${requiredFee} sompi, have ${currentFee}`,
    );
  }

  const changeOutput = tx.outputs[changeOutputIdx];
  if (changeOutput.value <= feeShortfall) {
    throw new Error(
      `Insufficient deploy change for post-binding fee. Need ${feeShortfall} sompi, have ${changeOutput.value}`,
    );
  }

  changeOutput.value -= feeShortfall;
}

/**
 * Build a v1-shape TransactionInput from a UtxoEntryReference.
 *
 * Mirrors the tn12-covenant-tools owner-marker example (new TransactionInput
 * with an explicit utxo object and signatureScript: ""), but uses the
 * v1-correct sigOpCount / computeBudget shape:
 *   - sigOpCount: 0   (v1 carries the cost in computeBudget instead)
 *   - computeBudget: 10
 *
 * The example uses `sigOpCount: 1, computeBudget: 10`, which is the v0
 * shape. KIP-20 / v1 covenant txs are rejected by the node with
 * "RpcTransactionInput.sig_op_count is inconsistent with transaction
 * version 1" when sigOpCount is non-zero.
 */
function buildCovenantInput(
  entry: UtxoEntryReference,
  computeBudget: number = 10,
): TransactionInput {
  // The ITransactionInput.utxo field is typed as UtxoEntryReference (a class
  // with a private constructor) but the runtime accepts a plain object
  // matching the same shape — this is what the working tn12-covenant-tools
  // example does. Cast the class instance through unknown to silence TS
  // without losing the type information for the rest of the call site.
  const utxoRef = entry as unknown as ITransactionInput['utxo'];
  return new TransactionInput({
    previousOutpoint: entry.outpoint,
    signatureScript: '',
    sequence: 0n,
    sigOpCount: 0,
    computeBudget,
    utxo: utxoRef,
  });
}

/**
 * Get the P2SH address for a compiled covenant contract.
 * Uses payToScriptHashScript() to hash the contract bytecode.
 */
export function getCovenantAddress(
  compiled: CompiledContract,
  network: string,
): string {
  const scriptPublicKey = payToScriptHashScript(toScriptBytes(compiled));
  return requireAddress(
    addressFromScriptPublicKey(scriptPublicKey, network),
    compiled.contract_name,
  ).toString();
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
  privateKeyHex: string,
  network: string,
  rpc: RpcClient,
  priorityFee: bigint = 0n,
): Promise<DeployResult> {
  const privateKey = new PrivateKey(privateKeyHex);
  const senderAddress = privateKey.toAddress(network).toString();
  const contractAddress = getCovenantAddress(compiled, network);

  const entries = await getAddressUtxos(rpc, senderAddress);
  if (entries.length === 0) {
    throw new Error(`No spendable UTXOs found for ${senderAddress}`);
  }

  let payload;

  // Attach TN10 deployment-claim metadata to the final transaction.
  const deploymentClaim = compiled.tn10;
  if (deploymentClaim) {
    try {
      const payloadJson = JSON.stringify({ tn10: deploymentClaim });
      const payloadBytes = new TextEncoder().encode(payloadJson);
      payload = payloadBytes;
    } catch (payloadErr) {
      console.warn(
        '[CovenantSDK] Failed to attach deployment claim payload:',
        payloadErr,
      );
    }
  }

  const created = await createTransactions({
    version: 1,
    entries,
    outputs: [{ address: contractAddress, amount: amountSompi }],
    changeAddress: senderAddress,
    priorityFee,
    networkId: network,
    payload,
  } as never);

  let finalTxId = created.summary.finalTransactionId;
  let finalTransaction =
    created.transactions[created.transactions.length - 1]?.transaction;

  // KIP-20: covenant genesis covenant id. Populated on the final tx via
  // tx.populateGenesisCovenants + tx.finalize, then read back from the
  // bound output's covenant.covenantId.
  let covenantId: string | undefined;

  // For multi-tx batch, sign and submit all compound/consolidation TXs first
  for (let i = 0; i < created.transactions.length; i++) {
    const pending = created.transactions[i];
    const isLast = i === created.transactions.length - 1;

    if (isLast) {
      // FINAL deploy tx: must be KIP-20 v1 with populateGenesisCovenants.
      // Mutations to pending.transaction don't reliably survive the
      // pending.submit() wrapper (the binding is written to the tx state but
      // the wrapper's submit path may serialize before picking it up). Pull
      // the underlying Transaction into a local, mutate, sign via the
      // runtime's signTransaction, and submit via the raw RPC.
      let tx = pending.transaction;
      const covenantOutputIdx = findOutputIndex(tx, contractAddress, network);
      if (covenantOutputIdx !== -1) {
        tx.version = 1;

        // v1 inputs must declare sig_op_count + compute_budget in the
        // wire form. createTransactions() builds inputs in v0 shape
        // (sigOpCount: 1, no computeBudget), which the RPC rejects with
        // "sig_op_count is inconsistent with transaction version 1".
        // Mutate the inputs to the v1 shape before finalize/sign.
        for (const input of tx.inputs) {
          input.sigOpCount = 0;
          input.computeBudget = 10;
        }

        try {
          tx.populateGenesisCovenants([
            { authorizingInput: 0, outputs: [covenantOutputIdx] },
          ]);
          // finalize() recomputes the tx id from the post-binding state so
          // the sighash + network-agreed id stay in sync.
          tx.finalize();
        } catch (bindErr) {
          // A covenant deploy MUST be bound — broadcasting an unbound P2SH UTXO
          // would lock funds in something the spend path cannot treat as a
          // covenant. Abort instead of silently downgrading the deploy.
          throw new Error(
            `Covenant binding failed; aborting deploy to avoid locking funds in a non-covenant UTXO: ${bindErr instanceof Error ? bindErr.message : String(bindErr)}`,
          );
        }
      } else {
        // No covenant output to bind, but the tx is still v1 (compound
        // chain-finalize). Mutate the inputs to v1 shape so the RPC
        // accepts the version.
        for (const input of tx.inputs) {
          input.sigOpCount = 0;
          input.computeBudget = 10;
        }
      }

      reconcileDeployFee(tx, network, senderAddress, priorityFee);
      tx.finalize();

      const signed = signTransaction(tx, [privateKey], true);
      const submitted = await rpc.submitTransaction({
        transaction: signed,
        allowOrphan: false,
      });
      finalTxId = submitted.transactionId;
      finalTransaction = signed;
    } else {
      // Compound / consolidation tx: no covenant binding needed, use the
      // standard pending path.
      pending.sign([privateKey]);
      finalTxId = await pending.submit(rpc);
      finalTransaction = pending.transaction;
    }
  }

  if (!finalTxId || !finalTransaction) {
    throw new Error('Failed to submit deployment transaction');
  }

  const outputIndex = findOutputIndex(
    finalTransaction,
    contractAddress,
    network,
  );
  if (outputIndex === -1) {
    throw new Error(
      'Deployment transaction did not contain the covenant output',
    );
  }

  // Read the canonical covenant id from the serialized tx. The example pattern
  // (serializeToSafeJSON → JSON.parse → read outputs[i].covenant.covenantId) is
  // the most reliable — the in-memory binding object may not expose every
  // field the wire form does.
  try {
    const serialized = JSON.parse(finalTransaction.serializeToSafeJSON());
    const covenant = serialized?.outputs?.[outputIndex]?.covenant;
    if (covenant?.covenantId) {
      covenantId = String(covenant.covenantId);
      console.log('covenantId', covenantId);
    }
  } catch {
    // best-effort; if serialization fails, fall back to whatever was already set
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
  privateKeyHex: string,
  network: string,
  rpc: RpcClient,
  covenantId?: string,
  extraArgs?: Record<string, bigint>,
  priorityFee: bigint = 0n,
  useSenderFee: boolean = false,
  transactionPayloadHex?: string,
): Promise<SpendResult> {
  const privateKey = new PrivateKey(privateKeyHex);
  const covenantAddress = getCovenantAddress(compiled, network);

  const utxos = await getAddressUtxos(rpc, covenantAddress);
  const entry = utxos.find(
    (candidate) =>
      candidate.outpoint.transactionId === outpoint.txid &&
      candidate.outpoint.index === outpoint.vout,
  );

  if (!entry) {
    throw new Error(
      `Covenant outpoint ${outpoint.txid}:${outpoint.vout} was not found for ${covenantAddress}`,
    );
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
      }
    } catch {
      // covenantId not available on this UTXO
    }
  }

  const txInputs: ITransactionInput[] = [buildCovenantInput(entry)];

  // --- Fee and Change Logic (Dynamic) ---
  const MAX_TRANSACTION_FEE = 20000n;
  const MINIMAL_AMOUNT_TO_SEND = 20000000n; // 0.2 KAS as per project constants

  const spendOutputsSum = outputs.reduce((sum, o) => sum + o.amount, 0n);
  const senderAddress = privateKey.toAddress(network).toString();
  const selectedWalletUtxos: UtxoEntryReference[] = [];
  let walletSelectedAmount = 0n;

  if (useSenderFee) {
    const targetRequired =
      spendOutputsSum + MAX_TRANSACTION_FEE + MINIMAL_AMOUNT_TO_SEND;
    const shortfall =
      targetRequired > inputAmountSompi
        ? targetRequired - inputAmountSompi
        : 0n;

    if (shortfall > 0n) {
      const walletUtxos = await getAddressUtxos(rpc, senderAddress);

      for (const utxo of walletUtxos.sort((a, b) =>
        Number(b.amount - a.amount),
      )) {
        selectedWalletUtxos.push(utxo);
        walletSelectedAmount += utxo.amount;
        if (walletSelectedAmount >= shortfall) break;
      }

      if (walletSelectedAmount < shortfall) {
        throw new Error(
          `Insufficient wallet balance for transaction fee. Need at least ${shortfall} sompi from wallet, found ${walletSelectedAmount}`,
        );
      }
    }

    for (const utxoEntry of selectedWalletUtxos) {
      txInputs.push(buildCovenantInput(utxoEntry));
    }
  }

  // Build outputs, attaching CovenantBinding for continuation outputs
  const txOutputs: ITransactionOutput[] = outputs.map((output, idx) => {
    const spk = payToAddressScript(output.address);
    const baseOutput: ITransactionOutput = {
      scriptPublicKey: spk,
      value: output.amount,
    };

    // Determine which covenant ID to use for this output:
    //   1. Prefer the per-output explicit covenantId (keepAlive → new DMS contract)
    //   2. Fall back to the global utxoCovenantId if output goes to same covenant address
    const bindingCovenantId =
      output.covenantId ??
      (utxoCovenantId && output.address === covenantAddress
        ? utxoCovenantId
        : undefined);

    if (bindingCovenantId) {
      try {
        const hashObj = new Hash(bindingCovenantId);
        const binding = new CovenantBinding(0, hashObj); // authorizing_input = 0 (our covenant input)
        const txOutput = new TransactionOutput(output.amount, spk, binding);
        return txOutput as any;
      } catch (err) {
        console.warn(
          '[CovenantSDK] Failed to attach continuation binding:',
          err,
        );
      }
    }

    return baseOutput;
  });

  // Add temporary change output if we have a surplus or picked wallet UTXOs (and useSenderFee is true)
  let changeOutputIdx = -1;
  const totalInputsAmount = inputAmountSompi + walletSelectedAmount;
  if (useSenderFee && totalInputsAmount > spendOutputsSum) {
    changeOutputIdx = txOutputs.length;
    txOutputs.push({
      scriptPublicKey: payToAddressScript(senderAddress),
      value: totalInputsAmount - spendOutputsSum, // Temporary value
    });
  }

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
  const astFunction = compiled.ast?.functions?.find(
    (f: any) => f.name === functionName,
  );
  const needsLockTime =
    astFunction?.body?.some(
      (node: any) => node.kind === 'time_op' && node.data?.tx_var === 'tx_time',
    ) ?? false;
  let lockTime = 0n;
  if (needsLockTime) {
    try {
      const dagInfo = await rpc.getBlockDagInfo();
      // CRITICAL: Kaspa consensus check is STRICTLY LESS THAN (tx.lock_time < pastMedianTime).
      // Using pastMedianTime directly would fail since equal is NOT less than.
      // Subtract 1 to ensure the TX is accepted.
      lockTime = BigInt(dagInfo.pastMedianTime) - 1n;
    } catch {
      // Fallback: use Date.now() - 10s buffer (less reliable)
      lockTime = BigInt(Date.now() - 10_000);
      console.warn(
        '[CovenantSDK] lockTime fallback (Date.now - 10s):',
        lockTime.toString(),
      );
    }
  }

  const unsignedTx = new Transaction({
    version: 1,
    lockTime,
    inputs: txInputs,
    outputs: txOutputs,
    subnetworkId: SUBNETWORK_ID_NATIVE,
    gas: 0n,
    payload: transactionPayloadHex || '',
  });

  // KIP-20: recompute the tx id from the post-binding state so the sighash
  // and the network-agreed id stay in sync with the bound outputs.
  unsignedTx.finalize();
  applyEstimatedSignatureScripts(
    unsignedTx,
    compiled,
    functionName,
    privateKey,
    extraArgs,
  );

  // --- Dynamic Fee Adjustment ---
  const transactionFee = calculateTransactionFee(network, unsignedTx);

  if (!transactionFee) {
    throw new Error('Transaction fee not calculated');
  }
  const totalFees = transactionFee + priorityFee;

  if (useSenderFee) {
    if (changeOutputIdx !== -1) {
      const finalChange = totalInputsAmount - spendOutputsSum - totalFees;
      if (finalChange < MINIMAL_AMOUNT_TO_SEND) {
        throw new Error(
          `Insufficient change to cover the fee. Need ${MINIMAL_AMOUNT_TO_SEND}, have ${finalChange}`,
        );
      }
      unsignedTx.outputs[changeOutputIdx].value = finalChange;
    } else {
      // If no change output, ensure the surplus covers the fee
      const surplus = totalInputsAmount - spendOutputsSum;
      if (surplus < totalFees) {
        throw new Error(
          `Insufficient funds for fee. Need ${totalFees}, have ${surplus}`,
        );
      }
    }
  } else {
    const newOutputSum = spendOutputsSum - totalFees;

    // When fees are paid from the covenant itself, callers must pre-subtract fees from the requested outputs.
    // Auto-deducting from an output can violate covenant constraints that require exact output values.
    const surplus = totalInputsAmount - newOutputSum;
    if (surplus < totalFees) {
      throw new Error(
        `Insufficient covenant funds to cover fees (${totalFees} sompi). Enable "Use wallet to pay for fees" or reduce output amounts.`,
      );
    }

    unsignedTx.outputs[unsignedTx.outputs.length - 1].value =
      unsignedTx.outputs[unsignedTx.outputs.length - 1].value - totalFees;
  }
  unsignedTx.finalize();

  const signatureHex = createInputSignature(
    unsignedTx,
    0,
    privateKey,
    SighashType.All,
  );
  // createInputSignature returns: [length_prefix(1)] + [schnorr_sig(64)] + [sighash_type(1)] = 66 bytes
  // The contract expects just [schnorr_sig(64)] + [sighash_type(1)] = 65 bytes (no length prefix)
  const sigHexStr = String(signatureHex);
  let signature = hexToBytes(sigHexStr);
  if (signature.length === 66 && signature[0] === 65) {
    // Strip the length prefix byte — 65 means "65 bytes of sig+sighash follow"
    signature = signature.slice(1);
  }
  const functionArgs = resolveSpendFunctionArgs(
    compiled,
    functionName,
    signature,
    privateKey,
    extraArgs,
  );
  const sigPrefix = buildSigScript(compiled, functionName, functionArgs);

  unsignedTx.inputs[0].signatureScript = ScriptBuilder.fromScript(
    toScriptBytes(compiled),
  ).encodePayToScriptHashSignatureScript(sigPrefix);

  // Sign extra inputs (gas) if any
  for (let i = 1; i < unsignedTx.inputs.length; i++) {
    const sigHexStr = String(
      createInputSignature(unsignedTx, i, privateKey, SighashType.All),
    );
    let sigBytes = hexToBytes(sigHexStr);
    if (sigBytes.length === 66 && sigBytes[0] === 65) {
      sigBytes = sigBytes.slice(1);
    }
    // For standard P2PK/P2TR gas inputs, the signatureScript must be a valid script (a push of the signature).
    unsignedTx.inputs[i].signatureScript = new ScriptBuilder()
      .addData(sigBytes)
      .drain();
  }

  const submitted = await rpc.submitTransaction({
    transaction: unsignedTx,
    allowOrphan: false,
  });

  return {
    txid: submitted.transactionId,
    functionName,
    covenantId: utxoCovenantId,
  };
}

/**
 * Query UTXOs for a covenant address and return covenant-specific information.
 * Leverages the new covenantId field on UtxoEntry (v1.1.0-rc.3).
 */
export async function getCovenantUtxos(
  compiled: CompiledContract,
  network: string,
  rpc: RpcClient,
): Promise<
  Array<{
    outpoint: CovenantOutpoint;
    amount: bigint;
    covenantId?: string;
    blockDaaScore: bigint;
  }>
> {
  const covenantAddress = getCovenantAddress(compiled, network);

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
  rpc: RpcClient,
  priorityFee: bigint = 0n,
  extraArgs?: Record<string, bigint>,
): Promise<PartiallySignedSpend> {
  const covenantAddress = getCovenantAddress(compiled, network);
  const abiEntry = getAbiEntry(compiled, functionName);

  // Determine which sig params this key can sign
  const privateKey = new PrivateKey(privateKeyHex);
  const pubkeyHex = privateKey.toPublicKey().toXOnlyPublicKey().toString();

  const utxos = await getAddressUtxos(rpc, covenantAddress);
  const entry = utxos.find(
    (u: any) =>
      u.outpoint.transactionId === outpoint.txid &&
      Number(u.outpoint.index) === outpoint.vout,
  );
  if (!entry)
    throw new Error(
      `UTXO ${outpoint.txid}:${outpoint.vout} not found at ${covenantAddress}`,
    );

  // Count sig params for sigOpCount
  const sigParams = abiEntry.inputs.filter((inp) => inp.type_name === 'sig');
  const sigOpCount = sigParams.length || 1;

  // Detect timelock: only tx.time needs lockTime, this.age does not
  const astFn = compiled.ast?.functions?.find((f) => f.name === functionName);
  const needsLockTime =
    astFn?.body?.some(
      (n: any) => n.kind === 'time_op' && n.data?.tx_var === 'tx_time',
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
  const txInputs: ITransactionInput[] = [buildCovenantInput(entry, 30)];

  const adjustedOutputs = outputs.map((o) => ({ ...o }));
  const txOutputs: ITransactionOutput[] = adjustedOutputs.map((o) => ({
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
    payload: '',
  });

  unsignedTx.finalize();
  applyEstimatedSignatureScripts(
    unsignedTx,
    compiled,
    functionName,
    privateKey,
    extraArgs,
  );

  const transactionFee = calculateTransactionFee(network, unsignedTx);
  if (!transactionFee) {
    throw new Error('Transaction fee not calculated');
  }

  const totalFees = transactionFee + priorityFee;
  const feeOutputIndex = txOutputs.length - 1;
  if (feeOutputIndex < 0) {
    throw new Error('At least one output is required to pay covenant fees');
  }

  if (unsignedTx.outputs[feeOutputIndex].value <= totalFees) {
    throw new Error(
      `Insufficient contract output to cover fees. Need ${totalFees} sompi, have ${unsignedTx.outputs[feeOutputIndex].value}`,
    );
  }

  unsignedTx.outputs[feeOutputIndex].value -= totalFees;
  adjustedOutputs[feeOutputIndex].amount =
    unsignedTx.outputs[feeOutputIndex].value;
  unsignedTx.finalize();

  // Sign this key's params
  const signatureHex = createInputSignature(
    unsignedTx,
    0,
    privateKey,
    SighashType.All,
  );
  let signature = hexToBytes(String(signatureHex));
  if (signature.length === 66 && signature[0] === 65)
    signature = signature.slice(1);
  const sigHex = bytesToHex(signature);

  // Match this pubkey to contract params by scanning the compiled script bytes
  const signatures: Array<{ paramName: string; signatureHex: string }> = [];
  const pendingParams: string[] = [];

  const myPubkeyBytes = hexToBytes(pubkeyHex);
  const scriptBytes = toScriptBytes(compiled);

  for (const sigParam of sigParams) {
    // findMatchingPubkey returns the PUBKEY PARAM NAME (e.g. "key1") that must sign this sig param.
    // We then check whether our actual pubkey bytes appear at the position where that
    // constructor param is embedded in the script.
    const pubkeyParamName = findMatchingPubkeyParamName(
      compiled,
      functionName,
      sigParam.name,
    );
    const myKeyMatchesThisParam = pubkeyParamName
      ? scriptContainsPubkeyForParam(
          compiled,
          pubkeyParamName,
          myPubkeyBytes,
          scriptBytes,
        )
      : false;

    if (myKeyMatchesThisParam) {
      signatures.push({ paramName: sigParam.name, signatureHex: sigHex });
    } else {
      pendingParams.push(sigParam.name);
    }
  }

  if (signatures.length === 0) {
    throw new Error(
      'Current wallet does not match any required signer for this contract function',
    );
  }

  return {
    compiledJson: JSON.stringify(compiled),
    functionName,
    network,
    outpoint,
    inputAmountSompi: inputAmountSompi.toString(),
    outputs: adjustedOutputs.map((o) => ({
      address: o.address,
      amountSompi: o.amount.toString(),
    })),
    signatures,
    pendingParams,
    lockTime: lockTime.toString(),
    sigOpCount,
    extraArgs: extraArgs
      ? Object.fromEntries(
          Object.entries(extraArgs).map(([key, value]) => [
            key,
            value.toString(),
          ]),
        )
      : undefined,
  };
}

/**
 * Phase 2: Complete a partially signed spend by adding the remaining signature(s)
 * and broadcasting.
 */
export async function completePartialSpend(
  partialSpend: PartiallySignedSpend,
  privateKeyHex: string,
  rpc: RpcClient,
): Promise<SpendResult> {
  const compiled: CompiledContract = JSON.parse(partialSpend.compiledJson);
  const covenantAddress = getCovenantAddress(compiled, partialSpend.network);

  const privateKey = new PrivateKey(privateKeyHex);
  const pubkeyHex = privateKey.toPublicKey().toXOnlyPublicKey().toString();

  const utxos = await getAddressUtxos(rpc, covenantAddress);
  const entry = utxos.find(
    (u: any) =>
      u.outpoint.transactionId === partialSpend.outpoint.txid &&
      Number(u.outpoint.index) === partialSpend.outpoint.vout,
  );
  if (!entry) throw new Error(`UTXO not found for completion`);

  // Rebuild the exact same unsigned TX
  const txInputs: ITransactionInput[] = [buildCovenantInput(entry, 30)];

  const txOutputs: ITransactionOutput[] = partialSpend.outputs.map((o) => ({
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
    payload: '',
  });

  unsignedTx.finalize();

  // Sign our params
  const signatureHex = createInputSignature(
    unsignedTx,
    0,
    privateKey,
    SighashType.All,
  );
  let signature = hexToBytes(String(signatureHex));
  if (signature.length === 66 && signature[0] === 65)
    signature = signature.slice(1);
  const newSigHex = bytesToHex(signature);

  // Merge signatures
  const allSigs = [...partialSpend.signatures];
  const myPubkeyBytes = hexToBytes(pubkeyHex);
  const scriptBytes = toScriptBytes(compiled);

  const remainingParams: string[] = [];
  for (const paramName of partialSpend.pendingParams) {
    const pubkeyParamName = findMatchingPubkeyParamName(
      compiled,
      partialSpend.functionName,
      paramName,
    );
    const myKeyMatchesThisParam = pubkeyParamName
      ? scriptContainsPubkeyForParam(
          compiled,
          pubkeyParamName,
          myPubkeyBytes,
          scriptBytes,
        )
      : false;

    if (myKeyMatchesThisParam) {
      allSigs.push({ paramName, signatureHex: newSigHex });
    } else {
      remainingParams.push(paramName);
    }
  }

  if (remainingParams.length > 0) {
    throw new Error(
      `Current wallet cannot sign pending param(s): ${remainingParams.join(', ')}`,
    );
  }

  // Build the complete sigscript in ABI order
  const abiEntry = getAbiEntry(compiled, partialSpend.functionName);
  const functionArgs: SupportedSigArg[] = [];
  for (const input of abiEntry.inputs) {
    if (input.type_name === 'sig') {
      const sigEntry = allSigs.find((s) => s.paramName === input.name);
      if (!sigEntry)
        throw new Error(`Missing signature for param "${input.name}"`);
      functionArgs.push(hexToBytes(sigEntry.signatureHex));
    } else if (input.type_name === 'pubkey') {
      functionArgs.push(
        hexToBytes(privateKey.toPublicKey().toXOnlyPublicKey().toString()),
      );
    } else if (input.type_name === 'int' || input.type_name === 'bool') {
      // Extra args are passed through the partial spend's extraArgs field
      const extraVal = partialSpend.extraArgs?.[input.name];
      if (extraVal === undefined)
        throw new Error(`Missing extra arg "${input.name}" in partial spend`);
      functionArgs.push(BigInt(extraVal));
    } else {
      throw new Error(
        `Unsupported ABI input type "${input.type_name}" in two-phase signing`,
      );
    }
  }

  const sigPrefix = buildSigScript(
    compiled,
    partialSpend.functionName,
    functionArgs,
  );
  unsignedTx.inputs[0].signatureScript = ScriptBuilder.fromScript(
    toScriptBytes(compiled),
  ).encodePayToScriptHashSignatureScript(sigPrefix);

  const submitted = await rpc.submitTransaction({
    transaction: unsignedTx,
    allowOrphan: false,
  });

  return {
    txid: submitted.transactionId,
    functionName: partialSpend.functionName,
  };
}

// ── Helpers for Two-Phase Signing ────────────────────────────

function extractContractPubkeys(
  compiled: CompiledContract,
): Map<string, string> {
  // Extract pubkey param names from the AST (values are not stored in compiled JSON)
  const pubkeys = new Map<string, string>();
  for (const param of compiled.ast.params) {
    if (param.type_ref.base === 'pubkey') {
      pubkeys.set(param.name, '');
    }
  }
  return pubkeys;
}

/**
 * Returns the constructor PUBKEY PARAM NAME (e.g. "key1") that must sign
 * the given sig param (e.g. "s1") in the given function.
 * Scans the AST for require(checkSig(sigParam, pubkeyParam)) patterns.
 */
function findMatchingPubkeyParamName(
  compiled: CompiledContract,
  functionName: string,
  sigParamName: string,
): string | undefined {
  const astFn = compiled.ast.functions.find((f) => f.name === functionName);
  if (!astFn) return undefined;

  for (const node of astFn.body) {
    if (node.kind === 'require') {
      const expr = (node.data as any)?.expr;
      if (expr?.kind === 'call' && expr.data?.name === 'checkSig') {
        const args = expr.data.args;
        if (args?.length === 2 && args[0]?.data === sigParamName) {
          // Returns the pubkey param name (e.g. "key1")
          return args[1]?.data as string | undefined;
        }
      }
    }
  }
  return undefined;
}

/**
 * Checks whether the caller's pubkey is the one baked into the compiled script
 * for the specific constructor param named `pubkeyParamName`.
 *
 * Strategy:
 *   1. Scan the script for all `0x20 <32 bytes>` pushes and collect unique
 *      pubkey sequences in first-appearance order.
 *   2. The N-th unique pubkey (0-indexed) corresponds to the N-th constructor
 *      pubkey param (e.g. key1=0, key2=1, key3=2) — this matches how
 *      SilverScript embeds params sequentially per branch.
 *   3. Look up the index of `pubkeyParamName` in the AST params list.
 *   4. Return true only if the caller's pubkey matches that specific slot.
 *
 * This ensures signer3 (key3) only claims "s3" params, not "s2" params,
 * even though key3 also appears in the script.
 */
function scriptContainsPubkeyForParam(
  compiled: CompiledContract,
  pubkeyParamName: string,
  pubkeyBytes: Uint8Array,
  scriptBytes: Uint8Array,
): boolean {
  if (pubkeyBytes.length !== 32) return false;

  // Step 1: Collect unique 32-byte pubkey values from the script in first-appearance order.
  // Each pubkey is pushed as: 0x20 (OP_DATA_32) followed by 32 bytes.
  const seenHexOrder: string[] = [];
  for (let i = 0; i <= scriptBytes.length - 33; i++) {
    if (scriptBytes[i] === 0x20) {
      const pkHex = bytesToHex(scriptBytes.slice(i + 1, i + 33));
      if (!seenHexOrder.includes(pkHex)) {
        seenHexOrder.push(pkHex);
      }
    }
  }

  // Step 2: Find the index of pubkeyParamName among the constructor's pubkey params.
  const pubkeyParams = compiled.ast.params.filter(
    (p) => p.type_ref.base === 'pubkey',
  );
  const paramIndex = pubkeyParams.findIndex((p) => p.name === pubkeyParamName);
  if (paramIndex === -1) return false;

  // Step 3: The pubkey at that index in the script must match our caller's key.
  const expectedPubkeyHex = seenHexOrder[paramIndex];
  if (!expectedPubkeyHex) return false;

  return bytesToHex(pubkeyBytes) === expectedPubkeyHex;
}
