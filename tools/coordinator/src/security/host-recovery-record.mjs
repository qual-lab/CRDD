// @ts-check

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";

/** @param {string} rootName @param {string} nonce @param {string} recordHash */
export function formatHostRecoveryToken(rootName, nonce, recordHash) {
  return `host.${rootName}.${nonce}.${recordHash}`;
}

/** @param {unknown} token */
export function parseHostRecoveryToken(token) {
  if (typeof token !== "string") throw new Error("host_recovery_token_invalid");
  const match = /^host\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(token ?? "");
  if (!match) throw new Error("host_recovery_token_invalid");
  const rootName = match[1];
  const nonce = match[2];
  const recordHash = match[3];
  if (!rootName || !nonce || !recordHash) throw new Error("host_recovery_token_invalid");
  return { rootName, nonce, recordHash };
}

/** @param {unknown} token */
export function loadHostRecoveryRecordByToken(token) {
  const parsed = parseHostRecoveryToken(token);
  const parent = fs.realpathSync(os.tmpdir());
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  const realDirectory = fs.realpathSync(directory);
  const directoryMetadata = fs.lstatSync(realDirectory);
  if (
    realDirectory !== directory ||
    path.dirname(realDirectory) !== parent ||
    !directoryMetadata.isDirectory() ||
    directoryMetadata.isSymbolicLink()
  ) throw new Error("host_recovery_directory_untrusted");
  const marker = path.join(realDirectory, `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`);
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink()) throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash) throw new Error("host_recovery_record_mismatch");
  const record = JSON.parse(serialized);
  if (record.schema !== "crdd-coordinator-host-recovery/v1" || record.rootName !== parsed.rootName) {
    throw new Error("host_recovery_record_mismatch");
  }
  return { parsed, parent, directory: realDirectory, marker, record, serialized };
}
