#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactBytes = await readFile(
  resolve(root, "public/assets/covenant-templates/self-custody-vault.json"),
);
const manifest = JSON.parse(
  await readFile(
    resolve(
      root,
      "public/assets/covenant-templates/self-custody-vault.manifest.json",
    ),
    "utf8",
  ),
);
const artifact = JSON.parse(artifactBytes);

assert.equal(artifact.contract_name, "SelfCustodyVaultV2");
assert.equal(sha256(artifactBytes), manifest.artifactSha256);
assert.equal(sha256(Buffer.from(artifact.script)), manifest.scriptSha256);
assert.deepEqual(
  artifact.ast.params.map((entry) => entry.name),
  [
    "hotKey",
    "coldKey",
    "whitelistedDestinations",
    "whitelistCount",
    "initUnvaultDelayDaa",
    "initPhase",
  ],
);
assert.deepEqual(
  artifact.abi.map((entry) => entry.name),
  ["topUp", "unvault", "emergencySweep", "finalizeAll", "finalizePartial"],
);
assert.deepEqual(artifact.abi[0].inputs, []);
assert.deepEqual(
  artifact.abi.at(-1).inputs.map((entry) => entry.name),
  ["hotSig", "destinationIndex", "withdrawalAmount"],
);

console.log(
  `Verified ${artifact.contract_name} artifact ${manifest.artifactSha256}`,
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
