#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const artifactBytes = await readFile(
  new URL(
    "../public/assets/covenant-templates/self-custody-vault.json",
    import.meta.url,
  ),
);
const artifact = JSON.parse(artifactBytes);
const constructorArgs = JSON.parse(
  await readFile(
    new URL("./self-custody-vault-pr368.args.json", import.meta.url),
  ),
);

assert.equal(artifact.contract_name, "SelfCustodyVault");
assert.deepEqual(
  artifact.ast.params.map((param) => param.name),
  [
    "hotKey",
    "coldKey",
    "whitelistedDestinations",
    "unvaultDelaySeconds",
    "initPhase",
  ],
);
assert.deepEqual(
  artifact.abi.map((entry) => entry.name),
  ["topUp", "unvault", "emergencySweep", "finalize"],
);
assert.deepEqual(artifact.state_layout, { start: 1, len: 9 });
assert.equal(constructorArgs.length, 5);
assert.equal(constructorArgs[2].data.length, 10);
assert.equal(constructorArgs[3].data, 86_400);
assert.equal(constructorArgs[4].data, 0);

const source = artifact.ast.span;
assert.match(source, /whitelistedDestinations\.length > 0/);
assert.match(source, /this\.age >= unvaultDelaySeconds/);
assert.doesNotMatch(source, /whitelistCount|activeWhitelistCount/);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(
  sha256(Buffer.from(artifact.script)),
  "2df6904e5142a2284b9e4432edee1edcbc9d23813215e4925c5f8c54c16c9b25",
);
assert.equal(
  sha256(artifactBytes),
  "715981f6317a567b1a61ef0705ad8914c7e62c220d710157d34961d2a8f2176c",
);

console.log("Verified wallet artifact against merged covenant PR #368");
